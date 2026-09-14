import type {
  AutomaticExecutionOptions,
  AutomaticExecutionState,
  LegRuntimeState,
  PlanRuntimeStatus,
} from "../../application/src/index.ts";
import {
  createLocalNotifyHandlerRuntime,
  type LocalNotifyHandlerOptions,
  type LocalNotifyHandlerRuntime,
} from "./runtime.ts";
import type { DesktopLatencyMetrics, DesktopRecoveryCommand, DesktopSnapshot } from "./ipc-contract.ts";

export type DesktopSnapshotListener = (snapshot: DesktopSnapshot) => void | Promise<void>;

export class DesktopControllerError extends Error {
  readonly code: "INVALID_INPUT" | "STALE_COMMAND" | "INVALID_STATE";

  constructor(code: "INVALID_INPUT" | "STALE_COMMAND" | "INVALID_STATE", message: string) {
    super(message);
    this.name = "DesktopControllerError";
    this.code = code;
  }
}

export interface DesktopControllerOptions {
  readonly nowMs?: () => number;
}

export interface ProductionDesktopControllerOptions extends LocalNotifyHandlerOptions {
  readonly nowMs?: () => number;
}

const RESTARTABLE_PLAN_STATES = new Set<PlanRuntimeStatus>([
  "PREFLIGHT_FAILED",
  "ACTION_REQUIRED",
  "PARTIAL",
  "FAILED_SAFE",
  "CANCELLED",
]);

const REOPENABLE_LEG_STATES = new Set<LegRuntimeState["state"]>([
  "AUTH_REQUIRED",
  "ODDS_CHANGED",
  "FAILED_SAFE",
  "CANCELLED",
]);

function initialLatency(): DesktopLatencyMetrics {
  return {
    notificationReceivedAtMs: null,
    planReadyAtMs: null,
    firstWorkerStartAtMs: null,
    notificationToFirstWorkerStartMs: null,
  };
}

/**
 * Trusted main-process controller for the renderer IPC surface.
 *
 * It deliberately exposes no browser object and never waits for renderer listeners.
 * The application orchestrator remains authoritative for all state transitions.
 */
export class DesktopAppController {
  private readonly nowMs: () => number;
  private readonly listeners = new Set<DesktopSnapshotListener>();
  private latency: DesktopLatencyMetrics = initialLatency();
  private revision = 0;

  constructor(
    readonly runtime: LocalNotifyHandlerRuntime,
    options: DesktopControllerOptions = {},
  ) {
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  getSnapshot(): DesktopSnapshot {
    return {
      revision: this.revision,
      execution: this.runtime.orchestrator.getState(),
      latency: { ...this.latency },
    };
  }

  subscribe(listener: DesktopSnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called only by the orchestrator observer installed in the trusted main process. */
  observeState(state: AutomaticExecutionState): void {
    const now = this.nowMs();
    if (this.latency.notificationReceivedAtMs !== null && this.latency.planReadyAtMs === null && state.plan !== null) {
      this.latency = { ...this.latency, planReadyAtMs: now };
    }
    if (
      this.latency.notificationReceivedAtMs !== null
      && this.latency.firstWorkerStartAtMs === null
      && state.legs !== null
      && state.legs.some((leg) => leg.state !== "PENDING")
    ) {
      const receipt = this.latency.notificationReceivedAtMs;
      this.latency = {
        ...this.latency,
        firstWorkerStartAtMs: now,
        notificationToFirstWorkerStartMs: Math.max(0, now - receipt),
      };
    }
    this.revision += 1;
    this.publish();
  }

  async receiveNotification(inputText: string): Promise<DesktopSnapshot> {
    if (typeof inputText !== "string" || inputText.trim().length === 0 || inputText.length > 100_000) {
      throw new DesktopControllerError("INVALID_INPUT", "Notification input must be non-empty text within the safety limit.");
    }
    this.latency = {
      notificationReceivedAtMs: this.nowMs(),
      planReadyAtMs: null,
      firstWorkerStartAtMs: null,
      notificationToFirstWorkerStartMs: null,
    };
    this.revision += 1;
    this.publish();

    // This directly enters the automatic application path. No renderer acknowledgement is awaited.
    await this.runtime.orchestrator.receiveNotification(inputText);
    return this.getSnapshot();
  }

  async execute(command: DesktopRecoveryCommand): Promise<DesktopSnapshot> {
    if (command.type === "RESTART_PLAN") {
      const state = this.runtime.orchestrator.getState();
      if (state.plan === null || state.plan.id !== command.planId) {
        throw new DesktopControllerError("STALE_COMMAND", "Restart command does not target the current execution plan.");
      }
      if (!RESTARTABLE_PLAN_STATES.has(state.status)) {
        throw new DesktopControllerError("INVALID_STATE", `Plan cannot be restarted while status is ${state.status}.`);
      }
      await this.runtime.orchestrator.restartPlan();
      return this.getSnapshot();
    }

    const leg = this.currentLeg(command.legId, command.attemptId);
    switch (command.type) {
      case "RESUME_AUTH":
        this.requireLegState(leg, "AUTH_REQUIRED", command.type);
        await this.runtime.orchestrator.resumeAfterManualAuth(leg.legId);
        break;
      case "ACKNOWLEDGE_ODDS":
        this.requireLegState(leg, "ODDS_CHANGED", command.type);
        if (leg.observedOdds?.observed !== command.observedOdds) {
          throw new DesktopControllerError("STALE_COMMAND", "Acknowledged odds do not equal the current observed odds.");
        }
        await this.runtime.orchestrator.continueWithObservedOdds(leg.legId, command.observedOdds);
        break;
      case "RETRY":
        this.requireLegState(leg, "FAILED_SAFE", command.type);
        if (leg.failure?.recoverability !== "RETRY") {
          throw new DesktopControllerError("INVALID_STATE", "Current failure is not retryable.");
        }
        await this.runtime.orchestrator.retry(leg.legId);
        break;
      case "REOPEN":
        if (!REOPENABLE_LEG_STATES.has(leg.state)) {
          throw new DesktopControllerError("INVALID_STATE", `Leg cannot be reopened while state is ${leg.state}.`);
        }
        await this.runtime.orchestrator.reopen(leg.legId);
        break;
      case "CANCEL":
        if (leg.state === "READY_FOR_USER" || leg.state === "CANCELLED") {
          throw new DesktopControllerError("INVALID_STATE", `Leg cannot be cancelled while state is ${leg.state}.`);
        }
        await this.runtime.orchestrator.cancel(leg.legId);
        break;
    }
    return this.getSnapshot();
  }

  async close(): Promise<void> {
    this.listeners.clear();
    await this.runtime.close();
  }

  private currentLeg(legId: string, attemptId: string): LegRuntimeState {
    const legs = this.runtime.orchestrator.getState().legs;
    const leg = legs?.find((candidate) => candidate.legId === legId);
    if (leg === undefined) {
      throw new DesktopControllerError("STALE_COMMAND", "Recovery command targets an unknown or inactive leg.");
    }
    if (leg.attemptId !== attemptId) {
      throw new DesktopControllerError("STALE_COMMAND", "Recovery command targets a stale execution attempt.");
    }
    return leg;
  }

  private requireLegState(leg: LegRuntimeState, expected: LegRuntimeState["state"], command: string): void {
    if (leg.state !== expected) {
      throw new DesktopControllerError("INVALID_STATE", `${command} requires ${expected}; current state is ${leg.state}.`);
    }
  }

  private publish(): void {
    if (this.listeners.size === 0) return;
    const snapshot = this.getSnapshot();
    // Renderer observation is intentionally scheduled out-of-band so browser startup cannot wait on it.
    for (const listener of [...this.listeners]) {
      setTimeout(() => {
        try {
          const result = listener(snapshot);
          if (result !== undefined) void Promise.resolve(result).catch(() => undefined);
        } catch {
          // Presentation failures never affect execution.
        }
      }, 0);
    }
  }
}

export function createProductionDesktopController(
  options: ProductionDesktopControllerOptions = {},
): DesktopAppController {
  let controller: DesktopAppController | undefined;
  const externalObserver = options.application?.onStateChange;
  const application: AutomaticExecutionOptions = {
    ...(options.application ?? {}),
    onStateChange(state) {
      controller?.observeState(state);
      if (externalObserver !== undefined) {
        try {
          const result = externalObserver(state);
          if (result !== undefined) void Promise.resolve(result).catch(() => undefined);
        } catch {
          // Optional diagnostics observers are non-gating.
        }
      }
    },
  };

  const runtime = createLocalNotifyHandlerRuntime({
    application,
    ...(options.worker === undefined ? {} : { worker: options.worker }),
  });
  controller = new DesktopAppController(
    runtime,
    options.nowMs === undefined ? {} : { nowMs: options.nowMs },
  );
  controller.observeState(runtime.orchestrator.getState());
  return controller;
}
