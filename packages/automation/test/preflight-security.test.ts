import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionPlan, SelectionTarget } from "../../domain/src/index.ts";
import { createWorkerExecutionPreflight } from "../src/worker-port.ts";

function target(
  bookmaker: "sisal" | "bet365",
  legIndex: 0 | 1,
  deepLink: string,
): SelectionTarget {
  return {
    id: `target-${bookmaker}`,
    bookmaker,
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-21T17:00:00.000Z",
      sourceDisplay: "Real Madrid - Rayo Vallecano",
    },
    market: { family: "total", context: "corners", line: "11.5", sourceLabel: "U/O CORNER 11.5" },
    outcome: { side: legIndex === 0 ? "over" : "under", sourceLabel: legIndex === 0 ? "OVER" : "UNDER" },
    expectedOdds: legIndex === 0 ? "2.90" : "1.61",
    deepLink,
    provenance: {
      kind: "structured-direct-pair",
      schemaVersion: "notifyhandler.direct-pair.v1",
      notificationId: "security-dns-001",
      legIndex,
    },
  };
}

function plan(): ExecutionPlan {
  return {
    id: "plan-security-dns",
    notificationId: "security-dns-001",
    recommendedOptionId: "structured-direct-pair",
    createdAt: "2026-09-21T17:00:00.000Z",
    legs: [
      { id: "leg-sisal", target: target("sisal", 0, "https://www.sisal.it/event") },
      { id: "leg-bet365", target: target("bet365", 1, "https://www.bet365.it/event") },
    ],
  };
}

test("structured preflight rejects a direct link when approved hostname resolves private", async () => {
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async (hostname) => hostname === "www.sisal.it" ? ["127.0.0.1"] : ["93.184.216.34"],
  }).validate(plan());

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
    assert.equal(result.failure.legId, "leg-sisal");
  }
});

test("structured preflight accepts exact origins when every resolved address is public", async () => {
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => ["93.184.216.34"],
  }).validate(plan());
  assert.deepEqual(result, { ok: true });
});

test("structured preflight fails closed on DNS resolution failure", async () => {
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => { throw new Error("resolver unavailable"); },
  }).validate(plan());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
});
