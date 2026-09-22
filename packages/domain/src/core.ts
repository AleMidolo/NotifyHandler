export type BookmakerId =
  | "sisal"
  | "bet365"
  | "lottomatica"
  | "eplay24"
  | "admiralbet";

export type SportId = "football";
export type MarketFamily = "total";
export type MarketSubtype = "over_under";
export type MarketPeriod = "full_match";
export type OutcomeSide = "over" | "under";
export type DecimalString = string;

export type DomainErrorCode =
  | "EMPTY_NOTIFICATION"
  | "MISSING_EVENT"
  | "INVALID_EVENT"
  | "CONFLICTING_FIELD"
  | "INVALID_DATE_TIME"
  | "UNSUPPORTED_MARKET"
  | "MISSING_MARKET_LINE"
  | "MISSING_OUTCOME_OFFERS"
  | "INVALID_OUTCOME"
  | "INVALID_ODDS"
  | "DUPLICATE_OFFER"
  | "MALFORMED_DEEP_LINK"
  | "MISSING_RECOMMENDATION"
  | "INVALID_RECOMMENDATION"
  | "UNSUPPORTED_BOOKMAKER"
  | "UNKNOWN_RECOMMENDATION_OFFER"
  | "AMBIGUOUS_RECOMMENDATION"
  | "INCONSISTENT_RECOMMENDATION_ODDS"
  | "INCONSISTENT_RECOMMENDATION_LINE"
  | "RECOMMENDATION_NOT_FOUND"
  | "DUPLICATE_PLAN_LEGS"
  | "INVALID_CREATED_AT";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly field?: string;
  readonly section?: string;
  readonly source?: string;
}

export type DomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly DomainError[] };

export interface ScheduledEventTime {
  readonly sourceText: string;
  readonly localDateTime: string;
  readonly sourceUtcOffsetMinutes?: number;
  readonly instant?: string;
}

export interface EventIdentity {
  readonly participantA: string;
  readonly participantB: string;
  readonly canonicalDisplay: string;
}

export interface NormalizedMarket {
  readonly family: MarketFamily;
  readonly subtype: MarketSubtype;
  readonly period: MarketPeriod;
  readonly context: "corners";
  readonly line: DecimalString;
  readonly sourceLabel: string;
}

export interface BookmakerOffer {
  readonly id: string;
  readonly side: OutcomeSide;
  readonly bookmaker?: BookmakerId;
  readonly bookmakerLabel: string;
  readonly expectedOdds: DecimalString;
  readonly oddsDisplay: string;
  readonly deepLink?: string;
  readonly sourceLabel: string;
}

export interface SuggestedStake {
  readonly offerId: string;
  readonly amount: DecimalString;
  readonly currency: "EUR";
  readonly sourceDisplay: string;
}

export interface RecommendedOptionLeg {
  readonly side: OutcomeSide;
  readonly bookmaker: BookmakerId;
  readonly offerId: string;
  readonly expectedOdds?: DecimalString;
  readonly sourceDisplay: string;
}

export interface RecommendedOption {
  readonly id: string;
  readonly legs: readonly [RecommendedOptionLeg, RecommendedOptionLeg];
  readonly suggestedStakes?: readonly SuggestedStake[];
  readonly sourceLabel: string;
}

export interface SurebetNotification {
  readonly id: string;
  readonly sourceText: string;
  readonly sport: SportId;
  readonly signalRoi?: DecimalString;
  readonly event: EventIdentity;
  readonly competition?: string;
  readonly scheduledAt?: ScheduledEventTime;
  readonly market: NormalizedMarket;
  readonly outcomeGroups: readonly [
    { readonly side: "over"; readonly offers: readonly BookmakerOffer[] },
    { readonly side: "under"; readonly offers: readonly BookmakerOffer[] },
  ];
  readonly recommendedOptions: readonly RecommendedOption[];
}

export type NavigationTarget =
  | Readonly<{
      kind: "BOOKMAKER_DIRECT";
      url: string;
    }>
  | Readonly<{
      kind: "BETUP_RELAY";
      url: string;
      signalId: string;
      bookmaker: BookmakerId;
    }>;

export interface SelectionTarget {
  readonly id: string;
  readonly bookmaker: BookmakerId;
  readonly event: Readonly<{
    participantA: string;
    participantB: string;
    competition?: string;
    scheduledAt?: string;
    sourceDisplay: string;
  }>;
  readonly market: Readonly<{
    family: MarketFamily;
    context: string;
    period: MarketPeriod;
    line: DecimalString;
    sourceLabel: string;
  }>;
  readonly outcome: Readonly<{
    side: OutcomeSide;
    sourceLabel?: string;
  }>;
  readonly expectedOdds: DecimalString;
  readonly navigation?: NavigationTarget;
  /** Deprecated v1/legacy compatibility projection. V2 uses navigation. */
  readonly deepLink?: string;
  readonly provenance: Readonly<
    | {
        /** Optional until all legacy fixture constructors are migrated. */
        kind?: "legacy-recommendation";
        notificationOptionId: string;
        sourceOfferId: string;
      }
    | {
        kind: "structured-direct-pair";
        schemaVersion: "notifyhandler.direct-pair.v1" | "notifyhandler.direct-pair.v2";
        notificationId: string;
        legIndex: 0 | 1;
      }
  >;
}

export interface ExecutionPlan {
  readonly id: string;
  readonly notificationId: string;
  readonly recommendedOptionId: string;
  readonly createdAt: string;
  readonly legs: readonly [
    { readonly id: string; readonly target: SelectionTarget },
    { readonly id: string; readonly target: SelectionTarget },
  ];
}

export interface ParseOptions {
  /**
   * Optional explicit source offset. The parser never assumes the host timezone.
   * Example: Europe/Rome during CEST can be supplied as 120 by the caller after
   * resolving the source timezone policy outside this transport-neutral parser.
   */
  readonly sourceUtcOffsetMinutes?: number;
}

const BOOKMAKER_ALIASES: Readonly<Record<string, BookmakerId>> = Object.freeze({
  SISAL: "sisal",
  BET365: "bet365",
  "BET 365": "bet365",
  LOTTOMATICA: "lottomatica",
  EPLAY24: "eplay24",
  "EPLAY 24": "eplay24",
  ADMIRALBET: "admiralbet",
  "ADMIRAL BET": "admiralbet",
});

const RECOMMENDATION_HEADERS = new Set([
  "OPZIONI CONSIGLIATE",
  "OPZIONI RACCOMANDATE",
  "OPZIONE CONSIGLIATA",
  "OPZIONE RACCOMANDATA",
]);

const LABEL_ALIASES: Readonly<Record<string, "event" | "competition" | "dateTime" | "market">> = Object.freeze({
  EVENTO: "event",
  EVENT: "event",
  COMPETIZIONE: "competition",
  COMPETITION: "competition",
  "DATA E ORA": "dateTime",
  "DATA/ORA": "dateTime",
  "DATE AND TIME": "dateTime",
  MERCATO: "market",
  MARKET: "market",
});

function fail<T>(errors: readonly DomainError[]): DomainResult<T> {
  return { ok: false, errors };
}

function error(
  code: DomainErrorCode,
  message: string,
  details: { field?: string; section?: string; source?: string } = {},
): DomainError {
  return { code, message, ...details };
}

function unicodeNormalize(value: string): string {
  return value.normalize("NFC").replace(/\u00a0/g, " ");
}

function stripPresentation(value: string): string {
  return unicodeNormalize(value)
    .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/giu, "$1 $2")
    .replace(/[*_`~]/g, "")
    .replace(/^\s*[•·▪▫◦‣⁃*-]+\s*/u, "")
    .replace(/^\s*[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/gu, "")
    .replace(/[\t ]+/g, " ")
    .trim();
}

function normalizedHeader(value: string): string {
  return stripPresentation(value)
    .replace(/[:：]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("it-IT");
}

function normalizeBookmakerLabel(value: string): string {
  return unicodeNormalize(value)
    .replace(/[*_`~\[\]()]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("en-US");
}

export function normalizeBookmaker(value: string): BookmakerId | undefined {
  return BOOKMAKER_ALIASES[normalizeBookmakerLabel(value)];
}

function canonicalDecimal(raw: string): DecimalString | undefined {
  const value = raw.trim();
  if (!/^\d+(?:[.,]\d+)?$/u.test(value)) return undefined;
  if (value.includes(",") && value.includes(".")) return undefined;
  const normalized = value.replace(",", ".");
  const [integerRaw, fractionRaw] = normalized.split(".");
  if (integerRaw === undefined) return undefined;
  const integer = integerRaw.replace(/^0+(?=\d)/u, "") || "0";
  const fraction = fractionRaw?.replace(/0+$/u, "") ?? "";
  return fraction.length > 0 ? `${integer}.${fraction}` : integer;
}

function isPositiveDecimal(value: string): boolean {
  const [integer = "0", fraction = ""] = value.split(".");
  return /[1-9]/u.test(integer) || /[1-9]/u.test(fraction);
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseRoi(source: string): DecimalString | undefined {
  const match = source.match(/\bROI\s*:\s*(\d+(?:[.,]\d+)?)\s*%/iu);
  return match?.[1] ? canonicalDecimal(match[1]) : undefined;
}

function splitLabel(line: string): { key: string; value: string } | undefined {
  const cleaned = stripPresentation(line);
  const match = cleaned.match(/^([^:：]{2,40})[:：]\s*(.+)$/u);
  if (!match?.[1] || !match[2]) return undefined;
  return { key: normalizedHeader(match[1]), value: match[2].trim() };
}

function collectScalarFields(lines: readonly string[]): {
  values: Partial<Record<"event" | "competition" | "dateTime" | "market", string>>;
  errors: DomainError[];
} {
  const values: Partial<Record<"event" | "competition" | "dateTime" | "market", string>> = {};
  const errors: DomainError[] = [];

  for (const line of lines) {
    const pair = splitLabel(line);
    if (!pair) continue;
    const field = LABEL_ALIASES[pair.key];
    if (!field) continue;
    const existing = values[field];
    if (existing !== undefined && unicodeNormalize(existing).trim() !== unicodeNormalize(pair.value).trim()) {
      errors.push(
        error("CONFLICTING_FIELD", `Conflicting values were supplied for ${field}.`, {
          field,
          source: stripPresentation(line),
        }),
      );
      continue;
    }
    values[field] = pair.value;
  }

  return { values, errors };
}

function parseEvent(raw: string | undefined): DomainResult<EventIdentity> {
  if (!raw) {
    return fail([error("MISSING_EVENT", "The notification does not contain an event.", { field: "event" })]);
  }
  const source = stripPresentation(raw);
  const participants = source.split(/\s+[-–—]\s+/u).map((value) => value.trim()).filter(Boolean);
  if (participants.length !== 2 || !participants[0] || !participants[1]) {
    return fail([
      error("INVALID_EVENT", "Event must contain exactly two participants separated by a spaced dash.", {
        field: "event",
        source,
      }),
    ]);
  }
  return {
    ok: true,
    value: {
      participantA: participants[0],
      participantB: participants[1],
      canonicalDisplay: `${participants[0]} - ${participants[1]}`,
    },
  };
}

function parseDateTime(raw: string | undefined, options: ParseOptions): DomainResult<ScheduledEventTime | undefined> {
  if (!raw) return { ok: true, value: undefined };
  const sourceText = stripPresentation(raw);
  const match = sourceText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–—]\s*(\d{1,2}):(\d{2})$/u);
  if (!match) {
    return fail([
      error("INVALID_DATE_TIME", "Date/time must use DD/MM/YYYY - HH:mm.", {
        field: "scheduledAt",
        source: sourceText,
      }),
    ]);
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const valid =
    year >= 2000 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    probe.getUTCHours() === hour &&
    probe.getUTCMinutes() === minute;

  if (!valid) {
    return fail([
      error("INVALID_DATE_TIME", "Date/time is not a valid calendar value.", {
        field: "scheduledAt",
        source: sourceText,
      }),
    ]);
  }

  const localDateTime = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const offset = options.sourceUtcOffsetMinutes;
  if (offset === undefined) {
    return { ok: true, value: { sourceText, localDateTime } };
  }
  if (!Number.isInteger(offset) || offset < -14 * 60 || offset > 14 * 60) {
    return fail([
      error("INVALID_DATE_TIME", "Configured sourceUtcOffsetMinutes must be an integer between -840 and 840.", {
        field: "sourceUtcOffsetMinutes",
      }),
    ]);
  }
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60_000).toISOString();
  return { ok: true, value: { sourceText, localDateTime, sourceUtcOffsetMinutes: offset, instant } };
}

function parseMarket(raw: string | undefined): DomainResult<NormalizedMarket> {
  if (!raw) {
    return fail([error("UNSUPPORTED_MARKET", "The notification does not contain a supported market.", { field: "market" })]);
  }
  const sourceLabel = stripPresentation(raw);
  const explicitPeriod = /(?:\b(?:FIRST|SECOND)\s+HALF\b|\b(?:1ST|2ND)\s+HALF\b|\b[12]H\b|\b[12]T\b|\b(?:PRIMO|SECONDO)\s+TEMPO\b|\b[12](?:°|º)?\s+TEMPO\b)/iu;
  if (explicitPeriod.test(sourceLabel)) {
    return fail([
      error("UNSUPPORTED_MARKET", "Explicit non-full-match market periods are not supported by the legacy notification grammar.", {
        field: "market.period",
        source: sourceLabel,
      }),
    ]);
  }
  const totalCorners = sourceLabel.match(/^(?:U\s*\/\s*O|OVER\s*\/\s*UNDER|TOTAL)\s+CORNERS?\s*(.*)$/iu);
  if (!totalCorners) {
    return fail([
      error("UNSUPPORTED_MARKET", "Only total corners over/under is supported by the initial domain taxonomy.", {
        field: "market",
        source: sourceLabel,
      }),
    ]);
  }
  const lineText = totalCorners[1]?.trim() ?? "";
  if (!lineText) {
    return fail([
      error("MISSING_MARKET_LINE", "A numeric line is required for total corners over/under.", {
        field: "market.line",
        source: sourceLabel,
      }),
    ]);
  }
  const line = canonicalDecimal(lineText);
  if (!line || !isPositiveDecimal(line)) {
    return fail([
      error("MISSING_MARKET_LINE", "The total corners line must be a positive decimal value.", {
        field: "market.line",
        source: sourceLabel,
      }),
    ]);
  }
  return {
    ok: true,
    value: {
      family: "total",
      subtype: "over_under",
      period: "full_match",
      context: "corners",
      line,
      sourceLabel,
    },
  };
}

function outcomeHeader(line: string): OutcomeSide | undefined {
  const header = normalizedHeader(line);
  if (/^ESITO\s+OVER$/u.test(header) || header === "OVER") return "over";
  if (/^ESITO\s+UNDER$/u.test(header) || header === "UNDER") return "under";
  return undefined;
}

function isRecommendationHeader(line: string): boolean {
  return RECOMMENDATION_HEADERS.has(normalizedHeader(line));
}

function extractUrl(line: string): DomainResult<string | undefined> {
  const markdown = line.match(/\[[^\]]+\]\(([^)]+)\)/u)?.[1];
  const raw = markdown ?? line.match(/https?:\/\/[^\s)>\]]+/iu)?.[0];
  if (!raw) return { ok: true, value: undefined };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported protocol");
    return { ok: true, value: parsed.toString() };
  } catch {
    return fail([
      error("MALFORMED_DEEP_LINK", "Bookmaker deep link is not a valid HTTP(S) URL.", {
        field: "deepLink",
        source: stripPresentation(line),
      }),
    ]);
  }
}

function findBookmakerInLine(line: string): { bookmaker?: BookmakerId; label: string } | undefined {
  const markdownLabel = line.match(/\[([^\]]+)\]\([^)]+\)/u)?.[1];
  if (markdownLabel) {
    const bookmaker = normalizeBookmaker(markdownLabel);
    return { ...(bookmaker ? { bookmaker } : {}), label: stripPresentation(markdownLabel) };
  }

  const cleaned = stripPresentation(line);
  const beforeAt = cleaned.split(/\s+@\s+/u)[0]?.trim() ?? "";
  const withoutUrl = beforeAt.replace(/https?:\/\/\S+/giu, "").trim();
  for (const [alias, id] of Object.entries(BOOKMAKER_ALIASES)) {
    const pattern = new RegExp(`^${alias.replace(/ /g, "\\s+")}(?:\\s|$)`, "iu");
    if (pattern.test(normalizeBookmakerLabel(withoutUrl))) {
      return { bookmaker: id, label: withoutUrl.match(/^\S+(?:\s+\S+)?/u)?.[0] ?? alias };
    }
  }
  const token = withoutUrl.match(/^[\p{L}\p{N}][\p{L}\p{N} _-]*/u)?.[0]?.trim();
  return token ? { label: token } : undefined;
}

function parseOffer(line: string, side: OutcomeSide, ordinal: number): DomainResult<BookmakerOffer> {
  const sourceLabel = stripPresentation(line);
  const bookmakerInfo = findBookmakerInLine(line);
  if (!bookmakerInfo?.label) {
    return fail([
      error("UNSUPPORTED_BOOKMAKER", "Offer does not contain a recognizable bookmaker label.", {
        section: `outcome.${side}`,
        source: sourceLabel,
      }),
    ]);
  }

  const oddsMatch = sourceLabel.match(/@\s*(\d+(?:[.,]\d+)?)/u);
  if (!oddsMatch?.[1]) {
    return fail([
      error("INVALID_ODDS", "Offer must contain decimal odds introduced by @.", {
        field: "expectedOdds",
        section: `outcome.${side}`,
        source: sourceLabel,
      }),
    ]);
  }
  const expectedOdds = canonicalDecimal(oddsMatch[1]);
  if (!expectedOdds || !isPositiveDecimal(expectedOdds)) {
    return fail([
      error("INVALID_ODDS", "Expected odds must be a positive decimal value.", {
        field: "expectedOdds",
        section: `outcome.${side}`,
        source: sourceLabel,
      }),
    ]);
  }
  const url = extractUrl(line);
  if (!url.ok) return url;

  const bookmakerKey = bookmakerInfo.bookmaker ?? normalizeBookmakerLabel(bookmakerInfo.label).replace(/\s+/g, "-").toLocaleLowerCase("en-US");
  const id = `offer-${side}-${bookmakerKey}-${ordinal}`;
  return {
    ok: true,
    value: {
      id,
      side,
      ...(bookmakerInfo.bookmaker ? { bookmaker: bookmakerInfo.bookmaker } : {}),
      bookmakerLabel: bookmakerInfo.label,
      expectedOdds,
      oddsDisplay: oddsMatch[1],
      ...(url.value ? { deepLink: url.value } : {}),
      sourceLabel,
    },
  };
}

function collectOffers(lines: readonly string[]): DomainResult<{
  over: readonly BookmakerOffer[];
  under: readonly BookmakerOffer[];
  recommendationLines: readonly string[];
}> {
  let section: OutcomeSide | "recommendations" | undefined;
  const over: BookmakerOffer[] = [];
  const under: BookmakerOffer[] = [];
  const recommendationLines: string[] = [];
  const errors: DomainError[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const outcome = outcomeHeader(trimmed);
    if (outcome) {
      section = outcome;
      continue;
    }
    if (isRecommendationHeader(trimmed)) {
      section = "recommendations";
      continue;
    }
    const scalarLabel = splitLabel(trimmed);
    if (scalarLabel && LABEL_ALIASES[scalarLabel.key]) continue;
    if (/^(?:SEGNALE\s+SUREBET|SUREBET\s+SIGNAL)/iu.test(stripPresentation(trimmed))) continue;
    if (/^[━─=_-]{3,}$/u.test(stripPresentation(trimmed))) continue;

    if (section === "recommendations") {
      recommendationLines.push(trimmed);
      continue;
    }
    if (section === "over" || section === "under") {
      if (!/@\s*\d/u.test(stripPresentation(trimmed))) continue;
      const target = section === "over" ? over : under;
      const parsed = parseOffer(trimmed, section, target.length + 1);
      if (parsed.ok) target.push(parsed.value);
      else errors.push(...parsed.errors);
    }
  }

  if (over.length === 0) {
    errors.push(error("MISSING_OUTCOME_OFFERS", "No executable OVER offers were found.", { section: "outcome.over" }));
  }
  if (under.length === 0) {
    errors.push(error("MISSING_OUTCOME_OFFERS", "No executable UNDER offers were found.", { section: "outcome.under" }));
  }

  const seen = new Map<string, BookmakerOffer>();
  for (const offer of [...over, ...under]) {
    if (!offer.bookmaker) continue;
    const key = `${offer.side}:${offer.bookmaker}`;
    const prior = seen.get(key);
    if (prior) {
      errors.push(
        error("DUPLICATE_OFFER", `Multiple offers exist for ${offer.bookmaker} ${offer.side}; deterministic recommendation resolution would be ambiguous.`, {
          section: `outcome.${offer.side}`,
          source: `${prior.sourceLabel} | ${offer.sourceLabel}`,
        }),
      );
    } else {
      seen.set(key, offer);
    }
  }

  return errors.length > 0 ? fail(errors) : { ok: true, value: { over, under, recommendationLines } };
}

function extractStake(rawLeg: string): { amount: DecimalString; sourceDisplay: string } | undefined {
  const labelled = rawLeg.match(/(?:PUNTATA|STAKE|IMPORTO)\s*[:=]?\s*(?:€\s*)?(\d+(?:[.,]\d+)?)(?:\s*€|\s*EUR)?/iu);
  const currencyPrefix = rawLeg.match(/€\s*(\d+(?:[.,]\d+)?)/iu);
  const currencySuffix = rawLeg.match(/(\d+(?:[.,]\d+)?)\s*(?:€|EUR)\b/iu);
  const raw = labelled?.[1] ?? currencyPrefix?.[1] ?? currencySuffix?.[1];
  if (!raw) return undefined;
  const amount = canonicalDecimal(raw);
  if (!amount || !isPositiveDecimal(amount)) return undefined;
  return { amount, sourceDisplay: raw };
}

function parseRecommendationLeg(
  rawLeg: string,
  market: NormalizedMarket,
  offers: readonly BookmakerOffer[],
): DomainResult<{ leg: RecommendedOptionLeg; stake?: SuggestedStake }> {
  const sourceDisplay = stripPresentation(rawLeg);
  const outcomeMatches = [...sourceDisplay.matchAll(/\b(OVER|UNDER)\b/giu)];
  if (outcomeMatches.length !== 1 || !outcomeMatches[0]?.[1]) {
    return fail([
      error("INVALID_RECOMMENDATION", "Each recommended leg must contain exactly one OVER or UNDER outcome.", {
        section: "recommendedOptions",
        source: sourceDisplay,
      }),
    ]);
  }
  const side = outcomeMatches[0][1].toLocaleLowerCase("en-US") as OutcomeSide;
  const outcomeIndex = outcomeMatches[0].index ?? 0;
  const bookmakerText = sourceDisplay.slice(0, outcomeIndex).replace(/^(?:\d+[.)]\s*)/u, "").trim();
  const bookmaker = normalizeBookmaker(bookmakerText);
  if (!bookmaker) {
    return fail([
      error("UNSUPPORTED_BOOKMAKER", "Recommended option uses an unsupported or non-canonical bookmaker name.", {
        section: "recommendedOptions",
        source: sourceDisplay,
      }),
    ]);
  }

  const afterOutcome = sourceDisplay.slice(outcomeIndex + outcomeMatches[0][0].length);
  const explicitOddsMatch = afterOutcome.match(/@\s*(\d+(?:[.,]\d+)?)/u);
  const explicitOdds = explicitOddsMatch?.[1] ? canonicalDecimal(explicitOddsMatch[1]) : undefined;
  if (explicitOddsMatch?.[1] && (!explicitOdds || !isPositiveDecimal(explicitOdds))) {
    return fail([
      error("INVALID_ODDS", "Recommended option contains invalid explicit odds.", {
        field: "recommendedOptions.expectedOdds",
        source: sourceDisplay,
      }),
    ]);
  }

  const remainderWithoutOdds = afterOutcome.replace(/@\s*\d+(?:[.,]\d+)?/u, " ");
  const remainderWithoutStake = remainderWithoutOdds
    .replace(/(?:PUNTATA|STAKE|IMPORTO)\s*[:=]?\s*(?:€\s*)?\d+(?:[.,]\d+)?(?:\s*€|\s*EUR)?/giu, " ")
    .replace(/€\s*\d+(?:[.,]\d+)?/giu, " ")
    .replace(/\d+(?:[.,]\d+)?\s*(?:€|EUR)\b/giu, " ");
  const possibleLine = remainderWithoutStake.match(/\b(\d+(?:[.,]\d+)?)\b/u)?.[1];
  if (possibleLine) {
    const normalizedLine = canonicalDecimal(possibleLine);
    if (normalizedLine !== market.line) {
      return fail([
        error("INCONSISTENT_RECOMMENDATION_LINE", "Recommended option line conflicts with the normalized market line.", {
          field: "recommendedOptions.line",
          source: sourceDisplay,
        }),
      ]);
    }
  }

  const matches = offers.filter((offer) => offer.side === side && offer.bookmaker === bookmaker);
  if (matches.length === 0) {
    return fail([
      error("UNKNOWN_RECOMMENDATION_OFFER", "Recommended option references a bookmaker/outcome offer not present in the notification.", {
        section: "recommendedOptions",
        source: sourceDisplay,
      }),
    ]);
  }
  if (matches.length > 1) {
    return fail([
      error("AMBIGUOUS_RECOMMENDATION", "Recommended option resolves to multiple source offers.", {
        section: "recommendedOptions",
        source: sourceDisplay,
      }),
    ]);
  }
  const offer = matches[0];
  if (!offer) {
    return fail([error("UNKNOWN_RECOMMENDATION_OFFER", "Recommended offer could not be resolved.")]);
  }
  if (explicitOdds && explicitOdds !== offer.expectedOdds) {
    return fail([
      error("INCONSISTENT_RECOMMENDATION_ODDS", "Recommended option odds conflict with the source offer odds.", {
        field: "recommendedOptions.expectedOdds",
        source: sourceDisplay,
      }),
    ]);
  }

  const stakeInfo = extractStake(sourceDisplay);
  const stake = stakeInfo
    ? { offerId: offer.id, amount: stakeInfo.amount, currency: "EUR" as const, sourceDisplay: stakeInfo.sourceDisplay }
    : undefined;
  return {
    ok: true,
    value: {
      leg: {
        side,
        bookmaker,
        offerId: offer.id,
        ...(explicitOdds ? { expectedOdds: explicitOdds } : {}),
        sourceDisplay,
      },
      ...(stake ? { stake } : {}),
    },
  };
}

function parseRecommendations(
  lines: readonly string[],
  market: NormalizedMarket,
  offers: readonly BookmakerOffer[],
): DomainResult<readonly RecommendedOption[]> {
  if (lines.length === 0) {
    return fail([
      error("MISSING_RECOMMENDATION", "The notification does not contain any recommended pair.", {
        section: "recommendedOptions",
      }),
    ]);
  }
  const options: RecommendedOption[] = [];
  const errors: DomainError[] = [];

  for (const rawLine of lines) {
    const sourceLabel = stripPresentation(rawLine).replace(/^\d+[.)]\s*/u, "").trim();
    const parts = sourceLabel.split(/\s+\+\s+/u).map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      errors.push(
        error("INVALID_RECOMMENDATION", "A recommended option must contain exactly two legs separated by +.", {
          section: "recommendedOptions",
          source: sourceLabel,
        }),
      );
      continue;
    }
    const a = parseRecommendationLeg(parts[0], market, offers);
    const b = parseRecommendationLeg(parts[1], market, offers);
    if (!a.ok || !b.ok) {
      if (!a.ok) errors.push(...a.errors);
      if (!b.ok) errors.push(...b.errors);
      continue;
    }
    if (a.value.leg.offerId === b.value.leg.offerId) {
      errors.push(
        error("INVALID_RECOMMENDATION", "A recommended option cannot reference the same source offer twice.", {
          section: "recommendedOptions",
          source: sourceLabel,
        }),
      );
      continue;
    }
    if (a.value.leg.side === b.value.leg.side) {
      errors.push(
        error("INVALID_RECOMMENDATION", "Initial surebet pairs must contain one OVER and one UNDER leg.", {
          section: "recommendedOptions",
          source: sourceLabel,
        }),
      );
      continue;
    }
    const stakes = [a.value.stake, b.value.stake].filter((value): value is SuggestedStake => value !== undefined);
    options.push({
      id: `option-${options.length + 1}`,
      legs: [a.value.leg, b.value.leg],
      ...(stakes.length > 0 ? { suggestedStakes: stakes } : {}),
      sourceLabel,
    });
  }

  return errors.length > 0 ? fail(errors) : { ok: true, value: options };
}

export function parseSurebetNotification(sourceText: string, options: ParseOptions = {}): DomainResult<SurebetNotification> {
  const normalizedSource = unicodeNormalize(sourceText).trim();
  if (!normalizedSource) {
    return fail([error("EMPTY_NOTIFICATION", "Notification text is empty.")]);
  }
  const lines = normalizedSource.split(/\r?\n/u);
  const scalar = collectScalarFields(lines);
  const event = parseEvent(scalar.values.event);
  const scheduledAt = parseDateTime(scalar.values.dateTime, options);
  const market = parseMarket(scalar.values.market);
  const offers = collectOffers(lines);

  const errors: DomainError[] = [...scalar.errors];
  if (!event.ok) errors.push(...event.errors);
  if (!scheduledAt.ok) errors.push(...scheduledAt.errors);
  if (!market.ok) errors.push(...market.errors);
  if (!offers.ok) errors.push(...offers.errors);
  if (errors.length > 0 || !event.ok || !scheduledAt.ok || !market.ok || !offers.ok) return fail(errors);

  const allOffers = [...offers.value.over, ...offers.value.under];
  const recommendations = parseRecommendations(offers.value.recommendationLines, market.value, allOffers);
  if (!recommendations.ok) return recommendations;

  const signalRoi = parseRoi(normalizedSource);
  return {
    ok: true,
    value: {
      id: `notification-${fnv1a32(normalizedSource)}`,
      sourceText: normalizedSource,
      sport: "football",
      ...(signalRoi !== undefined ? { signalRoi } : {}),
      event: event.value,
      ...(scalar.values.competition ? { competition: stripPresentation(scalar.values.competition) } : {}),
      ...(scheduledAt.value ? { scheduledAt: scheduledAt.value } : {}),
      market: market.value,
      outcomeGroups: [
        { side: "over", offers: offers.value.over },
        { side: "under", offers: offers.value.under },
      ],
      recommendedOptions: recommendations.value,
    },
  };
}

function findOffer(notification: SurebetNotification, offerId: string): BookmakerOffer | undefined {
  for (const group of notification.outcomeGroups) {
    const found = group.offers.find((offer) => offer.id === offerId);
    if (found) return found;
  }
  return undefined;
}

function toSelectionTarget(
  notification: SurebetNotification,
  option: RecommendedOption,
  optionLeg: RecommendedOptionLeg,
  targetOrdinal: "a" | "b",
): DomainResult<SelectionTarget> {
  const offer = findOffer(notification, optionLeg.offerId);
  if (!offer || !offer.bookmaker) {
    return fail([
      error("UNKNOWN_RECOMMENDATION_OFFER", "The selected recommendation references an unavailable or unsupported offer.", {
        section: "recommendedOptions",
        source: optionLeg.sourceDisplay,
      }),
    ]);
  }
  return {
    ok: true,
    value: {
      id: `${notification.id}-${option.id}-target-${targetOrdinal}`,
      bookmaker: offer.bookmaker,
      event: {
        participantA: notification.event.participantA,
        participantB: notification.event.participantB,
        ...(notification.competition ? { competition: notification.competition } : {}),
        ...(notification.scheduledAt?.instant ? { scheduledAt: notification.scheduledAt.instant } : {}),
        sourceDisplay: notification.event.canonicalDisplay,
      },
      market: {
        family: notification.market.family,
        context: notification.market.context,
        period: notification.market.period,
        line: notification.market.line,
        sourceLabel: notification.market.sourceLabel,
      },
      outcome: { side: offer.side, sourceLabel: offer.side.toLocaleUpperCase("en-US") },
      expectedOdds: offer.expectedOdds,
      ...(offer.deepLink ? { deepLink: offer.deepLink } : {}),
      provenance: {
        kind: "legacy-recommendation",
        notificationOptionId: option.id,
        sourceOfferId: offer.id,
      },
    },
  };
}

function validUtcInstant(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export function buildExecutionPlan(
  notification: SurebetNotification,
  recommendedOptionId: string,
  createdAt: string,
): DomainResult<ExecutionPlan> {
  if (!validUtcInstant(createdAt)) {
    return fail([
      error("INVALID_CREATED_AT", "Execution plan createdAt must be an explicit ISO-8601 UTC instant.", {
        field: "createdAt",
        source: createdAt,
      }),
    ]);
  }
  const option = notification.recommendedOptions.find((candidate) => candidate.id === recommendedOptionId);
  if (!option) {
    return fail([
      error("RECOMMENDATION_NOT_FOUND", "Selected recommended option does not exist in the parsed notification.", {
        field: "recommendedOptionId",
        source: recommendedOptionId,
      }),
    ]);
  }
  if (option.legs.length !== 2) {
    return fail([
      error("INVALID_RECOMMENDATION", "Selected recommended option does not contain exactly two legs.", {
        field: "recommendedOptionId",
        source: recommendedOptionId,
      }),
    ]);
  }
  const targetA = toSelectionTarget(notification, option, option.legs[0], "a");
  const targetB = toSelectionTarget(notification, option, option.legs[1], "b");
  if (!targetA.ok || !targetB.ok) {
    return fail([
      ...(!targetA.ok ? targetA.errors : []),
      ...(!targetB.ok ? targetB.errors : []),
    ]);
  }
  const sourceOfferA = "sourceOfferId" in targetA.value.provenance
    ? targetA.value.provenance.sourceOfferId
    : undefined;
  const sourceOfferB = "sourceOfferId" in targetB.value.provenance
    ? targetB.value.provenance.sourceOfferId
    : undefined;
  if (
    (sourceOfferA !== undefined && sourceOfferA === sourceOfferB) ||
    (targetA.value.bookmaker === targetB.value.bookmaker &&
      targetA.value.outcome.side === targetB.value.outcome.side &&
      targetA.value.market.line === targetB.value.market.line)
  ) {
    return fail([
      error("DUPLICATE_PLAN_LEGS", "Execution plan contains duplicate contradictory legs.", {
        field: "legs",
      }),
    ]);
  }

  const planId = `plan-${fnv1a32(`${notification.id}|${option.id}|${createdAt}`)}`;
  return {
    ok: true,
    value: {
      id: planId,
      notificationId: notification.id,
      recommendedOptionId: option.id,
      createdAt,
      legs: [
        { id: `${planId}-leg-a`, target: targetA.value },
        { id: `${planId}-leg-b`, target: targetB.value },
      ],
    },
  };
}
