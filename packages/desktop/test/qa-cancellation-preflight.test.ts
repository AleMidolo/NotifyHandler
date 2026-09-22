import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionPlan, SelectionTarget } from "../../domain/src/index.ts";
import {
  createBookmakerAutomationWorker,
  createWorkerExecutionPreflight,
  type BookmakerLegSession,
  type LaunchBookmakerLegSessionOptions,
} from "../../automation/src/index.ts";

function target(overrides: Partial<SelectionTarget> = {}): SelectionTarget {
  return {
    id: "target-sisal",
    bookmaker: "sisal",
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-12T19:00:00.000Z",
      sourceDisplay: "Real Madrid - Rayo Vallecano",
    },
    market: { family: "total", context: "corners", period: "full_match", line: "11.5", sourceLabel: "U/O CORNER 11.5" },
    outcome: { side: "over", sourceLabel: "OVER" },
    expectedOdds: "2.08",
    deepLink: "https://www.sisal.it/event",
    provenance: { notificationOptionId: "option-1", sourceOfferId: "offer-sisal" },
    ...overrides,
  };
}

function plan(first: SelectionTarget): ExecutionPlan {
  return {
    id: "plan-qa",
    notificationId: "notification-qa",
    recommendedOptionId: "option-1",
    createdAt: "2026-09-13T09:45:00.000Z",
    legs: [
      { id: "leg-sisal", target: first },
      {
        id: "leg-bet365",
        target: {
          ...target(),
          id: "target-bet365",
          bookmaker: "bet365",
          outcome: { side: "under", sourceLabel: "UNDER" },
          expectedOdds: "1.95",
          deepLink: "https://www.bet365.it/event",
          provenance: { notificationOptionId: "option-1", sourceOfferId: "offer-bet365" },
        },
      },
    ],
  };
}

test("preflight rejects credential-bearing approved-origin URL before browser launch", async () => {
  const result = await createWorkerExecutionPreflight().validate(
    plan(target({ deepLink: "https://user:secret@www.sisal.it/event" })),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
});

test("cancel during OPENING prevents a pending session launch from becoming usable", async () => {
  let releaseLaunch!: () => void;
  const launchBlocked = new Promise<void>((resolve) => { releaseLaunch = resolve; });
  let launched = 0;
  let activated = false;

  const launcher = async (_options: LaunchBookmakerLegSessionOptions): Promise<BookmakerLegSession> => {
    launched += 1;
    await launchBlocked;
    return {
      bookmaker: "sisal",
      sessionId: "qa-delayed-session",
      createAttemptCapabilities() {
        return {
          browser: {
            async openAllowed() { return { ok: true }; },
            async currentLocation() { return { href: "https://www.sisal.it/event", origin: "https://www.sisal.it" }; },
            async waitForPageReady() { return { ready: true }; },
            async query(query) {
              if (query.kind === "event-candidate") return [{ id: "event" }];
              if (query.kind === "market-candidate") return [{ id: "market" }];
              if (query.kind === "outcome-candidate") return [{ id: "outcome" }];
              return [];
            },
            async readText() { return ""; },
            async readAttribute(_ref, name) {
              const values: Record<string, string> = {
                "data-event-participant-a": "Real Madrid",
                "data-event-participant-b": "Rayo Vallecano",
                "data-event-competition": "La Liga",
                "data-event-scheduled-at": "2026-09-12T19:05:00.000Z",
                "data-market-family": "total",
                "data-market-context": "corners",
                "data-market-period": "full_match",
                "data-market-line": "11.5",
                "data-outcome-side": "over",
                "data-odds": "2.08",
                "aria-pressed": activated ? "true" : "false",
              };
              return values[name] ?? null;
            },
            async isVisible() { return false; },
            async activateNavigationControl() { return { ok: false }; },
          },
          selectionGate: {
            async activate(request) {
              activated = true;
              return { kind: "ACTIVATED" as const, selection: { candidate: request.candidate } };
            },
          },
        };
      },
      async cancel() {},
      async close() {},
    };
  };

  const worker = createBookmakerAutomationWorker({ sessionLauncher: launcher });
  const request = {
    legId: "leg-sisal",
    attemptId: "attempt-1",
    evidenceEpoch: 0,
    target: target(),
  };
  const iterator = worker.start(request)[Symbol.asyncIterator]();
  const opening = await iterator.next();
  assert.equal(opening.value?.state, "OPENING");

  await worker.cancel({ legId: request.legId, attemptId: request.attemptId });
  releaseLaunch();
  for (;;) {
    const next = await iterator.next();
    if (next.done) break;
  }

  assert.equal(launched, 0);
  assert.equal(activated, false);
  await worker.closeAll();
});
