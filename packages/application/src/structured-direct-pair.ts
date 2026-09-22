import type {
  BookmakerId,
  ExecutionPlan,
  OutcomeSide,
  SelectionTarget,
} from "../../domain/src/index.ts";

export const DIRECT_PAIR_SCHEMA_VERSION = "notifyhandler.direct-pair.v1" as const;

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
      period: canonicalMarket.period,
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
