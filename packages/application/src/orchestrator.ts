import { buildExecutionPlan, parseSurebetNotification } from "../../domain/src/index.ts";
import type { BookmakerId, DomainError, ExecutionPlan, SelectionTarget } from "../../domain/src/index.ts";

export type LegState =
  | "PENDING" | "OPENING" | "WAITING_FOR_PAGE" | "AUTH_REQUIRED"
  | "MATCHING_EVENT" | "MATCHING_MARKET" | "MATCHING_LINE" | "MATCHING_OUTCOME"
  | "VERIFYING_ODDS" | "ODDS_CHANGED" | "ACTIVATING_SELECTION" | "VERIFYING_SELECTION"
  | "SELECTION_PREPARED" | "READY_FOR_USER" | "FAILED_SAFE" | "CANCELLED";

export type PlanRuntimeStatus =
  | "AWAITING_NOTIFICATION" | "PREFLIGHT_FAILED" | "STARTING" | "IN_PROGRESS"
  | "ACTION_REQUIRED" | "PARTIAL" | "READY_FOR_USER" | "FAILED_SAFE" | "CANCELLED";

export type FailureStage =
  | "PLAN" | "NAVIGATION" | "PAGE_READY" | "EVENT" | "MARKET" | "LINE" | "OUTCOME"
  | "ODDS" | "SELECTION_ACTIVATION" | "SELECTION_VERIFICATION" | "BROWSER_RUNTIME" | "CONTRACT";
export type Recoverability = "NONE" | "RETRY" | "REOPEN" | "USER_REVIEW" | "RESTART_PLAN";
export type ActivationDisposition = "NOT_ATTEMPTED" | "ATTEMPTED_NOT_VERIFIED";
export type OddsComparison = "EQUAL" | "HIGHER" | "LOWER" | "UNAVAILABLE";

export interface RuntimeFailure {
  readonly code: string;
  readonly stage: FailureStage;
  readonly message: string;
  readonly recoverability: Recoverability;
  readonly activation: ActivationDisposition;
  readonly evidenceEpoch: number;
}
export interface RuntimeOdds {
  readonly expected: string;
  readonly observed?: string;
  readonly comparison: OddsComparison;
}
export interface PreflightFailure {
  readonly code: "INVALID_SELECTION_TARGET" | "UNSUPPORTED_BOOKMAKER" | "UNSAFE_OR_UNSUPPORTED_URL" | "CONTRACT_VIOLATION";
  readonly message: string;
  readonly legId?: string;
}
export type PreflightResult = { readonly ok: true } | { readonly ok: false; readonly failure: PreflightFailure };
export interface ExecutionPreflightPort { validate(plan: ExecutionPlan): Promise<PreflightResult>; }

export interface WorkerLegEvent {
  readonly legId: string;
  readonly attemptId: string;
  readonly evidenceEpoch: number;
  readonly state: LegState;
  readonly odds?: RuntimeOdds;
  readonly failure?: RuntimeFailure;
}
export interface LegExecutionRequest {
  readonly legId: string;
  readonly attemptId: string;
  readonly evidenceEpoch: number;
  readonly target: SelectionTarget;
}
export interface ContinueOddsRequest extends LegExecutionRequest { readonly acknowledgedObservedOdds: string; }
export interface CancelLegRequest { readonly legId: string; readonly attemptId: string; }
export interface BookmakerAutomationPort {
  start(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent>;
  resumeAfterManualAuth(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent>;
  continueWithObservedOdds(request: ContinueOddsRequest): AsyncIterable<WorkerLegEvent>;
  retry(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent>;
  reopen(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent>;
  cancel(request: CancelLegRequest): Promise<void>;
}

export interface LegRuntimeState {
  readonly legId: string;
  readonly bookmaker: BookmakerId;
  readonly state: LegState;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly evidenceEpoch: number;
  readonly observedOdds: RuntimeOdds | null;
  readonly failure: RuntimeFailure | null;
}
export interface AutomaticExecutionState {
  readonly inputText: string;
  readonly notificationId: string | null;
  readonly plan: ExecutionPlan | null;
  readonly status: PlanRuntimeStatus;
  readonly parseErrors: readonly DomainError[];
  readonly preflightFailure: PreflightFailure | null;
  readonly legs: readonly [LegRuntimeState, LegRuntimeState] | null;
}
export interface AutomaticExecutionOptions {
  readonly sourceUtcOffsetMinutes?: number;
  readonly now?: () => Date;
  readonly onStateChange?: (state: AutomaticExecutionState) => void | Promise<void>;
}

export class ApplicationCommandError extends Error {
  constructor(message: string) { super(message); this.name = "ApplicationCommandError"; }
}

const ACTIVE = new Set<LegState>([
  "PENDING", "OPENING", "WAITING_FOR_PAGE", "MATCHING_EVENT", "MATCHING_MARKET", "MATCHING_LINE",
  "MATCHING_OUTCOME", "VERIFYING_ODDS", "ACTIVATING_SELECTION", "VERIFYING_SELECTION", "SELECTION_PREPARED",
]);
const transitions = (values: readonly LegState[]) => new Set<LegState>(values);
const TRANSITIONS: Readonly<Record<LegState, ReadonlySet<LegState>>> = {
  PENDING: transitions(["OPENING", "FAILED_SAFE", "CANCELLED"]),
  OPENING: transitions(["WAITING_FOR_PAGE", "FAILED_SAFE", "CANCELLED"]),
  WAITING_FOR_PAGE: transitions(["AUTH_REQUIRED", "MATCHING_EVENT", "FAILED_SAFE", "CANCELLED"]),
  AUTH_REQUIRED: transitions(["WAITING_FOR_PAGE", "CANCELLED"]),
  MATCHING_EVENT: transitions(["MATCHING_MARKET", "FAILED_SAFE", "CANCELLED"]),
  MATCHING_MARKET: transitions(["MATCHING_LINE", "MATCHING_OUTCOME", "FAILED_SAFE", "CANCELLED"]),
  MATCHING_LINE: transitions(["MATCHING_OUTCOME", "FAILED_SAFE", "CANCELLED"]),
  MATCHING_OUTCOME: transitions(["VERIFYING_ODDS", "FAILED_SAFE", "CANCELLED"]),
  VERIFYING_ODDS: transitions(["ODDS_CHANGED", "ACTIVATING_SELECTION", "FAILED_SAFE", "CANCELLED"]),
  ODDS_CHANGED: transitions(["WAITING_FOR_PAGE", "CANCELLED"]),
  ACTIVATING_SELECTION: transitions(["VERIFYING_SELECTION", "FAILED_SAFE", "CANCELLED"]),
  VERIFYING_SELECTION: transitions(["SELECTION_PREPARED", "FAILED_SAFE", "CANCELLED"]),
  SELECTION_PREPARED: transitions(["READY_FOR_USER", "FAILED_SAFE", "CANCELLED"]),
  READY_FOR_USER: transitions([]),
  FAILED_SAFE: transitions(["PENDING", "CANCELLED"]),
  CANCELLED: transitions(["PENDING"]),
};

function initialState(): AutomaticExecutionState {
  return { inputText: "", notificationId: null, plan: null, status: "AWAITING_NOTIFICATION", parseErrors: [], preflightFailure: null, legs: null };
}
function statusOf(legs: readonly [LegRuntimeState, LegRuntimeState]): PlanRuntimeStatus {
  const states = legs.map((leg) => leg.state);
  if (states.every((state) => state === "READY_FOR_USER")) return "READY_FOR_USER";
  if (states.every((state) => state === "CANCELLED")) return "CANCELLED";
  const ready = states.includes("READY_FOR_USER");
  const action = states.some((state) => state === "AUTH_REQUIRED" || state === "ODDS_CHANGED");
  const stopped = states.some((state) => state === "FAILED_SAFE" || state === "CANCELLED");
  if (ready && (action || stopped)) return "PARTIAL";
  if (action) return "ACTION_REQUIRED";
  if (states.some((state) => ACTIVE.has(state))) {
    return states.some((state) => state === "PENDING" || state === "OPENING") ? "STARTING" : "IN_PROGRESS";
  }
  return ready ? "PARTIAL" : "FAILED_SAFE";
}
function runtime(plan: ExecutionPlan, index: 0 | 1, attemptNumber: number): LegRuntimeState {
  const leg = plan.legs[index];
  return {
    legId: leg.id, bookmaker: leg.target.bookmaker, state: "PENDING",
    attemptId: `${plan.id}:${leg.id}:attempt-${attemptNumber}`, attemptNumber, evidenceEpoch: 0,
    observedOdds: null, failure: null,
  };
}
function runtimePair(plan: ExecutionPlan, attemptNumber = 1): readonly [LegRuntimeState, LegRuntimeState] {
  return [runtime(plan, 0, attemptNumber), runtime(plan, 1, attemptNumber)];
}
function targetFor(plan: ExecutionPlan, legId: string): SelectionTarget {
  const leg = plan.legs.find((candidate) => candidate.id === legId);
  if (!leg) throw new ApplicationCommandError(`Unknown leg: ${legId}`);
  return leg.target;
}

/** APP-002 core path: notification receipt deterministically auto-starts recommendation index 0 after shared preflight. */
export class AutomaticExecutionOrchestrator {
  private readonly now: () => Date;
  private readonly sourceUtcOffsetMinutes: number | undefined;
  private readonly observer: ((state: AutomaticExecutionState) => void | Promise<void>) | undefined;
  private state: AutomaticExecutionState = initialState();
  private generation = 0;
  private activeTasks: Promise<void>[] = [];

  constructor(
    private readonly automation: BookmakerAutomationPort,
    private readonly preflight: ExecutionPreflightPort,
    options: AutomaticExecutionOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.sourceUtcOffsetMinutes = options.sourceUtcOffsetMinutes;
    this.observer = options.onStateChange;
  }

  getState(): AutomaticExecutionState { return this.state; }

  async receiveNotification(inputText: string): Promise<AutomaticExecutionState> {
    const previous = this.state.legs;
    const generation = ++this.generation;
    this.activeTasks = [];
    if (previous) {
      await Promise.allSettled(previous
        .filter((leg) => leg.state !== "READY_FOR_USER" && leg.state !== "CANCELLED")
        .map((leg) => this.automation.cancel({ legId: leg.legId, attemptId: leg.attemptId })));
      if (generation !== this.generation) return this.state;
    }

    const parsed = parseSurebetNotification(inputText,
      this.sourceUtcOffsetMinutes === undefined ? {} : { sourceUtcOffsetMinutes: this.sourceUtcOffsetMinutes });
    if (!parsed.ok) {
      this.setState({ inputText, notificationId: null, plan: null, status: "FAILED_SAFE", parseErrors: parsed.errors, preflightFailure: null, legs: null });
      return this.state;
    }

    const primary = parsed.value.recommendedOptions[0];
    if (!primary) {
      this.setState({
        inputText, notificationId: parsed.value.id, plan: null, status: "FAILED_SAFE",
        parseErrors: [{ code: "MISSING_RECOMMENDATION", message: "The notification has no primary recommended option.", field: "recommendedOptions", section: "recommendedOptions" }],
        preflightFailure: null, legs: null,
      });
      return this.state;
    }

    const built = buildExecutionPlan(parsed.value, primary.id, this.now().toISOString());
    if (!built.ok) {
      this.setState({ inputText, notificationId: parsed.value.id, plan: null, status: "FAILED_SAFE", parseErrors: built.errors, preflightFailure: null, legs: null });
      return this.state;
    }

    const checked = await this.checkPreflight(built.value);
    if (generation !== this.generation) return this.state;
    if (!checked.ok) {
      this.setState({ inputText, notificationId: parsed.value.id, plan: built.value, status: "PREFLIGHT_FAILED", parseErrors: [], preflightFailure: checked.failure, legs: null });
      return this.state;
    }

    const legs = runtimePair(built.value);
    this.setState({ inputText, notificationId: parsed.value.id, plan: built.value, status: "STARTING", parseErrors: [], preflightFailure: null, legs });
    this.activeTasks = this.startTasks(generation, built.value);
    return this.state;
  }

  /**
   * Structured-ingestion convergence point. Callers must first normalize a
   * versioned structured payload into an immutable ExecutionPlan. The same
   * shared preflight, two-leg startup, stale-attempt, and recovery machinery
   * used by the legacy text path remains authoritative.
   */
  async receiveExecutionPlan(
    plan: ExecutionPlan,
    sourceLabel = "[structured direct-pair v1]",
  ): Promise<AutomaticExecutionState> {
    const previous = this.state.legs;
    const generation = ++this.generation;
    this.activeTasks = [];
    if (previous) {
      await Promise.allSettled(previous
        .filter((leg) => leg.state !== "READY_FOR_USER" && leg.state !== "CANCELLED")
        .map((leg) => this.automation.cancel({ legId: leg.legId, attemptId: leg.attemptId })));
      if (generation !== this.generation) return this.state;
    }

    const checked = await this.checkPreflight(plan);
    if (generation !== this.generation) return this.state;
    if (!checked.ok) {
      this.setState({
        inputText: sourceLabel,
        notificationId: plan.notificationId,
        plan,
        status: "PREFLIGHT_FAILED",
        parseErrors: [],
        preflightFailure: checked.failure,
        legs: null,
      });
      return this.state;
    }

    const legs = runtimePair(plan);
    this.setState({
      inputText: sourceLabel,
      notificationId: plan.notificationId,
      plan,
      status: "STARTING",
      parseErrors: [],
      preflightFailure: null,
      legs,
    });
    this.activeTasks = this.startTasks(generation, plan);
    return this.state;
  }

  async waitForIdle(): Promise<AutomaticExecutionState> {
    await Promise.allSettled([...this.activeTasks]);
    return this.state;
  }

  async resumeAfterManualAuth(legId: string): Promise<AutomaticExecutionState> {
    const current = this.requireLeg(legId, "AUTH_REQUIRED");
    this.replaceLeg({ ...current, state: "WAITING_FOR_PAGE", evidenceEpoch: current.evidenceEpoch + 1 });
    await this.consume(this.generation, legId, this.automation.resumeAfterManualAuth(this.requestFor(legId)));
    return this.state;
  }

  async continueWithObservedOdds(legId: string, acknowledgedObservedOdds: string): Promise<AutomaticExecutionState> {
    const current = this.requireLeg(legId, "ODDS_CHANGED");
    if (current.observedOdds?.observed !== acknowledgedObservedOdds) {
      throw new ApplicationCommandError("The acknowledged odds must exactly match the currently observed odds.");
    }
    this.replaceLeg({ ...current, state: "WAITING_FOR_PAGE", evidenceEpoch: current.evidenceEpoch + 1 });
    await this.consume(this.generation, legId, this.automation.continueWithObservedOdds({ ...this.requestFor(legId), acknowledgedObservedOdds }));
    return this.state;
  }

  async retry(legId: string): Promise<AutomaticExecutionState> {
    const current = this.requireLeg(legId, "FAILED_SAFE");
    if (current.failure?.recoverability !== "RETRY") throw new ApplicationCommandError(`Leg ${legId} is not retryable.`);
    this.replaceLeg(this.freshAttempt(current));
    await this.consume(this.generation, legId, this.automation.retry(this.requestFor(legId)));
    return this.state;
  }

  async reopen(legId: string): Promise<AutomaticExecutionState> {
    const current = this.findLeg(legId);
    if (current.state === "READY_FOR_USER") throw new ApplicationCommandError(`Leg ${legId} is already ready for user handoff.`);
    this.replaceLeg(this.freshAttempt(current));
    await this.consume(this.generation, legId, this.automation.reopen(this.requestFor(legId)));
    return this.state;
  }

  async cancel(legId: string): Promise<AutomaticExecutionState> {
    const current = this.findLeg(legId);
    if (current.state === "READY_FOR_USER" || current.state === "CANCELLED") return this.state;
    this.replaceLeg({ ...current, state: "CANCELLED", failure: null });
    await this.automation.cancel({ legId, attemptId: current.attemptId });
    return this.state;
  }

  async cancelPlan(): Promise<AutomaticExecutionState> {
    if (this.state.legs) await Promise.allSettled(this.state.legs.map((leg) => this.cancel(leg.legId)));
    return this.state;
  }

  async restartPlan(): Promise<AutomaticExecutionState> {
    const plan = this.state.plan;
    if (!plan) throw new ApplicationCommandError("There is no execution plan to restart.");
    const old = this.state.legs;
    const generation = ++this.generation;
    if (old) {
      await Promise.allSettled(old
        .filter((leg) => leg.state !== "READY_FOR_USER" && leg.state !== "CANCELLED")
        .map((leg) => this.automation.cancel({ legId: leg.legId, attemptId: leg.attemptId })));
    }
    const checked = await this.checkPreflight(plan);
    if (generation !== this.generation) return this.state;
    if (!checked.ok) {
      this.setState({ ...this.state, status: "PREFLIGHT_FAILED", preflightFailure: checked.failure, legs: null });
      return this.state;
    }
    const legs: readonly [LegRuntimeState, LegRuntimeState] = [
      runtime(plan, 0, (old?.[0].attemptNumber ?? 0) + 1),
      runtime(plan, 1, (old?.[1].attemptNumber ?? 0) + 1),
    ];
    this.setState({ ...this.state, status: "STARTING", preflightFailure: null, parseErrors: [], legs });
    this.activeTasks = this.startTasks(generation, plan);
    return this.state;
  }

  private startTasks(generation: number, plan: ExecutionPlan): Promise<void>[] {
    return plan.legs.map((leg) => this.launchStart(generation, leg.id));
  }

  private launchStart(generation: number, legId: string): Promise<void> {
    try {
      return this.consume(generation, legId, this.automation.start(this.requestFor(legId)));
    } catch (error) {
      this.failRuntime(generation, legId, error);
      return Promise.resolve();
    }
  }

  private failRuntime(generation: number, legId: string, error: unknown): void {
    if (generation !== this.generation) return;
    const current = this.findLeg(legId);
    if (current.state === "CANCELLED" || current.state === "READY_FOR_USER") return;
    this.replaceLeg({ ...current, state: "FAILED_SAFE", failure: {
      code: "BROWSER_LAUNCH_FAILED", stage: "BROWSER_RUNTIME",
      message: error instanceof Error ? error.message : "Unknown automation runtime error.",
      recoverability: "REOPEN", activation: "NOT_ATTEMPTED", evidenceEpoch: current.evidenceEpoch,
    } });
  }

  private async checkPreflight(plan: ExecutionPlan): Promise<PreflightResult> {
    try { return await this.preflight.validate(plan); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Unknown preflight error.";
      return { ok: false, failure: { code: "CONTRACT_VIOLATION", message: `Execution preflight failed: ${message}` } };
    }
  }

  private requestFor(legId: string): LegExecutionRequest {
    const plan = this.state.plan;
    if (!plan) throw new ApplicationCommandError("No execution plan is active.");
    const leg = this.findLeg(legId);
    return { legId, attemptId: leg.attemptId, evidenceEpoch: leg.evidenceEpoch, target: targetFor(plan, legId) };
  }

  private freshAttempt(current: LegRuntimeState): LegRuntimeState {
    const plan = this.state.plan;
    if (!plan) throw new ApplicationCommandError("No execution plan is active.");
    const attemptNumber = current.attemptNumber + 1;
    return { ...current, state: "PENDING", attemptId: `${plan.id}:${current.legId}:attempt-${attemptNumber}`, attemptNumber, evidenceEpoch: 0, observedOdds: null, failure: null };
  }

  private async consume(generation: number, legId: string, events: AsyncIterable<WorkerLegEvent>): Promise<void> {
    try {
      for await (const event of events) {
        if (generation !== this.generation) return;
        this.applyEvent(event);
      }
      if (generation !== this.generation) return;
      const current = this.findLeg(legId);
      if (ACTIVE.has(current.state)) {
        this.replaceLeg({ ...current, state: "FAILED_SAFE", failure: {
          code: "CONTRACT_VIOLATION", stage: "CONTRACT",
          message: "Automation event stream ended before a terminal or interruption state.",
          recoverability: "REOPEN", activation: "NOT_ATTEMPTED", evidenceEpoch: current.evidenceEpoch,
        } });
      }
    } catch (error) {
      this.failRuntime(generation, legId, error);
    }
  }

  private applyEvent(event: WorkerLegEvent): void {
    const current = this.findLeg(event.legId);
    if (event.attemptId !== current.attemptId || event.evidenceEpoch < current.evidenceEpoch) return;
    if (current.state === "CANCELLED" || current.state === "READY_FOR_USER") return;
    if (event.state !== current.state && !TRANSITIONS[current.state].has(event.state)) return;
    this.replaceLeg({
      ...current, state: event.state, evidenceEpoch: event.evidenceEpoch,
      observedOdds: event.odds ?? current.observedOdds,
      failure: event.failure ?? (event.state === "FAILED_SAFE" ? current.failure : null),
    });
  }

  private requireLeg(legId: string, state: LegState): LegRuntimeState {
    const leg = this.findLeg(legId);
    if (leg.state !== state) throw new ApplicationCommandError(`Leg ${legId} must be ${state}; current state is ${leg.state}.`);
    return leg;
  }
  private findLeg(legId: string): LegRuntimeState {
    if (!this.state.legs) throw new ApplicationCommandError("No leg execution is active.");
    const leg = this.state.legs.find((candidate) => candidate.legId === legId);
    if (!leg) throw new ApplicationCommandError(`Unknown leg: ${legId}`);
    return leg;
  }
  private replaceLeg(next: LegRuntimeState): void {
    const legs = this.state.legs;
    if (!legs) throw new ApplicationCommandError("No leg execution is active.");
    let updated: readonly [LegRuntimeState, LegRuntimeState];
    if (legs[0].legId === next.legId) updated = [next, legs[1]];
    else if (legs[1].legId === next.legId) updated = [legs[0], next];
    else throw new ApplicationCommandError(`Unknown leg: ${next.legId}`);
    this.setState({ ...this.state, legs: updated, status: statusOf(updated) });
  }
  private setState(state: AutomaticExecutionState): void {
    this.state = state;
    try {
      const observation = this.observer?.(state);
      if (observation !== undefined) void Promise.resolve(observation).catch(() => undefined);
    } catch { /* renderer observation is deliberately non-gating */ }
  }
}
