import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AutomaticExecutionOrchestrator } from "../../application/src/orchestrator.ts";
import type {
  BookmakerAutomationPort,
  CancelLegRequest,
  ExecutionPreflightPort,
  LegExecutionRequest,
  RuntimeFailure,
  WorkerLegEvent,
} from "../../application/src/orchestrator.ts";
import { DesktopAppController, DesktopControllerError } from "../src/controller.ts";
import { parseDesktopRecoveryCommand } from "../src/ipc-contract.ts";
import { toRendererModel } from "../renderer/model.js";

const notification = `📊 **SEGNALE SUREBET (ROI: 3.53%)**
⚽️ **Evento:** ⚽️ Real Madrid - Rayo Vallecano
🏆 **Competizione:** La Liga
📅 **Data e Ora:** 12/09/2026 - 21:00
📝 **Mercato:** \`U/O CORNER 11.5\`
📝 **Esito OVER**:
• [SISAL](https://example.invalid/sisal/event/123) @ 2.90
📝 **Esito UNDER**:
• [BET365](https://example.invalid/bet365/event/123) @ 1.61
💡 **Opzioni consigliate**:
• SISAL OVER 11.5 + BET365 UNDER 11.5`;

type CommandName = "start" | "resume" | "retry" | "reopen";
type Request = LegExecutionRequest;

function event(request: LegExecutionRequest, state: WorkerLegEvent["state"], extra: Partial<WorkerLegEvent> = {}): WorkerLegEvent {
  return { legId: request.legId, attemptId: request.attemptId, evidenceEpoch: request.evidenceEpoch, state, ...extra };
}

function ready(request: LegExecutionRequest): readonly WorkerLegEvent[] {
  return [
    event(request, "OPENING"),
    event(request, "WAITING_FOR_PAGE"),
    event(request, "MATCHING_EVENT"),
    event(request, "MATCHING_MARKET"),
    event(request, "MATCHING_LINE"),
    event(request, "MATCHING_OUTCOME"),
    event(request, "ACTIVATING_SELECTION", { odds: { ...(request.target.expectedOdds === undefined ? {} : { expected: request.target.expectedOdds }), ...(request.target.expectedOdds === undefined ? {} : { observed: request.target.expectedOdds }), comparison: request.target.expectedOdds === undefined ? "UNAVAILABLE" : "EQUAL" } }),
    event(request, "VERIFYING_SELECTION"),
    event(request, "SELECTION_PREPARED"),
    event(request, "READY_FOR_USER"),
  ];
}

function failure(request: LegExecutionRequest, recoverability: RuntimeFailure["recoverability"] = "RETRY"): RuntimeFailure {
  return {
    code: "PAGE_LOAD_TIMEOUT",
    stage: "PAGE_READY",
    message: "fixture timeout",
    recoverability,
    activation: "NOT_ATTEMPTED",
    evidenceEpoch: request.evidenceEpoch,
  };
}

class FakeAutomation implements BookmakerAutomationPort {
  readonly starts: LegExecutionRequest[] = [];
  readonly resumes: LegExecutionRequest[] = [];
  readonly retries: LegExecutionRequest[] = [];
  readonly reopens: LegExecutionRequest[] = [];
  readonly cancellations: CancelLegRequest[] = [];

  constructor(private readonly script: (command: CommandName, request: Request) => readonly WorkerLegEvent[]) {}

  start(request: LegExecutionRequest) { this.starts.push(request); return this.stream(this.script("start", request)); }
  resumeAfterManualAuth(request: LegExecutionRequest) { this.resumes.push(request); return this.stream(this.script("resume", request)); }
  retry(request: LegExecutionRequest) { this.retries.push(request); return this.stream(this.script("retry", request)); }
  reopen(request: LegExecutionRequest) { this.reopens.push(request); return this.stream(this.script("reopen", request)); }
  async cancel(request: CancelLegRequest) { this.cancellations.push(request); }

  private async *stream(items: readonly WorkerLegEvent[]) {
    for (const item of items) yield item;
  }
}

const approved: ExecutionPreflightPort = { async validate() { return { ok: true }; } };

function harness(script: (command: CommandName, request: Request) => readonly WorkerLegEvent[]) {
  const worker = new FakeAutomation(script);
  let controller: DesktopAppController | undefined;
  let clock = 1_000;
  const orchestrator = new AutomaticExecutionOrchestrator(worker, approved, {
    sourceUtcOffsetMinutes: 120,
    now: () => new Date("2026-09-13T10:15:00.000Z"),
    onStateChange: (state) => controller?.observeState(state),
  });
  const runtime = { orchestrator, async close() {} };
  controller = new DesktopAppController(runtime, { nowMs: () => clock++ });
  controller.observeState(orchestrator.getState());
  return { worker, orchestrator, controller };
}

test("notification intake auto-starts both legs without waiting for renderer observation", async () => {
  const { worker, orchestrator, controller } = harness((_command, request) => ready(request));
  const never = new Promise<void>(() => undefined);
  controller.subscribe(() => never);

  await controller.receiveNotification(notification);
  assert.equal(worker.starts.length, 2);
  await orchestrator.waitForIdle();

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.execution.status, "READY_FOR_USER");
  assert.ok(snapshot.latency.planReadyAtMs !== null);
  assert.ok(snapshot.latency.firstWorkerStartAtMs !== null);
  assert.ok(snapshot.latency.notificationToFirstWorkerStartMs !== null);
});

test("partial failure remains visible beside the successful leg in the renderer model", async () => {
  const { orchestrator, controller } = harness((_command, request) => request.target.bookmaker === "sisal"
    ? [event(request, "OPENING"), event(request, "WAITING_FOR_PAGE"), event(request, "FAILED_SAFE", { failure: failure(request) })]
    : ready(request));

  await controller.receiveNotification(notification);
  await orchestrator.waitForIdle();
  const model = toRendererModel(controller.getSnapshot());

  assert.equal(model.status, "PARTIAL");
  assert.equal(model.legs.length, 2);
  assert.deepEqual(model.legs.map((leg) => leg.state), ["FAILED_SAFE", "READY_FOR_USER"]);
  assert.ok(model.legs[0].actions.includes("RETRY"));
});

test("recovery commands fail closed when an attempt id is stale and target only the current leg", async () => {
  const { worker, orchestrator, controller } = harness((command, request) => request.target.bookmaker === "sisal" && command === "start"
    ? [event(request, "OPENING"), event(request, "WAITING_FOR_PAGE"), event(request, "AUTH_REQUIRED")]
    : ready(request));

  await controller.receiveNotification(notification);
  await orchestrator.waitForIdle();
  const leg = controller.getSnapshot().execution.legs?.[0];
  assert.ok(leg);
  assert.equal(leg.state, "AUTH_REQUIRED");

  await assert.rejects(
    () => controller.execute({ type: "RESUME_AUTH", legId: leg.legId, attemptId: `${leg.attemptId}:stale` }),
    (error: unknown) => error instanceof DesktopControllerError && error.code === "STALE_COMMAND",
  );
  assert.equal(worker.resumes.length, 0);

  await controller.execute({ type: "RESUME_AUTH", legId: leg.legId, attemptId: leg.attemptId });
  assert.equal(worker.resumes.length, 1);
  assert.equal(worker.resumes[0]?.legId, leg.legId);
});

test("typed IPC parser rejects generic, unknown, and extra-field command shapes", () => {
  assert.throws(() => parseDesktopRecoveryCommand({ type: "START", legId: "x", attemptId: "y" }));
  assert.throws(() => parseDesktopRecoveryCommand({ type: "ACKNOWLEDGE_ODDS", legId: "x", attemptId: "y", observedOdds: "2.10" }));
  assert.throws(() => parseDesktopRecoveryCommand({ type: "RETRY", legId: "x", attemptId: "y", url: "https://example.invalid" }));
  assert.deepEqual(
    parseDesktopRecoveryCommand({ type: "RESTART_PLAN", planId: "plan-1" }),
    { type: "RESTART_PLAN", planId: "plan-1" },
  );
});

test("Electron renderer is sandboxed and preload exposes only the narrow typed bridge", () => {
  const main = readFileSync(new URL("../src/electron-main.mjs", import.meta.url), "utf8");
  const preload = readFileSync(new URL("../src/preload.cjs", import.meta.url), "utf8");
  const html = readFileSync(new URL("../renderer/index.html", import.meta.url), "utf8");

  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /webviewTag:\s*false/);
  assert.match(main, /setWindowOpenHandler\(\(\)\s*=>\s*\(\{ action: "deny" \}\)\)/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\("notifyHandler", bridge\)/);
  assert.equal(/ipcRenderer\.(?:send|sendSync|postMessage)\s*\(/.test(preload), false);
  assert.equal(/(?:credential|password|mfa|otp|captcha|stake|placeBet|submitBet|confirmBet|deposit|withdraw|cashout)/iu.test(preload), false);
  assert.equal(/ACKNOWLEDGE_ODDS|acknowledgeObservedOdds/u.test(preload), false);
  assert.equal(html.includes("<webview"), false);
  assert.match(html, /Content-Security-Policy/);
});
