import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationCommandError, AutomaticExecutionOrchestrator } from "../src/orchestrator.ts";
import type {
  BookmakerAutomationPort, CancelLegRequest, ContinueOddsRequest, ExecutionPreflightPort,
  LegExecutionRequest, RuntimeFailure, WorkerLegEvent,
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
• SISAL OVER 11.5 (Puntata: €100,00) + BET365 UNDER 11.5 (Puntata: €180,12)
• LOTTOMATICA OVER @ 2.88 + EPLAY24 UNDER @ 1.60`;

type Command = "start" | "resume" | "continue" | "retry" | "reopen";
type Request = LegExecutionRequest | ContinueOddsRequest;

function failure(request: LegExecutionRequest, recoverability: RuntimeFailure["recoverability"] = "RETRY"): RuntimeFailure {
  return { code: "PAGE_LOAD_TIMEOUT", stage: "PAGE_READY", message: "fixture timeout", recoverability, activation: "NOT_ATTEMPTED", evidenceEpoch: request.evidenceEpoch };
}
function event(request: LegExecutionRequest, state: WorkerLegEvent["state"], extra: Partial<WorkerLegEvent> = {}): WorkerLegEvent {
  return { legId: request.legId, attemptId: request.attemptId, evidenceEpoch: request.evidenceEpoch, state, ...extra };
}
function ready(request: LegExecutionRequest): readonly WorkerLegEvent[] {
  return [
    event(request, "OPENING"), event(request, "WAITING_FOR_PAGE"), event(request, "MATCHING_EVENT"),
    event(request, "MATCHING_MARKET"), event(request, "MATCHING_LINE"), event(request, "MATCHING_OUTCOME"),
    event(request, "VERIFYING_ODDS", { odds: { expected: request.target.expectedOdds, observed: request.target.expectedOdds, comparison: "EQUAL" } }),
    event(request, "ACTIVATING_SELECTION"), event(request, "VERIFYING_SELECTION"), event(request, "SELECTION_PREPARED"), event(request, "READY_FOR_USER"),
  ];
}

class FakeAutomation implements BookmakerAutomationPort {
  readonly starts: LegExecutionRequest[] = [];
  readonly resumes: LegExecutionRequest[] = [];
  readonly continuations: ContinueOddsRequest[] = [];
  readonly retries: LegExecutionRequest[] = [];
  readonly reopens: LegExecutionRequest[] = [];
  readonly cancellations: CancelLegRequest[] = [];
  constructor(private readonly script: (command: Command, request: Request) => AsyncIterable<WorkerLegEvent> | readonly WorkerLegEvent[]) {}
  start(request: LegExecutionRequest) { this.starts.push(request); return this.async(this.script("start", request)); }
  resumeAfterManualAuth(request: LegExecutionRequest) { this.resumes.push(request); return this.async(this.script("resume", request)); }
  continueWithObservedOdds(request: ContinueOddsRequest) { this.continuations.push(request); return this.async(this.script("continue", request)); }
  retry(request: LegExecutionRequest) { this.retries.push(request); return this.async(this.script("retry", request)); }
  reopen(request: LegExecutionRequest) { this.reopens.push(request); return this.async(this.script("reopen", request)); }
  async cancel(request: CancelLegRequest) { this.cancellations.push(request); }
  private async(source: AsyncIterable<WorkerLegEvent> | readonly WorkerLegEvent[]): AsyncIterable<WorkerLegEvent> {
    if (Symbol.asyncIterator in Object(source)) return source as AsyncIterable<WorkerLegEvent>;
    return (async function* () { for (const item of source as readonly WorkerLegEvent[]) yield item; })();
  }
}

const approved: ExecutionPreflightPort = { async validate() { return { ok: true }; } };
function app(automation: FakeAutomation, preflight = approved): AutomaticExecutionOrchestrator {
  return new AutomaticExecutionOrchestrator(automation, preflight, {
    sourceUtcOffsetMinutes: 120,
    now: () => new Date("2026-09-11T18:30:00.000Z"),
  });
}

test("notification auto-resolves recommendation zero and dispatches exactly two legs with no user action", async () => {
  const worker = new FakeAutomation((_command, request) => ready(request));
  const orchestrator = app(worker);
  const started = await orchestrator.receiveNotification(canonical);
  assert.equal(started.plan?.recommendedOptionId, "option-1");
  assert.equal(worker.starts.length, 2);
  assert.deepEqual(worker.starts.map((request) => [request.target.bookmaker, request.target.outcome.side]), [["sisal", "over"], ["bet365", "under"]]);
  assert.equal(worker.starts.some((request) => request.target.bookmaker === "lottomatica"), false);
  const settled = await orchestrator.waitForIdle();
  assert.equal(settled.status, "READY_FOR_USER");
});

test("invalid input and preflight rejection cause zero starts and never fall through to option two", async () => {
  const worker = new FakeAutomation((_command, request) => ready(request));
  const orchestrator = app(worker);
  const invalid = await orchestrator.receiveNotification("Competizione: La Liga");
  assert.equal(invalid.status, "FAILED_SAFE");
  assert.equal(worker.starts.length, 0);

  const blocked = app(worker, { async validate(plan) {
    assert.equal(plan.recommendedOptionId, "option-1");
    return { ok: false, failure: { code: "UNSUPPORTED_BOOKMAKER", message: "primary bookmaker unsupported", legId: plan.legs[0].id } };
  } });
  const state = await blocked.receiveNotification(canonical);
  assert.equal(state.status, "PREFLIGHT_FAILED");
  assert.equal(state.plan?.recommendedOptionId, "option-1");
  assert.equal(worker.starts.length, 0);
});

test("partial failure keeps independent authoritative leg states", async () => {
  const worker = new FakeAutomation((_command, request) => request.target.bookmaker === "sisal"
    ? [event(request, "OPENING"), event(request, "WAITING_FOR_PAGE"), event(request, "FAILED_SAFE", { failure: failure(request) })]
    : ready(request));
  const orchestrator = app(worker);
  await orchestrator.receiveNotification(canonical);
  const state = await orchestrator.waitForIdle();
  assert.equal(state.status, "PARTIAL");
  assert.equal(state.legs?.[0].state, "FAILED_SAFE");
  assert.equal(state.legs?.[1].state, "READY_FOR_USER");
});

test("manual auth pauses only one leg and resume creates a fresh evidence epoch", async () => {
  const worker = new FakeAutomation((command, request) => request.target.bookmaker === "sisal" && command === "start"
    ? [event(request, "OPENING"), event(request, "WAITING_FOR_PAGE"), event(request, "AUTH_REQUIRED")]
    : ready(request));
  const orchestrator = app(worker);
  await orchestrator.receiveNotification(canonical);
  let state = await orchestrator.waitForIdle();
  assert.equal(state.legs?.[0].state, "AUTH_REQUIRED");
  assert.equal(state.legs?.[1].state, "READY_FOR_USER");
  const leg = state.legs?.[0];
  assert.ok(leg);
  state = await orchestrator.resumeAfterManualAuth(leg.legId);
  assert.equal(worker.resumes[0]?.evidenceEpoch, leg.evidenceEpoch + 1);
  assert.equal(state.status, "READY_FOR_USER");
});

test("odds change remains explicit and continuation requires exact observed value", async () => {
  const worker = new FakeAutomation((command, request) => request.target.bookmaker === "sisal" && command === "start"
    ? [
        event(request, "OPENING"), event(request, "WAITING_FOR_PAGE"), event(request, "MATCHING_EVENT"),
        event(request, "MATCHING_MARKET"), event(request, "MATCHING_LINE"), event(request, "MATCHING_OUTCOME"),
        event(request, "VERIFYING_ODDS"),
        event(request, "ODDS_CHANGED", { odds: { expected: request.target.expectedOdds, observed: "3.00", comparison: "HIGHER" } }),
      ]
    : ready(request));
  const orchestrator = app(worker);
  await orchestrator.receiveNotification(canonical);
  let state = await orchestrator.waitForIdle();
  const leg = state.legs?.[0];
  assert.ok(leg);
  assert.deepEqual(leg.observedOdds, { expected: "2.9", observed: "3.00", comparison: "HIGHER" });
  await assert.rejects(() => orchestrator.continueWithObservedOdds(leg.legId, "2.99"), ApplicationCommandError);
  assert.equal(worker.continuations.length, 0);
  state = await orchestrator.continueWithObservedOdds(leg.legId, "3.00");
  assert.equal(worker.continuations[0]?.acknowledgedObservedOdds, "3.00");
  assert.equal(state.status, "READY_FOR_USER");
});

test("retry uses a new attempt and late old-attempt events are ignored", async () => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  const worker = new FakeAutomation((command, request) => {
    if (request.target.bookmaker === "sisal" && command === "start") return (async function* () {
      yield event(request, "OPENING"); yield event(request, "WAITING_FOR_PAGE");
      yield event(request, "FAILED_SAFE", { failure: failure(request) });
      await delayed; yield event(request, "OPENING");
    })();
    return ready(request);
  });
  const orchestrator = app(worker);
  await orchestrator.receiveNotification(canonical);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const failed = orchestrator.getState().legs?.[0];
  assert.ok(failed);
  assert.equal(failed.state, "FAILED_SAFE");
  const retried = await orchestrator.retry(failed.legId);
  assert.notEqual(worker.retries[0]?.attemptId, failed.attemptId);
  assert.equal(retried.legs?.[0].state, "READY_FOR_USER");
  release();
  await orchestrator.waitForIdle();
  assert.equal(orchestrator.getState().legs?.[0].state, "READY_FOR_USER");
});

test("cancel is leg-local and blocks late events from reviving the cancelled attempt", async () => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  const worker = new FakeAutomation((_command, request) => request.target.bookmaker === "sisal"
    ? (async function* () { yield event(request, "OPENING"); await delayed; for (const next of ready(request).slice(1)) yield next; })()
    : ready(request));
  const orchestrator = app(worker);
  await orchestrator.receiveNotification(canonical);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const leg = orchestrator.getState().legs?.[0];
  assert.ok(leg);
  await orchestrator.cancel(leg.legId);
  assert.equal(orchestrator.getState().legs?.[0].state, "CANCELLED");
  assert.equal(orchestrator.getState().legs?.[1].state, "READY_FOR_USER");
  release(); await orchestrator.waitForIdle();
  assert.equal(orchestrator.getState().legs?.[0].state, "CANCELLED");
});

test("reopen and restart create fresh attempts while preserving the immutable primary plan", async () => {
  const worker = new FakeAutomation((command, request) => request.target.bookmaker === "sisal" && command === "start"
    ? [event(request, "OPENING"), event(request, "WAITING_FOR_PAGE"), event(request, "FAILED_SAFE", { failure: failure(request, "REOPEN") })]
    : ready(request));
  const orchestrator = app(worker);
  await orchestrator.receiveNotification(canonical);
  let state = await orchestrator.waitForIdle();
  const failed = state.legs?.[0];
  assert.ok(failed);
  state = await orchestrator.reopen(failed.legId);
  assert.notEqual(state.legs?.[0].attemptId, failed.attemptId);
  const beforeRestart = state.legs?.map((leg) => leg.attemptId);
  await orchestrator.restartPlan();
  state = await orchestrator.waitForIdle();
  assert.equal(state.plan?.recommendedOptionId, "option-1");
  assert.notDeepEqual(state.legs?.map((leg) => leg.attemptId), beforeRestart);
  assert.equal(worker.starts.length, 4);
});

test("worker crash becomes safe failure and a stalled renderer observer never gates dispatch", async () => {
  const worker = new FakeAutomation((_command, request) => request.target.bookmaker === "sisal"
    ? (async function* () { yield event(request, "OPENING"); throw new Error("fixture browser disconnected"); })()
    : ready(request));
  const never = new Promise<void>(() => undefined);
  const orchestrator = new AutomaticExecutionOrchestrator(worker, approved, {
    sourceUtcOffsetMinutes: 120,
    now: () => new Date("2026-09-11T18:30:00.000Z"),
    onStateChange: () => never,
  });
  await orchestrator.receiveNotification(canonical);
  assert.equal(worker.starts.length, 2);
  const state = await orchestrator.waitForIdle();
  assert.equal(state.legs?.[0].state, "FAILED_SAFE");
  assert.equal(state.legs?.[0].failure?.stage, "BROWSER_RUNTIME");
  assert.equal(state.legs?.[1].state, "READY_FOR_USER");
}
);
