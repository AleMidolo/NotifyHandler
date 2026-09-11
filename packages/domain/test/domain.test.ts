import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExecutionPlan,
  parseSurebetNotification,
} from "../src/index.ts";
import {
  canonical,
  decoratedComma,
  duplicateOffer,
  conflictingEvent,
  inconsistentRecommendationLine,
  inconsistentRecommendationOdds,
  invalidDate,
  malformedLink,
  minimalValid,
  missingEvent,
  missingLine,
  missingRecommendation,
  noMarkdownWhitespace,
  unknownRecommendationOffer,
  unsupportedMarket,
  unsupportedRecommendedBookmaker,
} from "./fixtures.ts";

function expectError(source: string, code: string): void {
  const parsed = parseSurebetNotification(source);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.ok(parsed.errors.some((candidate) => candidate.code === code), `expected ${code}, got ${parsed.errors.map((e) => e.code).join(", ")}`);
  }
}

test("parses representative Italian notification and preserves deterministic normalized semantics", () => {
  const parsed = parseSurebetNotification(canonical, { sourceUtcOffsetMinutes: 120 });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.value.sport, "football");
  assert.equal(parsed.value.signalRoi, "3.53");
  assert.deepEqual(parsed.value.event, {
    participantA: "Real Madrid",
    participantB: "Rayo Vallecano",
    canonicalDisplay: "Real Madrid - Rayo Vallecano",
  });
  assert.equal(parsed.value.competition, "La Liga");
  assert.deepEqual(parsed.value.scheduledAt, {
    sourceText: "12/09/2026 - 21:00",
    localDateTime: "2026-09-12T21:00:00",
    sourceUtcOffsetMinutes: 120,
    instant: "2026-09-12T19:00:00.000Z",
  });
  assert.deepEqual(parsed.value.market, {
    family: "total",
    subtype: "over_under",
    context: "corners",
    line: "11.5",
    sourceLabel: "U/O CORNER 11.5",
  });
  assert.equal(parsed.value.outcomeGroups[0].offers.length, 2);
  assert.equal(parsed.value.outcomeGroups[1].offers.length, 2);
  assert.equal(parsed.value.outcomeGroups[0].offers[0]?.bookmaker, "sisal");
  assert.equal(parsed.value.outcomeGroups[0].offers[0]?.expectedOdds, "2.9");
  assert.equal(parsed.value.outcomeGroups[1].offers[0]?.bookmaker, "bet365");
  assert.equal(parsed.value.recommendedOptions.length, 2);
  assert.deepEqual(
    parsed.value.recommendedOptions[0]?.suggestedStakes?.map((stake) => [stake.amount, stake.currency]),
    [["100", "EUR"], ["180.12", "EUR"]],
  );

  const parsedAgain = parseSurebetNotification(canonical, { sourceUtcOffsetMinutes: 120 });
  assert.equal(parsedAgain.ok, true);
  if (parsedAgain.ok) assert.deepEqual(parsedAgain.value, parsed.value);
});

test("builds exactly two immutable bookmaker-agnostic selection targets and excludes stakes", () => {
  const parsed = parseSurebetNotification(canonical, { sourceUtcOffsetMinutes: 120 });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const plan = buildExecutionPlan(parsed.value, "option-1", "2026-09-11T14:30:00.000Z");
  assert.equal(plan.ok, true);
  if (!plan.ok) return;

  assert.equal(plan.value.legs.length, 2);
  assert.deepEqual(
    plan.value.legs.map((leg) => ({
      bookmaker: leg.target.bookmaker,
      outcome: leg.target.outcome.side,
      line: leg.target.market.line,
      expectedOdds: leg.target.expectedOdds,
    })),
    [
      { bookmaker: "sisal", outcome: "over", line: "11.5", expectedOdds: "2.9" },
      { bookmaker: "bet365", outcome: "under", line: "11.5", expectedOdds: "1.61" },
    ],
  );
  assert.equal(plan.value.legs[0].target.event.scheduledAt, "2026-09-12T19:00:00.000Z");
  assert.equal("suggestedStake" in plan.value.legs[0], false);
  assert.equal(JSON.stringify(plan.value).toLocaleLowerCase("en-US").includes("puntata"), false);
  assert.equal(JSON.stringify(plan.value).toLocaleLowerCase("en-US").includes("stake"), false);
});

test("tolerates documented presentation noise, decimal commas, reordered groups, aliases, apostrophes and accents", () => {
  const parsed = parseSurebetNotification(decoratedComma);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.event.participantA, "L'Aquila Calcio");
  assert.equal(parsed.value.event.participantB, "Città di Sant'Agata");
  assert.equal(parsed.value.signalRoi, "2.5");
  assert.equal(parsed.value.market.line, "10.5");
  assert.equal(parsed.value.outcomeGroups[0].offers[0]?.bookmaker, "eplay24");
  assert.equal(parsed.value.outcomeGroups[1].offers[0]?.bookmaker, "admiralbet");
  assert.equal(parsed.value.recommendedOptions.length, 2);
  assert.equal(parsed.value.recommendedOptions[0]?.suggestedStakes?.[0]?.amount, "75.5");
});

test("normalizes whitespace and equivalent explicitly-supported labels without Markdown", () => {
  const parsed = parseSurebetNotification(noMarkdownWhitespace);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.market.line, "11.5");
  assert.equal(parsed.value.outcomeGroups[1].offers[0]?.expectedOdds, "1.61");
});

test("accepts executable input when optional competition, date/time and deep links are absent", () => {
  const parsed = parseSurebetNotification(minimalValid);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.competition, undefined);
  assert.equal(parsed.value.scheduledAt, undefined);
  assert.equal(parsed.value.outcomeGroups[0].offers[0]?.deepLink, undefined);
  assert.equal(parsed.value.recommendedOptions.length, 1);
});

test("does not guess an event when it is missing", () => expectError(missingEvent, "MISSING_EVENT"));
test("requires a line for line-based total-corners markets", () => expectError(missingLine, "MISSING_MARKET_LINE"));
test("rejects unsupported market syntax", () => expectError(unsupportedMarket, "UNSUPPORTED_MARKET"));
test("rejects invalid calendar dates", () => expectError(invalidDate, "INVALID_DATE_TIME"));
test("rejects conflicting duplicate scalar fields", () => expectError(conflictingEvent, "CONFLICTING_FIELD"));
test("rejects notifications without a recommended pair", () => expectError(missingRecommendation, "MISSING_RECOMMENDATION"));
test("rejects malformed deep links rather than silently repairing them", () => expectError(malformedLink, "MALFORMED_DEEP_LINK"));
test("rejects a recommendation whose explicit odds conflict with its source offer", () => expectError(inconsistentRecommendationOdds, "INCONSISTENT_RECOMMENDATION_ODDS"));
test("rejects a recommendation whose line conflicts with the normalized market", () => expectError(inconsistentRecommendationLine, "INCONSISTENT_RECOMMENDATION_LINE"));
test("rejects a supported bookmaker recommendation when that source offer is absent", () => expectError(unknownRecommendationOffer, "UNKNOWN_RECOMMENDATION_OFFER"));
test("never fuzzy-maps an unsupported bookmaker referenced by a recommendation", () => expectError(unsupportedRecommendedBookmaker, "UNSUPPORTED_BOOKMAKER"));
test("rejects duplicate bookmaker/outcome offers because recommendation resolution would be ambiguous", () => expectError(duplicateOffer, "DUPLICATE_OFFER"));

test("does not assume the host timezone and only emits target scheduledAt when source offset is explicitly resolved", () => {
  const parsed = parseSurebetNotification(noMarkdownWhitespace);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.scheduledAt?.instant, undefined);
  const plan = buildExecutionPlan(parsed.value, "option-1", "2026-09-11T14:30:00Z");
  assert.equal(plan.ok, true);
  if (plan.ok) assert.equal(plan.value.legs[0].target.event.scheduledAt, undefined);
});

test("requires an explicit UTC creation instant when building a plan", () => {
  const parsed = parseSurebetNotification(noMarkdownWhitespace);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const plan = buildExecutionPlan(parsed.value, "option-1", "2026-09-11 14:30");
  assert.equal(plan.ok, false);
  if (!plan.ok) assert.equal(plan.errors[0]?.code, "INVALID_CREATED_AT");
});
