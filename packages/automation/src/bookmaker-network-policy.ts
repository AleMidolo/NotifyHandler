import { isIP } from "node:net";

import type { WorkerBookmaker } from "./dom-mapping.ts";
import {
  isInternalHostname,
  resolveHostAddresses,
  type HostResolver,
} from "./navigation-policy.ts";

export type BookmakerWssFailureCode =
  | "BOOKMAKER_WSS_INSECURE"
  | "BOOKMAKER_WSS_UNAPPROVED"
  | "BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED";

export type BookmakerWssDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; code: BookmakerWssFailureCode }>;

export interface BookmakerWebSocketRules {
  readonly exactHosts: readonly string[];
  readonly reviewedHostSuffixes: readonly string[];
}

export interface BookmakerNetworkPolicyDefinition {
  readonly bookmaker: WorkerBookmaker;
  readonly topLevelOrigins: readonly string[];
  readonly websocket: BookmakerWebSocketRules;
}

export const BOOKMAKER_WEBSOCKET_RULES: Readonly<
  Record<WorkerBookmaker, BookmakerWebSocketRules>
> = Object.freeze({
  sisal: Object.freeze({
    exactHosts: Object.freeze([]),
    reviewedHostSuffixes: Object.freeze([]),
  }),
  bet365: Object.freeze({
    exactHosts: Object.freeze([]),
    reviewedHostSuffixes: Object.freeze([]),
  }),
});

function canonicalHostname(raw: string): string | undefined {
  const value = raw.trim().toLowerCase().replace(/\.$/u, "");
  if (
    value === ""
    || value.length > 253
    || isIP(value) !== 0
    || isInternalHostname(value)
  ) {
    return undefined;
  }
  const labels = value.split(".");
  if (
    labels.length < 2
    || labels.some(
      (label) =>
        label.length === 0
        || label.length > 63
        || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
    )
  ) {
    return undefined;
  }
  return value;
}

function canonicalOrigin(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Bookmaker network policy origin is malformed.");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.pathname !== "/"
    || parsed.search !== ""
    || parsed.hash !== ""
    || parsed.port !== ""
    || canonicalHostname(parsed.hostname) === undefined
  ) {
    throw new Error("Bookmaker network policy origin must be a canonical public HTTPS origin.");
  }
  return parsed;
}

function suffixMatches(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith("." + suffix);
}

function validateRules(
  origins: readonly URL[],
  rules: BookmakerWebSocketRules,
): Readonly<{
  exactHosts: ReadonlySet<string>;
  reviewedHostSuffixes: readonly string[];
}> {
  const exactHosts = new Set<string>();
  for (const raw of rules.exactHosts) {
    const host = canonicalHostname(raw);
    if (host === undefined || host !== raw.trim().toLowerCase().replace(/\.$/u, "")) {
      throw new Error("Bookmaker WSS exact host must be a canonical public DNS hostname.");
    }
    exactHosts.add(host);
  }

  const reviewedHostSuffixes: string[] = [];
  for (const raw of rules.reviewedHostSuffixes) {
    const suffix = canonicalHostname(raw);
    if (suffix === undefined || suffix !== raw.trim().toLowerCase().replace(/\.$/u, "")) {
      throw new Error("Bookmaker WSS reviewed suffix must be a canonical DNS namespace.");
    }

    // BOOK-029 deliberately keeps suffix authorization narrower than arbitrary
    // third-party namespaces: a reviewed suffix must contain the bookmaker's
    // approved top-level origin. Third-party runtime needs can still use an
    // explicit exact-host rule and any broader suffix requires a reviewed
    // architecture/security amendment.
    const belongsToBookmakerNamespace = origins.some((origin) =>
      suffixMatches(origin.hostname.toLowerCase(), suffix)
    );
    if (!belongsToBookmakerNamespace) {
      throw new Error("Bookmaker WSS reviewed suffix must be within an approved bookmaker origin namespace.");
    }
    reviewedHostSuffixes.push(suffix);
  }

  return {
    exactHosts,
    reviewedHostSuffixes: Object.freeze([...new Set(reviewedHostSuffixes)]),
  };
}

export class BookmakerNetworkPolicy {
  readonly bookmaker: WorkerBookmaker;
  private readonly topLevelOrigins: ReadonlySet<string>;
  private readonly websocketExactHosts: ReadonlySet<string>;
  private readonly websocketSuffixes: readonly string[];
  private readonly resolveHostname: HostResolver;

  constructor(
    definition: BookmakerNetworkPolicyDefinition,
    resolveHostname: HostResolver = resolveHostAddresses,
  ) {
    const origins = definition.topLevelOrigins.map(canonicalOrigin);
    if (origins.length === 0) {
      throw new Error("Bookmaker network policy requires at least one approved top-level origin.");
    }
    this.bookmaker = definition.bookmaker;
    this.topLevelOrigins = new Set(origins.map((origin) => origin.origin));
    const validated = validateRules(origins, definition.websocket);
    this.websocketExactHosts = validated.exactHosts;
    this.websocketSuffixes = validated.reviewedHostSuffixes;
    this.resolveHostname = resolveHostname;
  }

  matchesReviewedWebSocketHost(hostname: string): boolean {
    const canonical = canonicalHostname(hostname);
    if (canonical === undefined) return false;
    if (this.websocketExactHosts.has(canonical)) return true;
    return this.websocketSuffixes.some((suffix) => suffixMatches(canonical, suffix));
  }

  async evaluateWebSocket(
    rawUrl: string,
    currentTopLevelUrl: string,
    cancelled = false,
  ): Promise<BookmakerWssDecision> {
    if (cancelled) return { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" };

    let current: URL;
    try {
      current = new URL(currentTopLevelUrl);
    } catch {
      return { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" };
    }
    if (
      current.protocol !== "https:"
      || current.username !== ""
      || current.password !== ""
      || !this.topLevelOrigins.has(current.origin)
    ) {
      return { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" };
    }

    if (parsed.protocol !== "wss:") {
      return { allowed: false, code: "BOOKMAKER_WSS_INSECURE" };
    }
    if (
      parsed.username !== ""
      || parsed.password !== ""
      || (parsed.port !== "" && parsed.port !== "443")
      || isIP(parsed.hostname.replace(/^\[|\]$/gu, "")) !== 0
    ) {
      return { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" };
    }

    const hostname = canonicalHostname(parsed.hostname);
    if (hostname === undefined || !this.matchesReviewedWebSocketHost(hostname)) {
      return { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" };
    }

    try {
      const addresses = await this.resolveHostname(hostname);
      if (
        addresses.length === 0
        || addresses.some((address) => isInternalHostname(address))
      ) {
        return { allowed: false, code: "BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED" };
      }
    } catch {
      return { allowed: false, code: "BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED" };
    }

    return { allowed: true };
  }
}

export function createBookmakerNetworkPolicy(
  bookmaker: WorkerBookmaker,
  topLevelOrigins: readonly string[],
  resolveHostname?: HostResolver,
): BookmakerNetworkPolicy {
  return new BookmakerNetworkPolicy(
    {
      bookmaker,
      topLevelOrigins,
      websocket: BOOKMAKER_WEBSOCKET_RULES[bookmaker],
    },
    resolveHostname,
  );
}
