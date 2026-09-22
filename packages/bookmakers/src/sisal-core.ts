import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  AdapterObserver,
  AdapterTerminalResult,
  BookmakerAdapter,
  ElementRef,
  EventEvidence,
  MatchingEvidenceSnapshot,
  SafeFailure,
} from "./contracts.ts";
import { compareOdds, evidence, matched, normalizeIdentityText, sameDecimal } from "./matching.ts";

const SISAL_ORIGIN = "https://www.sisal.it";
const DEFAULT_ENTRY = `${SISAL_ORIGIN}/scommesse-matchpoint/sport/calcio`;

function cancelled(signal: AbortSignal): AdapterTerminalResult | undefined {
  return signal.aborted ? { kind: "CANCELLED" } : undefined;
}

function failure(
  ctx: AdapterExecutionContext,
  code: SafeFailure["code"],
  stage: SafeFailure["stage"],
  message: string,
  recoverability: SafeFailure["recoverability"] = "USER_REVIEW",
  activation: SafeFailure["activation"] = "NOT_ATTEMPTED",
): Extract<AdapterTerminalResult, { readonly kind: "FAILED_SAFE" }> {
  return {
    kind: "FAILED_SAFE",
    failure: { code, stage, message, recoverability, activation, evidenceEpoch: ctx.evidenceEpoch },
  };
}

function blankEventEvidence(): EventEvidence {
  return {
    participants: evidence("NOT_CHECKED", "EVENT_PARTICIPANTS_NOT_CHECKED"),
    competition: evidence("NOT_CHECKED", "EVENT_COMPETITION_NOT_CHECKED"),
    scheduledTime: evidence("NOT_CHECKED", "EVENT_TIME_NOT_CHECKED"),
    overall: evidence("NOT_CHECKED", "EVENT_NOT_CHECKED"),
  };
}

function baseEvidence(epoch: number): MatchingEvidenceSnapshot {
  return {
    evidenceEpoch: epoch,
    origin: evidence("NOT_CHECKED", "ORIGIN_NOT_CHECKED"),
    event: blankEventEvidence(),
    market: evidence("NOT_CHECKED", "MARKET_NOT_CHECKED"),
    line: evidence("NOT_CHECKED", "LINE_NOT_CHECKED"),
    outcome: evidence("NOT_CHECKED", "OUTCOME_NOT_CHECKED"),
  };
}

function withEvidence(
  current: MatchingEvidenceSnapshot,
  patch: Partial<Omit<MatchingEvidenceSnapshot, "evidenceEpoch">>,
): MatchingEvidenceSnapshot {
  return { ...current, ...patch };
}

async function attr(ctx: AdapterExecutionContext, ref: ElementRef, name: string): Promise<string | null> {
  return ctx.browser.readAttribute(ref, name);
}

function exactText(target: string, observed: string | null): boolean {
  return observed !== null && normalizeIdentityText(target) === normalizeIdentityText(observed);
}

function timeWithin15Minutes(targetIso: string, observedIso: string | null): boolean | undefined {
  if (observedIso === null) return undefined;
  const target = Date.parse(targetIso);
  const observed = Date.parse(observedIso);
  if (!Number.isFinite(target) || !Number.isFinite(observed)) return false;
  return Math.abs(target - observed) <= 15 * 60 * 1000;
}

export class SisalAdapter implements BookmakerAdapter {
  readonly bookmaker = "sisal" as const;
  readonly supportedOrigins = [SISAL_ORIGIN] as const;

  async prepare(
    ctx: AdapterExecutionContext,
    target: SelectionTarget,
    observer: AdapterObserver,
    signal: AbortSignal,
  ): Promise<AdapterTerminalResult> {
    if (target.bookmaker !== this.bookmaker) {
      return failure(ctx, "UNSUPPORTED_BOOKMAKER", "PLAN", "SISAL adapter received a target for another bookmaker.", "RESTART_PLAN");
    }
    const stopped = cancelled(signal);
    if (stopped) return stopped;

    const url = target.deepLink ?? DEFAULT_ENTRY;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return failure(ctx, "UNSAFE_OR_UNSUPPORTED_URL", "NAVIGATION", "SISAL navigation URL is malformed.", "RESTART_PLAN");
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      !this.supportedOrigins.includes(parsed.origin as (typeof this.supportedOrigins)[number])
    ) {
      return failure(ctx, "UNSAFE_OR_UNSUPPORTED_URL", "NAVIGATION", "SISAL navigation URL must use the approved HTTPS origin without embedded credentials.", "RESTART_PLAN");
    }
    if (!(await ctx.browser.openAllowed(parsed.href)).ok) {
      return failure(ctx, "UNSAFE_OR_UNSUPPORTED_URL", "NAVIGATION", "Browser worker rejected SISAL navigation.", "REOPEN");
    }
    if (cancelled(signal)) return { kind: "CANCELLED" };
    const ready = await ctx.browser.waitForPageReady({ timeoutMs: 15_000 });
    if (!ready.ready) return failure(ctx, "PAGE_LOAD_TIMEOUT", "PAGE_READY", "SISAL page did not reach a supported ready state.", "RETRY");

    const location = await ctx.browser.currentLocation();
    if (!this.supportedOrigins.includes(location.origin as (typeof this.supportedOrigins)[number])) {
      return failure(ctx, "BLOCKED_REDIRECT", "NAVIGATION", "SISAL navigation redirected to an unapproved origin.", "RESTART_PLAN");
    }

    let snapshot = withEvidence(baseEvidence(ctx.evidenceEpoch), {
      origin: matched("SISAL_ORIGIN_MATCHED", SISAL_ORIGIN, [location.origin]),
    });
    observer.onEvidence?.(snapshot);

    const authWalls = await ctx.browser.query({ kind: "auth-wall" });
    for (const wall of authWalls) {
      if (await ctx.browser.isVisible(wall)) return { kind: "AUTH_REQUIRED", safeLocation: location };
    }
    if (cancelled(signal)) return { kind: "CANCELLED" };

    const eventCandidates = await ctx.browser.query({ kind: "event-candidate" });
    if (eventCandidates.length === 0) return failure(ctx, "EVENT_NOT_FOUND", "EVENT", "No SISAL event candidates were available.", "RETRY");

    const targetA = normalizeIdentityText(target.event.participantA);
    const targetB = normalizeIdentityText(target.event.participantB);
    const eligibleEvents: ElementRef[] = [];
    const participantObserved: string[] = [];
    let participantMatches = 0;
    let contextUnavailable = false;

    for (const candidate of eventCandidates) {
      const a = await attr(ctx, candidate, "data-event-participant-a");
      const b = await attr(ctx, candidate, "data-event-participant-b");
      if (a !== null && b !== null) participantObserved.push(`${normalizeIdentityText(a)}|${normalizeIdentityText(b)}`);
      if (a === null || b === null || normalizeIdentityText(a) !== targetA || normalizeIdentityText(b) !== targetB) continue;
      participantMatches += 1;

      const competition = await attr(ctx, candidate, "data-event-competition");
      const scheduledAt = await attr(ctx, candidate, "data-event-scheduled-at");
      let contextMatched = target.event.competition === undefined && target.event.scheduledAt === undefined;
      let contradiction = false;

      if (target.event.competition !== undefined && competition !== null) {
        if (exactText(target.event.competition, competition)) contextMatched = true;
        else contradiction = true;
      }
      if (target.event.scheduledAt !== undefined && scheduledAt !== null) {
        const timeMatch = timeWithin15Minutes(target.event.scheduledAt, scheduledAt);
        if (timeMatch === true) contextMatched = true;
        else if (timeMatch === false) contradiction = true;
      }
      if (
        !contradiction &&
        !contextMatched &&
        (target.event.competition !== undefined || target.event.scheduledAt !== undefined) &&
        competition === null &&
        scheduledAt === null
      ) {
        contextUnavailable = true;
      }
      if (!contradiction && contextMatched) eligibleEvents.push(candidate);
    }

    if (eligibleEvents.length === 0) {
      if (contextUnavailable && participantMatches > 0) return failure(ctx, "EVENT_CONTEXT_UNAVAILABLE", "EVENT", "SISAL event context required by the target is unavailable.");
      return failure(ctx, "EVENT_MISMATCH", "EVENT", "SISAL event identity did not match the target.");
    }
    if (eligibleEvents.length > 1) return failure(ctx, "EVENT_AMBIGUOUS", "EVENT", "More than one SISAL event matched the target.");

    const eventRef = eligibleEvents[0]!;
    const competitionObserved = await attr(ctx, eventRef, "data-event-competition");
    const timeObserved = await attr(ctx, eventRef, "data-event-scheduled-at");
    const eventEvidence: EventEvidence = {
      participants: matched("EVENT_PARTICIPANTS_MATCHED", `${targetA}|${targetB}`, participantObserved),
      competition:
        target.event.competition === undefined
          ? matched("EVENT_COMPETITION_NOT_REQUIRED")
          : competitionObserved === null
            ? evidence("UNAVAILABLE", "EVENT_COMPETITION_UNAVAILABLE", normalizeIdentityText(target.event.competition))
            : matched("EVENT_COMPETITION_MATCHED", normalizeIdentityText(target.event.competition), [normalizeIdentityText(competitionObserved)]),
      scheduledTime:
        target.event.scheduledAt === undefined
          ? matched("EVENT_TIME_NOT_REQUIRED")
          : timeObserved === null
            ? evidence("UNAVAILABLE", "EVENT_TIME_UNAVAILABLE", target.event.scheduledAt)
            : matched("EVENT_TIME_MATCHED", target.event.scheduledAt, [timeObserved]),
      overall: matched("EVENT_MATCHED", target.event.sourceDisplay, [eventRef.id]),
    };
    snapshot = withEvidence(snapshot, { event: eventEvidence });
    observer.onEvidence?.(snapshot);

    const markets = await ctx.browser.query({ kind: "market-candidate", within: eventRef });
    const familyContextMatches: ElementRef[] = [];
    const periodMatches: ElementRef[] = [];
    const exactLineMatches: ElementRef[] = [];
    let periodUnavailable = false;
    for (const market of markets) {
      const family = await attr(ctx, market, "data-market-family");
      const context = await attr(ctx, market, "data-market-context");
      if (!exactText(target.market.family, family) || !exactText(target.market.context, context)) continue;
      familyContextMatches.push(market);

      const period = await attr(ctx, market, "data-market-period");
      if (period === null) {
        periodUnavailable = true;
        continue;
      }
      if (!exactText(target.market.period, period)) continue;
      periodMatches.push(market);

      const line = await attr(ctx, market, "data-market-line");
      if (line !== null && sameDecimal(target.market.line, line)) exactLineMatches.push(market);
    }
    if (familyContextMatches.length === 0) return failure(ctx, "MARKET_NOT_FOUND", "MARKET", "Requested SISAL market family/context was not found.");
    if (periodMatches.length === 0) {
      if (periodUnavailable) return failure(ctx, "MARKET_CONTEXT_UNAVAILABLE", "MARKET", "Requested SISAL market period evidence was unavailable.");
      return failure(ctx, "MARKET_MISMATCH", "MARKET", "Requested SISAL market period did not match; period substitution is not allowed.");
    }
    if (exactLineMatches.length === 0) return failure(ctx, "LINE_MISMATCH", "LINE", "Requested SISAL market line was not available; neighboring lines are not accepted.");
    if (exactLineMatches.length > 1) return failure(ctx, "LINE_AMBIGUOUS", "LINE", "Multiple SISAL market candidates matched the exact requested line.");

    const marketRef = exactLineMatches[0]!;
    snapshot = withEvidence(snapshot, {
      market: matched("MARKET_MATCHED", `${normalizeIdentityText(target.market.family)}|${normalizeIdentityText(target.market.context)}|${normalizeIdentityText(target.market.period)}`, [marketRef.id]),
      line: matched("LINE_MATCHED", target.market.line, [await attr(ctx, marketRef, "data-market-line") ?? ""]),
    });
    observer.onEvidence?.(snapshot);

    const outcomes = await ctx.browser.query({ kind: "outcome-candidate", within: marketRef });
    const matchingOutcomes: ElementRef[] = [];
    for (const outcome of outcomes) {
      const side = await attr(ctx, outcome, "data-outcome-side");
      if (side !== null && normalizeIdentityText(side) === normalizeIdentityText(target.outcome.side)) matchingOutcomes.push(outcome);
    }
    if (matchingOutcomes.length === 0) return failure(ctx, "OUTCOME_NOT_FOUND", "OUTCOME", "Requested SISAL outcome side was not found.");
    if (matchingOutcomes.length > 1) return failure(ctx, "OUTCOME_AMBIGUOUS", "OUTCOME", "Multiple SISAL outcomes matched the requested side.");

    const outcomeRef = matchingOutcomes[0]!;
    snapshot = withEvidence(snapshot, {
      outcome: matched("OUTCOME_MATCHED", normalizeIdentityText(target.outcome.side), [outcomeRef.id]),
    });
    observer.onEvidence?.(snapshot);

    const odds = compareOdds(target.expectedOdds, await attr(ctx, outcomeRef, "data-odds"));
    if (!odds) return { ...failure(ctx, "ODDS_INVALID", "ODDS", "SISAL displayed odds could not be parsed."), evidence: snapshot };
    if (odds.comparison === "UNAVAILABLE") return { ...failure(ctx, "ODDS_UNAVAILABLE", "ODDS", "SISAL displayed odds are unavailable."), evidence: snapshot, odds };
    if (odds.comparison !== "EQUAL" && ctx.acknowledgedObservedOdds === undefined) {
      return { kind: "ODDS_CHANGED", evidence: snapshot, odds };
    }
    if (
      odds.comparison !== "EQUAL" &&
      (odds.observed === undefined || !sameDecimal(odds.observed, ctx.acknowledgedObservedOdds ?? ""))
    ) {
      return { kind: "ODDS_CHANGED", evidence: snapshot, odds };
    }
    if (cancelled(signal)) return { kind: "CANCELLED" };

    const activation = await ctx.selectionGate.activate({
      target,
      candidate: outcomeRef,
      evidence: snapshot,
      odds,
      ...(ctx.acknowledgedObservedOdds === undefined ? {} : { acknowledgedObservedOdds: ctx.acknowledgedObservedOdds }),
    });
    if (activation.kind === "REJECTED") return { ...failure(ctx, "SELECTION_ACTIVATION_REJECTED", "SELECTION_ACTIVATION", `Selection gate rejected SISAL activation: ${activation.reasonCode}.`, "RETRY"), evidence: snapshot, odds };
    if (activation.kind === "FAILED") return { ...failure(ctx, "SELECTION_ACTIVATION_FAILED", "SELECTION_ACTIVATION", `SISAL selection activation failed: ${activation.reasonCode}.`, "USER_REVIEW"), evidence: snapshot, odds };

    const selected = await attr(ctx, outcomeRef, "aria-pressed");
    if (selected !== "true") {
      return {
        kind: "FAILED_SAFE",
        failure: {
          code: "SELECTION_VERIFICATION_FAILED",
          stage: "SELECTION_VERIFICATION",
          message: "SISAL outcome activation occurred but selected state could not be verified.",
          recoverability: "USER_REVIEW",
          activation: "ATTEMPTED_NOT_VERIFIED",
          evidenceEpoch: ctx.evidenceEpoch,
        },
        evidence: snapshot,
        odds,
      };
    }
    return { kind: "READY_FOR_USER", evidence: snapshot, odds, selection: activation.selection };
  }
}
