import assert from "node:assert/strict";
import test from "node:test";
import { AutomaticExecutionOrchestrator } from "../src/orchestrator.ts";
import type {
  BookmakerAutomationPort,
  CancelLegRequest,
  ContinueOddsRequest,
  ExecutionPreflightPort,
  LegExecutionRequest,
  WorkerLegEvent,
} from "../src/orchestrator.ts";

const canonical = `📊 **SEGNALE SUREBET (ROI: 3.53%)**
⚽️ **Evento:** ⚽️ Real Madrid - Rayo Vallecano
🏆 **Competizione:** La Liga
📅 **Data e Ora:** 12/09/2026 - 21:00
📝 **Mercato:** \`U/O CORNER 11.5\`
📝 **Esito OVER**:
• [SISAL](https://example.invalid/sisal/event/123) @ 2.90
• [LOTTOMATICA](https://example.invalid/lottomatica/event/123) @ 2.88
📝 **Esito UNDER**:
• [BET365](https://example.invalid/bet365/event/123) @ 1.61
• [EPLAY24](https://example.invalid/eplay24/event/123) @ 1.60
💡 **Opzioni consigliate**:
• SISAL OVER 11.5 + BET365 UNDER 11.5
• LOTTOMATICA OVER @ 2.88 + EPLAY24 UNDER @ 1.60`;

function event(request: LegExecutionRequest, state: WorkerLegEvent["state"]): WorkerLegEvent {
  return {
    legId: request.legId,
    attemptId: request.attemptId,
    evidenceEpoch: request.evidenceEpoch,
    state,
  };
}

function ready(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent> {
  const events: readonly WorkerLegEvent[] = [
    event(request, "OPENING"),
    event(request, "WAITING_FOR_PAGE"),
    event(request, "MATCHING_EVENT"),
    event(request, "MATCHING_MARKET"),
    event(request, "MATCHING_LINE"),
    event(request, "MATCHING_OUTCOME"),
    {
      ...event(request, "VERIFYING_ODDS"),
      odds: {
        expected: request.target.expectedOdds,
        observed: request.target.expectedOdds,
        comparison: "EQUAL",
      },
    },
    event(request, "ACTIVATING_SELECTION"),
    event(request, "VERIFYING_SELECTION"),
    event(request, "SELECTION_PREPARED"),
    event(request, "READY_FOR_USER"),
  ];
  return (async function* () {
    for (const item of events) yield item;
  })();
}

class ThrowingStartAutomation implements BookmakerAutomationPort {
  readonly starts: LegExecutionRequest[] = [];

  constructor(private readonly throwOnCalls: ReadonlySet<number>) {}

  start(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent> {
    this.starts.push(request);
    if (this.throwOnCalls.has(this.starts.length)) {
      throw new Error(`synchronous launch failure ${this.starts.length}`);
    }
    return ready(request);
  }

  resumeAfterManualAuth(request: LegExecutionRequest) { return ready(request); }
  continueWithObservedOdds(request: ContinueOddsRequest) { return ready(request); }
  retry(request: LegExecutionRequest) { return ready(request); }
  reopen(request: LegExecutionRequest) { return ready(request); }
  async cancel(_request: CancelLegRequest) {}
}

const approved: ExecutionPreflightPort = {
  async validate() { return { ok: true }; },
};

function app(worker: ThrowingStartAutomation): AutomaticExecutionOrchestrator {
  return new AutomaticExecutionOrchestrator(worker, approved, {
    sourceUtcOffsetMinutes: 120,
    now: () => new Date("2026-09-13T07:30:00.000Z"),
  });
}

test("first synchronous start failure is leg-local and the second leg still dispatches", async () => {
  const worker = new ThrowingStartAutomation(new Set([1]));
  const orchestrator = app(worker);

  await orchestrator.receiveNotification(canonical);
  assert.equal(worker.starts.length, 2);

  const state = await orchestrator.waitForIdle();
  assert.equal(state.status, "PARTIAL");
  assert.equal(state.legs?.[0].state, "FAILED_SAFE");
  assert.equal(state.legs?.[0].failure?.stage, "BROWSER_RUNTIME");
  assert.equal(state.legs?.[0].failure?.code, "BROWSER_LAUNCH_FAILED");
  assert.equal(state.legs?.[1].state, "READY_FOR_USER");
});

test("second synchronous start failure does not detach the already-running first task", async () => {
  const worker = new ThrowingStartAutomation(new Set([2]));
  const orchestrator = app(worker);

  await orchestrator.receiveNotification(canonical);
  assert.equal(worker.starts.length, 2);

  const state = await orchestrator.waitForIdle();
  assert.equal(state.status, "PARTIAL");
  assert.equal(state.legs?.[0].state, "READY_FOR_USER");
  assert.equal(state.legs?.[1].state, "FAILED_SAFE");
  assert.equal(state.legs?.[1].failure?.stage, "BROWSER_RUNTIME");
});

test("restart isolates a synchronous launch failure and tracks the unaffected restarted leg", async () => {
  const worker = new ThrowingStartAutomation(new Set([3]));
  const orchestrator = app(worker);

  await orchestrator.receiveNotification(canonical);
  let state = await orchestrator.waitForIdle();
  assert.equal(state.status, "READY_FOR_USER");
  const originalAttempts = state.legs?.map((leg) => leg.attemptId);

  await orchestrator.restartPlan();
  assert.equal(worker.starts.length, 4);
  state = await orchestrator.waitForIdle();

  assert.equal(state.status, "PARTIAL");
  assert.notDeepEqual(state.legs?.map((leg) => leg.attemptId), originalAttempts);
  assert.equal(state.legs?.[0].attemptNumber, 2);
  assert.equal(state.legs?.[1].attemptNumber, 2);
  assert.equal(state.legs?.[0].state, "FAILED_SAFE");
  assert.equal(state.legs?.[0].failure?.stage, "BROWSER_RUNTIME");
  assert.equal(state.legs?.[1].state, "READY_FOR_USER");
});
