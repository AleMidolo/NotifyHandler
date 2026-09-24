import type {
  BookmakerId,
  ExecutionPlan,
  OutcomeSide,
  SelectionTarget,
  NavigationTarget,
} from "../../domain/src/index.ts";

export const DIRECT_PAIR_SCHEMA_VERSION = "notifyhandler.direct-pair.v1" as const;
export const DIRECT_PAIR_SCHEMA_VERSION_V2 = "notifyhandler.direct-pair.v2" as const;

export interface DirectPairLegV1 {
  readonly bookmaker: BookmakerId;
  readonly outcome: OutcomeSide;
  readonly expectedOdds: string;
  readonly deepLink: string;
}

export interface DirectPairNotificationV1 {
  readonly schemaVersion: typeof DIRECT_PAIR_SCHEMA_VERSION;
  readonly notificationId: string;
  readonly sentAt: string;
  readonly event: Readonly<{
    participantA: string;
    participantB: string;
    competition?: string;
    scheduledAt?: string;
    sourceDisplay?: string;
  }>;
  readonly market: Readonly<{
    family: "total";
    context: "corners";
    period: "full_match";
    line: string;
    sourceLabel?: string;
  }>;
  readonly legs: readonly [DirectPairLegV1, DirectPairLegV1];
}

export interface CanonicalDirectPairV1 {
  readonly schemaVersion: typeof DIRECT_PAIR_SCHEMA_VERSION;
  readonly notificationId: string;
  readonly sentAt: string;
  readonly event: Readonly<{
    participantA: string;
    participantB: string;
    competition?: string;
    scheduledAt?: string;
    sourceDisplay: string;
  }>;
  readonly market: Readonly<{
    family: "total";
    context: "corners";
    period: "full_match";
    line: string;
    sourceLabel: string;
  }>;
  readonly legs: readonly [DirectPairLegV1, DirectPairLegV1];
}

export type DirectPairNavigationV2 =
  | Readonly<{ kind: "bookmaker-direct"; url: string }>
  | Readonly<{ kind: "betup-relay"; url: string }>;

export interface DirectPairLegV2 {
  readonly bookmaker: BookmakerId;
  readonly outcome: OutcomeSide;
  readonly expectedOdds?: string;
  readonly navigation: DirectPairNavigationV2;
}

export interface DirectPairNotificationV2 {
  readonly schemaVersion: typeof DIRECT_PAIR_SCHEMA_VERSION_V2;
  readonly notificationId: string;
  readonly sentAt: string;
  readonly event: DirectPairNotificationV1["event"];
  readonly market: DirectPairNotificationV1["market"];
  readonly legs: readonly [DirectPairLegV2, DirectPairLegV2];
}

export interface CanonicalDirectPairLegV2 {
  readonly bookmaker: BookmakerId;
  readonly outcome: OutcomeSide;
  readonly expectedOdds?: string;
  readonly navigation:
    | Readonly<{ kind: "bookmaker-direct"; url: string }>
    | Readonly<{
        kind: "betup-relay";
        url: string;
        signalId: string;
        bookmaker: BookmakerId;
      }>;
}

export interface CanonicalDirectPairV2 {
  readonly schemaVersion: typeof DIRECT_PAIR_SCHEMA_VERSION_V2;
  readonly notificationId: string;
  readonly sentAt: string;
  readonly event: CanonicalDirectPairV1["event"];
  readonly market: CanonicalDirectPairV1["market"];
  readonly legs: readonly [CanonicalDirectPairLegV2, CanonicalDirectPairLegV2];
}

export type DirectPairValidationCode =
  | "INVALID_SCHEMA"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "INVALID_NOTIFICATION_ID"
  | "INVALID_SENT_AT"
  | "STALE_NOTIFICATION"
  | "FUTURE_NOTIFICATION"
  | "INVALID_EVENT"
  | "INVALID_MARKET"
  | "INVALID_LEGS"
  | "UNSUPPORTED_BOOKMAKER"
  | "INVALID_OUTCOME"
  | "INVALID_ODDS"
  | "INVALID_DEEP_LINK"
  | "INVALID_NAVIGATION"
  | "INVALID_RELAY_URL"
  | "UNKNOWN_RELAY_SUFFIX"
  | "RELAY_BOOKMAKER_MISMATCH"
  | "RELAY_SIGNAL_MISMATCH"
  | "DUPLICATE_BOOKMAKER";

export interface DirectPairValidationIssue {
  readonly code: DirectPairValidationCode;
  readonly field: string;
  readonly message: string;
}

export type DirectPairNormalizationResult =
  | {
      readonly ok: true;
      readonly value: Readonly<{
        canonical: CanonicalDirectPairV1;
        plan: ExecutionPlan;
      }>;
    }
  | { readonly ok: false; readonly errors: readonly DirectPairValidationIssue[] };

export type DirectPairNormalizationResultV2 =
  | {
      readonly ok: true;
      readonly value: Readonly<{
        canonical: CanonicalDirectPairV2;
        plan: ExecutionPlan;
      }>;
    }
  | { readonly ok: false; readonly errors: readonly DirectPairValidationIssue[] };

export type StructuredDirectPairCanonical = CanonicalDirectPairV1 | CanonicalDirectPairV2;

export type StructuredDirectPairNormalizationResult =
  | {
      readonly ok: true;
      readonly value: Readonly<{
        canonical: StructuredDirectPairCanonical;
        plan: ExecutionPlan;
      }>;
    }
  | { readonly ok: false; readonly errors: readonly DirectPairValidationIssue[] };

export interface DirectPairNormalizationOptions {
  readonly now?: () => Date;
  readonly maxAgeMs?: number;
  readonly maxFutureSkewMs?: number;
}

const BOOKMAKERS = new Set<BookmakerId>(["sisal", "bet365", "lottomatica", "eplay24", "admiralbet"]);
const TOP_LEVEL_KEYS = ["schemaVersion", "notificationId", "sentAt", "event", "market", "legs"] as const;
const EVENT_KEYS = ["participantA", "participantB", "competition", "scheduledAt", "sourceDisplay"] as const;
const MARKET_KEYS = ["family", "context", "period", "line", "sourceLabel"] as const;
const LEG_KEYS = ["bookmaker", "outcome", "expectedOdds", "deepLink"] as const;
const LEG_V2_KEYS = ["bookmaker", "outcome", "expectedOdds", "navigation"] as const;
const NAVIGATION_KEYS = ["kind", "url"] as const;

const EXECUTABLE_BOOKMAKERS = new Set<BookmakerId>(["sisal", "bet365"]);
const BOOKMAKER_DIRECT_ORIGINS: Readonly<Partial<Record<BookmakerId, string>>> = Object.freeze({
  sisal: "https://www.sisal.it",
  bet365: "https://www.bet365.it",
});
export const BETUP_RELAY_SUFFIX_REGISTRY: Readonly<Record<string, BookmakerId>> = Object.freeze({
  bet365: "bet365",
  sisal: "sisal",
  lottomatica: "lottomatica",
  eplay24: "eplay24",
  admiralbet: "admiralbet",
});
const BETUP_RELAY_ORIGIN = "https://www.bet-up.it";
const BETUP_RELAY_PATH = /^\/lnk\/([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\/([a-z0-9]+)$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function optionalBoundedString(value: unknown, maxLength: number): string | undefined | null {
  if (value === undefined) return undefined;
  return boundedString(value, maxLength);
}

function canonicalDecimal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/u.test(trimmed)) return null;
  const [integerRaw, fractionRaw] = trimmed.split(".");
  if (integerRaw === undefined) return null;
  const integer = integerRaw.replace(/^0+(?=\d)/u, "") || "0";
  const fraction = (fractionRaw ?? "").replace(/0+$/u, "");
  return fraction.length === 0 ? integer : integer + "." + fraction;
}

function isGreaterThanZero(value: string): boolean {
  return /[1-9]/u.test(value);
}

function isDecimalOdds(value: string): boolean {
  const [integer = "0", fraction = ""] = value.split(".");
  if (integer.length > 1) return true;
  if (integer > "1") return true;
  return integer === "1" && /[1-9]/u.test(fraction);
}

const ISO_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/u;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseStrictIsoInstant(value: unknown, requireUtc: boolean): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(ISO_INSTANT_PATTERN);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const zone = match[8];
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);

  if (
    !Number.isInteger(year)
    || month < 1
    || month > 12
    || day < 1
    || day > daysInMonth(year, month)
    || hour < 0
    || hour > 23
    || minute < 0
    || minute > 59
    || second < 0
    || second > 59
    || offsetHour < 0
    || offsetHour > 14
    || offsetMinute < 0
    || offsetMinute > 59
    || (offsetHour === 14 && offsetMinute !== 0)
    || (requireUtc && zone !== "Z")
  ) {
    return null;
  }

  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function parseUtcInstant(value: unknown): string | null {
  return parseStrictIsoInstant(value, true);
}

function parseOffsetInstant(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return parseStrictIsoInstant(value, false);
}

function forbiddenLiteralHost(hostname: string): boolean {
  const host = hostname.replace(/^\[/u, "").replace(/\]$/u, "").toLocaleLowerCase("en-US");
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (/^(?:fc|fd)[0-9a-f]{2}:/u.test(host) || /^fe[89ab][0-9a-f]:/u.test(host)) return true;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return true;
  const [a = 0, b = 0] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function normalizeDeepLink(value: unknown): string | null {
  const raw = boundedString(value, 4096);
  if (raw === null) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
    if (url.hostname.length === 0 || forbiddenLiteralHost(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function fail(errors: DirectPairValidationIssue[]): DirectPairNormalizationResult {
  return { ok: false, errors };
}

function issue(code: DirectPairValidationCode, field: string, message: string): DirectPairValidationIssue {
  return { code, field, message };
}

function normalizeBookmaker(value: unknown): BookmakerId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleLowerCase("en-US") as BookmakerId;
  return BOOKMAKERS.has(normalized) ? normalized : null;
}

function normalizeSide(value: unknown): OutcomeSide | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleLowerCase("en-US");
  return normalized === "over" || normalized === "under" ? normalized : null;
}

export function normalizeDirectPairNotificationV1(
  input: unknown,
  options: DirectPairNormalizationOptions = {},
): DirectPairNormalizationResult {
  const errors: DirectPairValidationIssue[] = [];
  if (!isRecord(input) || !hasOnlyKeys(input, TOP_LEVEL_KEYS)) {
    return fail([issue("INVALID_SCHEMA", "$", "Payload must be a strict direct-pair v1 object.")]);
  }

  if (input.schemaVersion !== DIRECT_PAIR_SCHEMA_VERSION) {
    errors.push(issue("UNSUPPORTED_SCHEMA_VERSION", "schemaVersion", "Unsupported structured notification schema version."));
  }

  const notificationId = boundedString(input.notificationId, 128);
  if (notificationId === null || !/^[A-Za-z0-9._:-]+$/u.test(notificationId)) {
    errors.push(issue("INVALID_NOTIFICATION_ID", "notificationId", "notificationId must be 1-128 bounded ASCII identifier characters."));
  }

  const sentAt = parseUtcInstant(input.sentAt);
  if (sentAt === null) {
    errors.push(issue("INVALID_SENT_AT", "sentAt", "sentAt must be a valid ISO-8601 UTC instant."));
  } else {
    const nowMs = (options.now ?? (() => new Date()))().getTime();
    const sentAtMs = Date.parse(sentAt);
    const maxAgeMs = options.maxAgeMs ?? 5 * 60_000;
    const maxFutureSkewMs = options.maxFutureSkewMs ?? 60_000;
    if (sentAtMs < nowMs - maxAgeMs) {
      errors.push(issue("STALE_NOTIFICATION", "sentAt", "Structured notification is outside the accepted freshness window."));
    } else if (sentAtMs > nowMs + maxFutureSkewMs) {
      errors.push(issue("FUTURE_NOTIFICATION", "sentAt", "Structured notification is too far in the future."));
    }
  }

  if (!isRecord(input.event) || !hasOnlyKeys(input.event, EVENT_KEYS)) {
    errors.push(issue("INVALID_EVENT", "event", "event must be a strict object."));
  }
  const event = isRecord(input.event) ? input.event : {};
  const participantA = boundedString(event.participantA, 200);
  const participantB = boundedString(event.participantB, 200);
  const competition = optionalBoundedString(event.competition, 200);
  const sourceDisplay = optionalBoundedString(event.sourceDisplay, 500);
  const scheduledAt = parseOffsetInstant(event.scheduledAt);
  if (
    participantA === null
    || participantB === null
    || participantA.toLocaleLowerCase("en-US") === participantB.toLocaleLowerCase("en-US")
    || competition === null
    || sourceDisplay === null
    || scheduledAt === null
  ) {
    errors.push(issue("INVALID_EVENT", "event", "Event participants/context are missing, ambiguous, or invalid."));
  }

  if (!isRecord(input.market) || !hasOnlyKeys(input.market, MARKET_KEYS)) {
    errors.push(issue("INVALID_MARKET", "market", "market must be a strict object."));
  }
  const market = isRecord(input.market) ? input.market : {};
  const line = canonicalDecimal(market.line);
  const marketSourceLabel = optionalBoundedString(market.sourceLabel, 500);
  if (
    market.family !== "total"
    || market.context !== "corners"
    || market.period !== "full_match"
    || line === null
    || !isGreaterThanZero(line)
    || marketSourceLabel === null
  ) {
    errors.push(issue("INVALID_MARKET", "market", "v1 supports only full-match total-corners with an explicit positive line."));
  }

  if (!Array.isArray(input.legs) || input.legs.length !== 2) {
    errors.push(issue("INVALID_LEGS", "legs", "Exactly two explicit legs are required."));
  }

  const normalizedLegs: DirectPairLegV1[] = [];
  const rawLegs = Array.isArray(input.legs) ? input.legs : [];
  for (let index = 0; index < rawLegs.length && index < 2; index += 1) {
    const raw = rawLegs[index];
    if (!isRecord(raw) || !hasOnlyKeys(raw, LEG_KEYS)) {
      errors.push(issue("INVALID_LEGS", "legs[" + index + "]", "Each leg must be a strict object."));
      continue;
    }
    const bookmaker = normalizeBookmaker(raw.bookmaker);
    const outcome = normalizeSide(raw.outcome);
    const expectedOdds = canonicalDecimal(raw.expectedOdds);
    const deepLink = normalizeDeepLink(raw.deepLink);
    if (bookmaker === null) errors.push(issue("UNSUPPORTED_BOOKMAKER", "legs[" + index + "].bookmaker", "Bookmaker id is not a supported canonical value."));
    if (outcome === null) errors.push(issue("INVALID_OUTCOME", "legs[" + index + "].outcome", "Outcome must be explicitly over or under."));
    if (expectedOdds === null || !isDecimalOdds(expectedOdds)) {
      errors.push(issue("INVALID_ODDS", "legs[" + index + "].expectedOdds", "Expected decimal odds must be greater than 1."));
    }
    if (deepLink === null) {
      errors.push(issue("INVALID_DEEP_LINK", "legs[" + index + "].deepLink", "Direct match link must be a bounded HTTPS URL without userinfo or local/private literal host."));
    }
    if (bookmaker !== null && outcome !== null && expectedOdds !== null && isDecimalOdds(expectedOdds) && deepLink !== null) {
      normalizedLegs.push({ bookmaker, outcome, expectedOdds, deepLink });
    }
  }

  if (normalizedLegs.length === 2) {
    if (normalizedLegs[0]!.bookmaker === normalizedLegs[1]!.bookmaker) {
      errors.push(issue("DUPLICATE_BOOKMAKER", "legs", "The two structured legs must target distinct bookmakers."));
    }
    if (normalizedLegs[0]!.outcome === normalizedLegs[1]!.outcome) {
      errors.push(issue("INVALID_OUTCOME", "legs", "The total-corners pair must contain one OVER and one UNDER leg."));
    }
  }

  if (
    errors.length > 0
    || notificationId === null
    || sentAt === null
    || participantA === null
    || participantB === null
    || competition === null
    || sourceDisplay === null
    || scheduledAt === null
    || line === null
    || marketSourceLabel === null
    || normalizedLegs.length !== 2
  ) {
    return fail(errors);
  }

  const eventSourceDisplay = sourceDisplay ?? participantA + " - " + participantB;
  const marketLabel = marketSourceLabel ?? "TOTAL CORNERS " + line;
  const canonicalEvent = {
    participantA,
    participantB,
    ...(competition === undefined ? {} : { competition }),
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    sourceDisplay: eventSourceDisplay,
  };
  const canonicalMarket = {
    family: "total" as const,
    context: "corners" as const,
    period: "full_match" as const,
    line,
    sourceLabel: marketLabel,
  };
  const legs: readonly [DirectPairLegV1, DirectPairLegV1] = [
    normalizedLegs[0]!,
    normalizedLegs[1]!,
  ];
  const canonical: CanonicalDirectPairV1 = {
    schemaVersion: DIRECT_PAIR_SCHEMA_VERSION,
    notificationId,
    sentAt,
    event: canonicalEvent,
    market: canonicalMarket,
    legs,
  };

  const createdAt = (options.now ?? (() => new Date()))().toISOString();
  const targetForLeg = (leg: DirectPairLegV1, index: 0 | 1): SelectionTarget => ({
    id: "structured-target-" + (index + 1),
    bookmaker: leg.bookmaker,
    event: canonicalEvent,
    market: {
      family: "total",
      context: "corners",
      period: "full_match",
      line,
      sourceLabel: marketLabel,
    },
    outcome: {
      side: leg.outcome,
      sourceLabel: leg.outcome.toLocaleUpperCase("en-US"),
    },
    expectedOdds: leg.expectedOdds,
    deepLink: leg.deepLink,
    provenance: {
      kind: "structured-direct-pair",
      schemaVersion: DIRECT_PAIR_SCHEMA_VERSION,
      notificationId,
      legIndex: index,
    },
  });
  const targets: readonly [SelectionTarget, SelectionTarget] = [
    targetForLeg(legs[0], 0),
    targetForLeg(legs[1], 1),
  ];

  const plan: ExecutionPlan = {
    id: "direct-pair:" + notificationId + ":" + Date.parse(sentAt).toString(36),
    notificationId,
    recommendedOptionId: "direct-pair-v1",
    createdAt,
    legs: [
      { id: "leg-1", target: targets[0] },
      { id: "leg-2", target: targets[1] },
    ],
  };

  return { ok: true, value: { canonical, plan } };
}


function directNavigationForV2(
  value: unknown,
  bookmaker: BookmakerId,
  field: string,
  errors: DirectPairValidationIssue[],
): CanonicalDirectPairLegV2["navigation"] | null {
  if (!isRecord(value) || !hasOnlyKeys(value, NAVIGATION_KEYS) || typeof value.kind !== "string") {
    errors.push(issue("INVALID_NAVIGATION", field, "navigation must be a strict typed object."));
    return null;
  }

  if (value.kind === "bookmaker-direct") {
    const urlText = normalizeDeepLink(value.url);
    if (urlText === null) {
      errors.push(issue("INVALID_NAVIGATION", field + ".url", "Direct navigation must be a bounded HTTPS URL without userinfo or local/private literal host."));
      return null;
    }
    const expectedOrigin = BOOKMAKER_DIRECT_ORIGINS[bookmaker];
    let parsed: URL;
    try { parsed = new URL(urlText); }
    catch {
      errors.push(issue("INVALID_NAVIGATION", field + ".url", "Direct navigation URL is malformed."));
      return null;
    }
    if (expectedOrigin === undefined || parsed.origin !== expectedOrigin) {
      errors.push(issue("INVALID_NAVIGATION", field + ".url", "Direct navigation origin does not match the selected bookmaker."));
      return null;
    }
    return { kind: "bookmaker-direct", url: parsed.href };
  }

  if (value.kind === "betup-relay") {
    const raw = boundedString(value.url, 4096);
    if (raw === null) {
      errors.push(issue("INVALID_RELAY_URL", field + ".url", "Relay URL must be a bounded HTTPS URL."));
      return null;
    }
    let parsed: URL;
    try { parsed = new URL(raw); }
    catch {
      errors.push(issue("INVALID_RELAY_URL", field + ".url", "Relay URL is malformed."));
      return null;
    }
    if (
      parsed.protocol !== "https:"
      || parsed.origin !== BETUP_RELAY_ORIGIN
      || parsed.username !== ""
      || parsed.password !== ""
      || parsed.search !== ""
      || parsed.hash !== ""
      || forbiddenLiteralHost(parsed.hostname)
    ) {
      errors.push(issue("INVALID_RELAY_URL", field + ".url", "Relay navigation must use the exact bet-up HTTPS origin without userinfo, query, fragment, or local/private literal host."));
      return null;
    }
    const match = parsed.pathname.match(BETUP_RELAY_PATH);
    if (match === null || match[1] === undefined || match[2] === undefined) {
      errors.push(issue("INVALID_RELAY_URL", field + ".url", "Relay path must be exactly /lnk/<uuid>/<bookmaker-suffix>."));
      return null;
    }
    const suffix = match[2];
    const boundBookmaker = BETUP_RELAY_SUFFIX_REGISTRY[suffix];
    if (boundBookmaker === undefined) {
      errors.push(issue("UNKNOWN_RELAY_SUFFIX", field + ".url", "Relay bookmaker suffix is not registered."));
      return null;
    }
    if (boundBookmaker !== bookmaker) {
      errors.push(issue("RELAY_BOOKMAKER_MISMATCH", field + ".url", "Relay bookmaker suffix does not match the leg bookmaker."));
      return null;
    }
    return {
      kind: "betup-relay",
      url: parsed.href,
      signalId: match[1].toLocaleLowerCase("en-US"),
      bookmaker,
    };
  }

  errors.push(issue("INVALID_NAVIGATION", field + ".kind", "navigation.kind must be bookmaker-direct or betup-relay."));
  return null;
}

export function normalizeDirectPairNotificationV2(
  input: unknown,
  options: DirectPairNormalizationOptions = {},
): DirectPairNormalizationResultV2 {
  const errors: DirectPairValidationIssue[] = [];
  if (!isRecord(input) || !hasOnlyKeys(input, TOP_LEVEL_KEYS)) {
    return { ok: false, errors: [issue("INVALID_SCHEMA", "$", "Payload must be a strict direct-pair v2 object.")] };
  }
  if (input.schemaVersion !== DIRECT_PAIR_SCHEMA_VERSION_V2) {
    errors.push(issue("UNSUPPORTED_SCHEMA_VERSION", "schemaVersion", "Unsupported structured notification schema version."));
  }

  const rawLegs = Array.isArray(input.legs) ? input.legs : [];
  if (rawLegs.length !== 2) {
    errors.push(issue("INVALID_LEGS", "legs", "Exactly two explicit legs are required."));
  }

  const canonicalNavigations: Array<CanonicalDirectPairLegV2["navigation"] | null> = [];
  const canonicalExpectedOdds: Array<string | undefined> = [];
  const syntheticLegs: Array<Record<string, unknown>> = [];
  for (let index = 0; index < rawLegs.length && index < 2; index += 1) {
    const raw = rawLegs[index];
    if (!isRecord(raw) || !hasOnlyKeys(raw, LEG_V2_KEYS)) {
      errors.push(issue("INVALID_LEGS", "legs[" + index + "]", "Each v2 leg must be a strict object."));
      canonicalNavigations.push(null);
      canonicalExpectedOdds.push(undefined);
      syntheticLegs.push({
        bookmaker: "",
        outcome: "",
        expectedOdds: "2",
        deepLink: "invalid:",
      });
      continue;
    }

    const bookmaker = normalizeBookmaker(raw.bookmaker);
    if (bookmaker !== null && !EXECUTABLE_BOOKMAKERS.has(bookmaker)) {
      errors.push(issue("UNSUPPORTED_BOOKMAKER", "legs[" + index + "].bookmaker", "No current application/adapter worker is registered for this bookmaker."));
    }
    const navigation = bookmaker === null
      ? null
      : directNavigationForV2(raw.navigation, bookmaker, "legs[" + index + "].navigation", errors);
    canonicalNavigations.push(navigation);

    const expectedOdds = raw.expectedOdds === undefined ? undefined : canonicalDecimal(raw.expectedOdds);
    if (raw.expectedOdds !== undefined && (expectedOdds === null || !isDecimalOdds(expectedOdds))) {
      errors.push(issue("INVALID_ODDS", "legs[" + index + "].expectedOdds", "When present, expected decimal odds must be greater than 1."));
    }
    const validExpectedOdds = expectedOdds !== null && expectedOdds !== undefined && isDecimalOdds(expectedOdds)
      ? expectedOdds
      : undefined;
    canonicalExpectedOdds.push(validExpectedOdds);

    syntheticLegs.push({
      bookmaker: raw.bookmaker,
      outcome: raw.outcome,
      // Frozen v1 validation is reused for common identity/freshness semantics.
      // A valid internal sentinel satisfies only v1's required wire-price field;
      // it is never emitted into the v2 canonical model or SelectionTarget.
      expectedOdds: validExpectedOdds ?? "2",
      deepLink: navigation?.url ?? "invalid:",
    });
  }

  const synthetic = {
    schemaVersion: DIRECT_PAIR_SCHEMA_VERSION,
    notificationId: input.notificationId,
    sentAt: input.sentAt,
    event: input.event,
    market: input.market,
    legs: syntheticLegs,
  };
  const base = normalizeDirectPairNotificationV1(synthetic, options);
  if (!base.ok) errors.push(...base.errors);

  if (canonicalNavigations.length === 2) {
    const first = canonicalNavigations[0];
    const second = canonicalNavigations[1];
    if (
      first?.kind === "betup-relay"
      && second?.kind === "betup-relay"
      && first.signalId !== second.signalId
    ) {
      errors.push(issue("RELAY_SIGNAL_MISMATCH", "legs", "Two relay legs in one pair must carry the same normalized signal UUID."));
    }
  }

  if (!base.ok || errors.length > 0) return { ok: false, errors };

  const firstNavigation = canonicalNavigations[0];
  const secondNavigation = canonicalNavigations[1];
  if (firstNavigation === null || firstNavigation === undefined || secondNavigation === null || secondNavigation === undefined) {
    return { ok: false, errors: [issue("INVALID_NAVIGATION", "legs", "Both v2 legs require valid typed navigation.")] };
  }

  const legFor = (
    leg: DirectPairLegV1,
    navigation: CanonicalDirectPairLegV2["navigation"],
    expectedOdds: string | undefined,
  ): CanonicalDirectPairLegV2 => ({
    bookmaker: leg.bookmaker,
    outcome: leg.outcome,
    ...(expectedOdds === undefined ? {} : { expectedOdds }),
    navigation,
  });
  const canonicalLegs: readonly [CanonicalDirectPairLegV2, CanonicalDirectPairLegV2] = [
    legFor(base.value.canonical.legs[0], firstNavigation, canonicalExpectedOdds[0]),
    legFor(base.value.canonical.legs[1], secondNavigation, canonicalExpectedOdds[1]),
  ];
  const canonical: CanonicalDirectPairV2 = {
    schemaVersion: DIRECT_PAIR_SCHEMA_VERSION_V2,
    notificationId: base.value.canonical.notificationId,
    sentAt: base.value.canonical.sentAt,
    event: base.value.canonical.event,
    market: base.value.canonical.market,
    legs: canonicalLegs,
  };

  const targetFor = (
    leg: CanonicalDirectPairLegV2,
    index: 0 | 1,
  ): SelectionTarget => {
    const navigation: NavigationTarget = leg.navigation.kind === "bookmaker-direct"
      ? { kind: "BOOKMAKER_DIRECT", url: leg.navigation.url }
      : {
          kind: "BETUP_RELAY",
          url: leg.navigation.url,
          signalId: leg.navigation.signalId,
          bookmaker: leg.navigation.bookmaker,
        };
    return {
      id: "structured-v2-target-" + (index + 1),
      bookmaker: leg.bookmaker,
      event: base.value.canonical.event,
      market: {
        family: "total",
        context: "corners",
        period: base.value.canonical.market.period,
        line: base.value.canonical.market.line,
        sourceLabel: base.value.canonical.market.sourceLabel,
      },
      outcome: {
        side: leg.outcome,
        sourceLabel: leg.outcome.toLocaleUpperCase("en-US"),
      },
      ...(leg.expectedOdds === undefined ? {} : { expectedOdds: leg.expectedOdds }),
      navigation,
      provenance: {
        kind: "structured-direct-pair",
        schemaVersion: DIRECT_PAIR_SCHEMA_VERSION_V2,
        notificationId: base.value.canonical.notificationId,
        legIndex: index,
      },
    };
  };
  const targets: readonly [SelectionTarget, SelectionTarget] = [
    targetFor(canonicalLegs[0], 0),
    targetFor(canonicalLegs[1], 1),
  ];
  const plan: ExecutionPlan = {
    id: "direct-pair-v2:" + canonical.notificationId + ":" + Date.parse(canonical.sentAt).toString(36),
    notificationId: canonical.notificationId,
    recommendedOptionId: "direct-pair-v2",
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
    legs: [
      { id: "leg-1", target: targets[0] },
      { id: "leg-2", target: targets[1] },
    ],
  };
  return { ok: true, value: { canonical, plan } };
}

export function normalizeDirectPairNotification(
  input: unknown,
  options: DirectPairNormalizationOptions = {},
): StructuredDirectPairNormalizationResult {
  if (!isRecord(input) || typeof input.schemaVersion !== "string") {
    return { ok: false, errors: [issue("INVALID_SCHEMA", "schemaVersion", "Structured notification must declare an exact schemaVersion.")] };
  }
  if (input.schemaVersion === DIRECT_PAIR_SCHEMA_VERSION) {
    return normalizeDirectPairNotificationV1(input, options);
  }
  if (input.schemaVersion === DIRECT_PAIR_SCHEMA_VERSION_V2) {
    return normalizeDirectPairNotificationV2(input, options);
  }
  return {
    ok: false,
    errors: [issue("UNSUPPORTED_SCHEMA_VERSION", "schemaVersion", "Unsupported structured notification schema version.")],
  };
}
