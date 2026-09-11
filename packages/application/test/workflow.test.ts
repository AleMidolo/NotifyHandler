import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationWorkflow } from "../src/index.ts";

const canonical = `📊 **SEGNALE SUREBET (ROI: 3.53%)**
━━━━━━━━━━━━━━━━━━
⚽️ **Evento:** ⚽️ Real Madrid - Rayo Vallecano
🏆 **Competizione:** La Liga
📅 **Data e Ora:** 12/09/2026 - 21:00
📝 **Mercato:** \`U/O CORNER 11.5\`
━━━━━━━━━━━━━━━━━━
📝 **Esito OVER**:
   • 🔗 [SISAL](https://example.invalid/sisal/event/123) @ 2.90
   • 🔗 [LOTTOMATICA](https://example.invalid/lottomatica/event/123) @ 2.88
📝 **Esito UNDER**:
   • 🔗 [BET365](https://example.invalid/bet365/event/123) @ 1.61
   • 🔗 [EPLAY24](https://example.invalid/eplay24/event/123) @ 1.60
💡 **Opzioni consigliate**:
   • SISAL OVER 11.5 (Puntata: €100,00) + BET365 UNDER 11.5 (Puntata: €180,12)
   • LOTTOMATICA OVER @ 2.88 + EPLAY24 UNDER @ 1.60`;

const invalid = `Competizione: La Liga
Mercato: U/O CORNER 11.5
Esito OVER:
SISAL @ 2.90
Esito UNDER:
BET365 @ 1.61
Opzioni consigliate:
SISAL OVER + BET365 UNDER`;

function workflow(): ApplicationWorkflow {
  return new ApplicationWorkflow({
    sourceUtcOffsetMinutes: 120,
    now: () => new Date("2026-09-11T16:30:00.000Z"),
  });
}

test("valid input produces a normalized parsed preview before execution is enabled", () => {
  const app = workflow();
  const state = app.submitNotification(canonical);

  assert.equal(state.phase, "parsed");
  assert.equal(state.canStartExecution, false);
  assert.equal(state.errors.length, 0);
  assert.equal(state.preview?.event.display, "Real Madrid - Rayo Vallecano");
  assert.equal(state.preview?.event.competition, "La Liga");
  assert.equal(state.preview?.event.scheduledSource, "12/09/2026 - 21:00");
  assert.equal(state.preview?.event.scheduledInstant, "2026-09-12T19:00:00.000Z");
  assert.equal(state.preview?.market.sourceLabel, "U/O CORNER 11.5");
  assert.equal(state.preview?.market.line, "11.5");
  assert.equal(state.preview?.outcomes[0]?.offers[0]?.bookmakerLabel, "SISAL");
  assert.equal(state.preview?.outcomes[0]?.offers[0]?.expectedOdds, "2.9");
  assert.equal(state.preview?.recommendedOptions.length, 2);
  assert.deepEqual(
    state.preview?.recommendedOptions[0]?.legs.map((leg) => ({
      bookmaker: leg.bookmakerLabel,
      side: leg.side,
      line: leg.line,
      expectedOdds: leg.expectedOdds,
    })),
    [
      { bookmaker: "SISAL", side: "over", line: "11.5", expectedOdds: "2.9" },
      { bookmaker: "BET365", side: "under", line: "11.5", expectedOdds: "1.61" },
    ],
  );
  assert.deepEqual(
    state.preview?.recommendedOptions[0]?.suggestedStakes.map((stake) => stake.amount),
    ["100", "180.12"],
  );
});

test("invalid or ambiguous input cannot produce an executable plan", () => {
  const app = workflow();
  const state = app.submitNotification(invalid);

  assert.equal(state.phase, "invalid");
  assert.equal(state.canStartExecution, false);
  assert.equal(state.preview, null);
  assert.equal(state.executionPlan, null);
  assert.ok(state.errors.some((error) => error.code === "MISSING_EVENT"));
});

test("choosing a recommended pair resolves exactly two visible execution targets", () => {
  const app = workflow();
  app.submitNotification(canonical);
  const state = app.selectRecommendedOption("option-1");

  assert.equal(state.phase, "plan_ready");
  assert.equal(state.canStartExecution, true);
  assert.equal(state.selectedRecommendedOptionId, "option-1");
  assert.equal(state.executionPlan?.legs.length, 2);
  assert.equal(state.executionSummary?.legs.length, 2);
  assert.deepEqual(
    state.executionSummary?.legs.map((leg) => ({
      bookmaker: leg.bookmakerLabel,
      event: leg.event,
      competition: leg.competition,
      market: leg.market,
      line: leg.line,
      outcome: leg.outcome,
      expectedOdds: leg.expectedOdds,
    })),
    [
      {
        bookmaker: "SISAL",
        event: "Real Madrid - Rayo Vallecano",
        competition: "La Liga",
        market: "U/O CORNER 11.5",
        line: "11.5",
        outcome: "over",
        expectedOdds: "2.9",
      },
      {
        bookmaker: "BET365",
        event: "Real Madrid - Rayo Vallecano",
        competition: "La Liga",
        market: "U/O CORNER 11.5",
        line: "11.5",
        outcome: "under",
        expectedOdds: "1.61",
      },
    ],
  );
  assert.equal(state.executionSummary?.legs[0].scheduledSource, "12/09/2026 - 21:00");
  assert.equal(state.executionSummary?.legs[0].scheduledAt, "2026-09-12T19:00:00.000Z");

  const serializedPlan = JSON.stringify(state.executionPlan).toLocaleLowerCase("en-US");
  assert.equal(serializedPlan.includes("puntata"), false);
  assert.equal(serializedPlan.includes("stake"), false);
});

test("an unknown recommended option is rejected without retaining a stale plan", () => {
  const app = workflow();
  app.submitNotification(canonical);
  app.selectRecommendedOption("option-1");
  const state = app.selectRecommendedOption("option-does-not-exist");

  assert.equal(state.phase, "parsed");
  assert.equal(state.canStartExecution, false);
  assert.equal(state.selectedRecommendedOptionId, null);
  assert.equal(state.executionPlan, null);
  assert.equal(state.executionSummary, null);
  assert.ok(state.errors.some((error) => error.code === "RECOMMENDATION_NOT_FOUND"));
});

test("submitting new input clears the previous reviewed plan", () => {
  const app = workflow();
  app.submitNotification(canonical);
  app.selectRecommendedOption("option-1");

  const reparsed = app.submitNotification(canonical);
  assert.equal(reparsed.phase, "parsed");
  assert.equal(reparsed.canStartExecution, false);
  assert.equal(reparsed.selectedRecommendedOptionId, null);
  assert.equal(reparsed.executionPlan, null);
  assert.equal(reparsed.executionSummary, null);
});

test("selection is unavailable until a valid notification has been parsed", () => {
  const app = workflow();
  const state = app.selectRecommendedOption("option-1");

  assert.equal(state.phase, "awaiting_input");
  assert.equal(state.canStartExecution, false);
  assert.ok(state.errors.some((error) => error.code === "RECOMMENDATION_NOT_FOUND"));
});
