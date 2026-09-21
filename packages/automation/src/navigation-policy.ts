import { lookup } from "node:dns/promises";

export type HostResolver = (hostname: string) => Promise<readonly string[]>;

export const resolveHostAddresses: HostResolver = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((item) => item.address);
};

function parseIpv4(hostname: string): readonly number[] | undefined {
  const parts = hostname.split(".");
  if (parts.length !== 4) return undefined;
  const values = parts.map((part) => Number(part));
  if (values.some((value, index) => !Number.isInteger(value) || value < 0 || value > 255 || String(value) !== parts[index])) {
    return undefined;
  }
  return values;
}

function parseIpv6(hostname: string): bigint | undefined {
  const withoutZone = hostname.replace(/^\[|\]$/g, "").split("%", 1)[0]?.toLowerCase();
  if (withoutZone === undefined || !withoutZone.includes(":")) return undefined;

  let value = withoutZone;
  const ipv4Tail = /(^|:)(\d+\.\d+\.\d+\.\d+)$/.exec(value)?.[2];
  if (ipv4Tail !== undefined) {
    const ipv4 = parseIpv4(ipv4Tail);
    if (ipv4 === undefined) return undefined;
    const high = ((ipv4[0] ?? 0) << 8) | (ipv4[1] ?? 0);
    const low = ((ipv4[2] ?? 0) << 8) | (ipv4[3] ?? 0);
    value = value.slice(0, value.length - ipv4Tail.length) + high.toString(16) + ":" + low.toString(16);
  }

  const double = value.indexOf("::");
  if (double !== -1 && value.indexOf("::", double + 2) !== -1) return undefined;
  const left = double === -1 ? value.split(":") : value.slice(0, double).split(":").filter(Boolean);
  const right = double === -1 ? [] : value.slice(double + 2).split(":").filter(Boolean);
  const missing = double === -1 ? 0 : 8 - left.length - right.length;
  if (missing < 1 && double !== -1) return undefined;
  const groups = double === -1 ? left : [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) return undefined;

  let result = 0n;
  for (const group of groups) result = (result << 16n) | BigInt(parseInt(group, 16));
  return result;
}

function ipv4FromMappedIpv6(value: bigint): string | undefined {
  const mappedPrefix = 0xffffn;
  if ((value >> 32n) !== mappedPrefix) return undefined;
  const low = Number(value & 0xffffffffn);
  return [
    (low >>> 24) & 255,
    (low >>> 16) & 255,
    (low >>> 8) & 255,
    low & 255,
  ].join(".");
}

export function isInternalHostname(rawHostname: string): boolean {
  const hostname = rawHostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return true;

  const ipv4 = parseIpv4(hostname);
  if (ipv4) {
    const [a = 0, b = 0, c = 0] = ipv4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  const ipv6 = parseIpv6(hostname);
  if (ipv6 !== undefined) {
    const mapped = ipv4FromMappedIpv6(ipv6);
    if (mapped !== undefined) return isInternalHostname(mapped);
    if (ipv6 === 0n || ipv6 === 1n) return true;
    if ((ipv6 >> 121n) === 0x7en) return true; // fc00::/7 unique-local
    if ((ipv6 >> 118n) === 0x3fan) return true; // fe80::/10 link-local
    if ((ipv6 >> 120n) === 0xffn) return true; // ff00::/8 multicast
    if ((ipv6 >> 96n) === 0x20010db8n) return true; // documentation-only
  }

  return false;
}

export class NavigationPolicy {
  private readonly approvedOrigins: ReadonlySet<string>;
  private readonly resolveHostname: HostResolver;

  constructor(origins: readonly string[], resolveHostname: HostResolver = resolveHostAddresses) {
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
    this.resolveHostname = resolveHostname;
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

  async isResolvedTargetAllowed(rawUrl: string): Promise<boolean> {
    if (!this.isAllowed(rawUrl)) return false;
    let hostname: string;
    try {
      hostname = new URL(rawUrl).hostname;
    } catch {
      return false;
    }

    try {
      const addresses = await this.resolveHostname(hostname);
      return addresses.length > 0 && addresses.every((address) => !isInternalHostname(address));
    } catch {
      return false;
    }
  }
}
