function parseIpv4(hostname: string): readonly number[] | undefined {
  const parts = hostname.split(".");
  if (parts.length !== 4) return undefined;
  const values = parts.map((part) => Number(part));
  if (values.some((value, index) => !Number.isInteger(value) || value < 0 || value > 255 || String(value) !== parts[index])) {
    return undefined;
  }
  return values;
}

export function isInternalHostname(rawHostname: string): boolean {
  const hostname = rawHostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return true;

  const ipv4 = parseIpv4(hostname);
  if (ipv4) {
    const [a = 0, b = 0] = ipv4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (hostname.includes(":")) {
    if (hostname === "::" || hostname === "::1") return true;
    if (hostname.startsWith("fc") || hostname.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(hostname)) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(hostname)?.[1];
    return mapped === undefined ? false : isInternalHostname(mapped);
  }

  return false;
}

export class NavigationPolicy {
  private readonly approvedOrigins: ReadonlySet<string>;

  constructor(origins: readonly string[]) {
    const normalized = new Set<string>();
    for (const origin of origins) {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`Invalid approved origin: ${origin}`);
      }
      if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.origin !== origin) {
        throw new Error(`Approved origin must be a canonical HTTPS origin: ${origin}`);
      }
      if (isInternalHostname(parsed.hostname)) throw new Error(`Internal/private approved origin is forbidden: ${origin}`);
      normalized.add(parsed.origin);
    }
    this.approvedOrigins = normalized;
  }

  isAllowed(rawUrl: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return false;
    }

    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      this.approvedOrigins.has(parsed.origin) &&
      !isInternalHostname(parsed.hostname)
    );
  }
}
