import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const invalidReplacement = `Competizione: La Liga
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

test("parser-to-plan integration maps the second recommendation to the exact two immutable targets", () => {
  const app = workflow();
  const parsed = app.submitNotification(canonical);
  assert.equal(parsed.phase, "parsed");
  assert.equal(parsed.canStartExecution, false);

  const state = app.selectRecommendedOption("option-2");
  assert.equal(state.phase, "plan_ready");
  assert.equal(state.canStartExecution, true);
  assert.equal(state.executionPlan?.legs.length, 2);

  const targets = state.executionPlan?.legs.map((leg) => leg.target);
  assert.deepEqual(
    targets?.map((target) => ({
      bookmaker: target.bookmaker,
      side: target.outcome.side,
      line: target.market.line,
      context: target.market.context,
      expectedOdds: target.expectedOdds,
      deepLink: target.deepLink,
    })),
    [
      {
        bookmaker: "lottomatica",
        side: "over",
        line: "11.5",
        context: "corners",
        expectedOdds: "2.88",
        deepLink: "https://example.invalid/lottomatica/event/123",
      },
      {
        bookmaker: "eplay24",
        side: "under",
        line: "11.5",
        context: "corners",
        expectedOdds: "1.6",
        deepLink: "https://example.invalid/eplay24/event/123",
      },
    ],
  );
  assert.notEqual(targets?.[0]?.bookmaker, targets?.[1]?.bookmaker);
  assert.notEqual(targets?.[0]?.provenance.sourceOfferId, targets?.[1]?.provenance.sourceOfferId);
});

test("invalid replacement input clears a previously reviewed executable plan", () => {
  const app = workflow();
  app.submitNotification(canonical);
  const ready = app.selectRecommendedOption("option-1");
  assert.equal(ready.canStartExecution, true);
  assert.notEqual(ready.executionPlan, null);

  const invalid = app.submitNotification(invalidReplacement);
  assert.equal(invalid.phase, "invalid");
  assert.equal(invalid.canStartExecution, false);
  assert.equal(invalid.selectedRecommendedOptionId, null);
  assert.equal(invalid.executionPlan, null);
  assert.equal(invalid.executionSummary, null);
  assert.equal(invalid.preview, null);
  assert.ok(invalid.errors.some((error) => error.code === "MISSING_EVENT"));
});

test("informational suggested stakes never cross into the executable plan or execution summary", () => {
  const app = workflow();
  const parsed = app.submitNotification(canonical);
  assert.deepEqual(
    parsed.preview?.recommendedOptions[0]?.suggestedStakes.map((stake) => stake.amount),
    ["100", "180.12"],
  );

  const state = app.selectRecommendedOption("option-1");
  const executable = JSON.stringify({ plan: state.executionPlan, summary: state.executionSummary }).toLocaleLowerCase("en-US");

  assert.equal(executable.includes("suggestedstakes"), false);
  assert.equal(executable.includes("puntata"), false);
  assert.equal(executable.includes("\"amount\""), false);
  assert.equal(executable.includes("\"currency\""), false);
});

test("public application workflow exposes no browser, authentication, stake-entry, or wager-submission operation", () => {
  const publicMethods = Object.getOwnPropertyNames(ApplicationWorkflow.prototype)
    .filter((name) => name !== "constructor");

  for (const method of publicMethods) {
    assert.doesNotMatch(
      method,
      /(credential|password|login|auth|mfa|otp|captcha|stake|placebet|submitbet|confirmbet|finalizebet|deposit|withdraw|cashout|browser|playwright|click|activate)/iu,
    );
  }

  const source = readFileSync(new URL("../src/workflow.ts", import.meta.url), "utf8").toLocaleLowerCase("en-US");
  assert.equal(source.includes("from \"playwright"), false);
  assert.equal(source.includes("from \"../../bookmakers"), false);
  assert.equal(source.includes("placebet"), false);
  assert.equal(source.includes("submitbet"), false);
  assert.equal(source.includes("setstake"), false);
  assert.equal(source.includes("enterstake"), false);
}
);