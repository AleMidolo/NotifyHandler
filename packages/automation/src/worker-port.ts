import type { BookmakerId, ExecutionPlan, SelectionTarget } from "../../domain/src/index.ts";
import {
  Bet365Adapter,
  SisalAdapter,
} from "../../bookmakers/src/index.ts";
import type {
  AdapterExecutionContext,
  AdapterTerminalResult,
  BookmakerAdapter,
  ObservedOdds,
  SafeFailure,
} from "../../bookmakers/src/contracts.ts";
import type { WorkerBookmaker } from "./dom-mapping.ts";
import {
  launchBookmakerLegSession,
  supportedOriginsFor,
  type BookmakerLegSession,
  type LaunchBookmakerLegSessionOptions,
} from "./session.ts";

export type WorkerLegState =
  | "PENDING"
  | "OPENING"
  | "WAITING_FOR_PAGE"
  | "AUTH_REQUIRED"
  | "MATCHING_EVENT"
  | "MATCHING_MARKET"
  | "MATCHING_LINE"
  | "MATCHING_OUTCOME"
  | "VERIFYING_ODDS"
  | "ODDS_CHANGED"
  | "ACTIVATING_SELECTION"
  | "VERIFYING_SELECTION"
  | "SELECTION_PREPARED"
  | "READY_FOR_USER"
  | "FAILED_SAFE"
  | "CANCELLED";

export interface WorkerPortFailure {
  readonly code: string;
  readonly stage:
    | "PLAN"
    | "NAVIGATION"
    | "PAGE_READY"
    | "EVENT"
    | "MARKET"
    | "LINE"
    | "OUTCOME"
    | "ODDS"
    | "SELECTION_ACTIVATION"
    | "SELECTION_VERIFICATION"
    | "BROWSER_RUNTIME"
    | "CONTRACT";
  readonly message: string;
  readonly recoverability: "NONE" | "RETRY" | "REOPEN" | "USER_REVIEW" | "RESTART_PLAN";
  readonly activation: "NOT_ATTEMPTED" | "ATTEMPTED_NOT_VERIFIED";
  readonly evidenceEpoch: number;
}

export interface WorkerPortOdds {
  readonly expected: string;
  readonly observed?: string;
  readonly comparison: "EQUAL" | "HIGHER" | "LOWER" | "UNAVAILABLE";
}

export interface WorkerPortEvent {
  readonly legId: string;
  readonly attemptId: string;
  readonly evidenceEpoch: number;
  readonly state: WorkerLegState;
  readonly odds?: WorkerPortOdds;
  readonly failure?: WorkerPortFailure;
}

export interface WorkerExecutionRequest {
  readonly legId: string;
  readonly attemptId: string;
  readonly evidenceEpoch: number;
  readonly target: SelectionTarget;
}

export interface WorkerContinueOddsRequest extends WorkerExecutionRequest {
  readonly acknowledgedObservedOdds: string;
}

export interface WorkerCancelRequest {
  readonly legId: string;
  readonly attemptId: string;
}

export interface WorkerPreflightFailure {
  readonly code:
    | "INVALID_SELECTION_TARGET"
    | "UNSUPPORTED_BOOKMAKER"
    | "UNSAFE_OR_UNSUPPORTED_URL"
    | "CONTRACT_VIOLATION";
  readonly message: string;
  readonly legId?: string;
}

export type WorkerPreflightResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: WorkerPreflightFailure };

export interface WorkerExecutionPreflightPort {
  validate(plan: ExecutionPlan): Promise<WorkerPreflightResult>;
}

export interface BookmakerWorkerPort {
  start(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent>;
  resumeAfterManualAuth(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent>;
  continueWithObservedOdds(request: WorkerContinueOddsRequest): AsyncIterable<WorkerPortEvent>;
  retry(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent>;
  reopen(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent>;
  cancel(request: WorkerCancelRequest): Promise<void>;
}

export type SessionLauncher = (
  options: LaunchBookmakerLegSessionOptions,
) => Promise<BookmakerLegSession>;

export interface BookmakerAutomationWorkerOptions {
  readonly headless?: boolean;
  readonly navigationTimeoutMs?: number;
  /** Fixture-only dependency injection. Production callers leave this undefined. */
  readonly sessionLauncher?: SessionLauncher;
}

interface LegSlot {
  readonly bookmaker: WorkerBookmaker;
  readonly session: BookmakerLegSession;
  controller?: AbortController;
  attemptId?: string;
}

function asWorkerBookmaker(bookmaker: BookmakerId): WorkerBookmaker | null {
  if (bookmaker === "sisal" || bookmaker === "bet365") return bookmaker;
  return null;
}

function adapterFor(bookmaker: WorkerBookmaker): BookmakerAdapter {
  return bookmaker === "sisal" ? new SisalAdapter() : new Bet365Adapter();
}

function workerEvent(
  request: WorkerExecutionRequest,
  state: WorkerLegState,
  options: Readonly<{ odds?: ObservedOdds; failure?: SafeFailure | WorkerPortFailure }> = {},
): WorkerPortEvent {
  return {
    legId: request.legId,
    attemptId: request.attemptId,
    evidenceEpoch: request.evidenceEpoch,
    state,
    ...(options.odds === undefined ? {} : { odds: options.odds }),
    ...(options.failure === undefined ? {} : { failure: options.failure }),
  };
}

function runtimeFailure(
  request: WorkerExecutionRequest,
  error: unknown,
  code = "BROWSER_RUNTIME_FAILURE",
): WorkerPortFailure {
  return {
    code,
    stage: "BROWSER_RUNTIME",
    message: error instanceof Error ? error.message : "Unknown browser automation runtime failure.",
    recoverability: "REOPEN",
    activation: "NOT_ATTEMPTED",
    evidenceEpoch: request.evidenceEpoch,
  };
}

function validTarget(target: SelectionTarget): boolean {
  return target.event.participantA.trim().length > 0
    && target.event.participantB.trim().length > 0
    && target.market.family.trim().length > 0
    && target.market.context.trim().length > 0
    && target.market.line.trim().length > 0
    && target.expectedOdds.trim().length > 0;
}

function safeDeepLink(target: SelectionTarget, bookmaker: WorkerBookmaker): boolean {
  if (target.deepLink === undefined) return true;
  try {
    const url = new URL(target.deepLink);
    return url.protocol === "https:" && supportedOriginsFor(bookmaker).includes(url.origin);
  } catch {
    return false;
  }
}

export function createWorkerExecutionPreflight(): WorkerExecutionPreflightPort {
  return {
    async validate(plan): Promise<WorkerPreflightResult> {
      if (plan.legs.length !== 2) {
        return { ok: false, failure: { code: "CONTRACT_VIOLATION", message: "Execution plan must contain exactly two legs." } };
      }
      if (plan.legs[0].target.bookmaker === plan.legs[1].target.bookmaker) {
        return { ok: false, failure: { code: "CONTRACT_VIOLATION", message: "Execution plan must target two distinct bookmakers." } };
      }
      for (const leg of plan.legs) {
        const bookmaker = asWorkerBookmaker(leg.target.bookmaker);
        if (bookmaker === null) {
          return { ok: false, failure: { code: "UNSUPPORTED_BOOKMAKER", message: `No automation worker is registered for ${leg.target.bookmaker}.`, legId: leg.id } };
        }
        if (!validTarget(leg.target)) {
          return { ok: false, failure: { code: "INVALID_SELECTION_TARGET", message: `Selection target ${leg.target.id} is missing required identity data.`, legId: leg.id } };
        }
        if (!safeDeepLink(leg.target, bookmaker)) {
          return { ok: false, failure: { code: "UNSAFE_OR_UNSUPPORTED_URL", message: `Selection target ${leg.target.id} contains an unapproved navigation candidate.`, legId: leg.id } };
        }
      }
      return { ok: true };
    },
  };
}

function matchingProgress(request: WorkerExecutionRequest): readonly WorkerPortEvent[] {
  return [
    workerEvent(request, "MATCHING_EVENT"),
    workerEvent(request, "MATCHING_MARKET"),
    workerEvent(request, "MATCHING_LINE"),
    workerEvent(request, "MATCHING_OUTCOME"),
    workerEvent(request, "VERIFYING_ODDS"),
  ];
}

function readyProgress(request: WorkerExecutionRequest, odds: ObservedOdds): readonly WorkerPortEvent[] {
  return [
    ...matchingProgress(request),
    workerEvent(request, "ACTIVATING_SELECTION", { odds }),
    workerEvent(request, "VERIFYING_SELECTION", { odds }),
    workerEvent(request, "SELECTION_PREPARED", { odds }),
    workerEvent(request, "READY_FOR_USER", { odds }),
  ];
}

function terminalEvents(request: WorkerExecutionRequest, result: AdapterTerminalResult): readonly WorkerPortEvent[] {
  switch (result.kind) {
    case "AUTH_REQUIRED": return [workerEvent(request, "AUTH_REQUIRED")];
    case "ODDS_CHANGED": return [...matchingProgress(request), workerEvent(request, "ODDS_CHANGED", { odds: result.odds })];
    case "READY_FOR_USER": return readyProgress(request, result.odds);
    case "FAILED_SAFE": return [workerEvent(request, "FAILED_SAFE", { ...(result.odds === undefined ? {} : { odds: result.odds }), failure: result.failure })];
    case "CANCELLED": return [workerEvent(request, "CANCELLED")];
  }
}

export class PlaywrightBookmakerAutomationWorker implements BookmakerWorkerPort {
  private readonly launcher: SessionLauncher;
  private readonly headless: boolean;
  private readonly navigationTimeoutMs: number | undefined;
  private readonly slots = new Map<string, LegSlot>();

  constructor(options: BookmakerAutomationWorkerOptions = {}) {
    this.launcher = options.sessionLauncher ?? launchBookmakerLegSession;
    this.headless = options.headless ?? false;
    this.navigationTimeoutMs = options.navigationTimeoutMs;
  }

  start(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent> {
    return this.run(request, { replaceSession: true, openingState: true });
  }
  resumeAfterManualAuth(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent> {
    return this.run(request, { replaceSession: false, openingState: false, requireExistingSession: true });
  }
  continueWithObservedOdds(request: WorkerContinueOddsRequest): AsyncIterable<WorkerPortEvent> {
    return this.run(request, { replaceSession: false, openingState: false, acknowledgedObservedOdds: request.acknowledgedObservedOdds, requireExistingSession: true });
  }
  retry(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent> {
    return this.run(request, { replaceSession: false, openingState: true });
  }
  reopen(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent> {
    return this.run(request, { replaceSession: true, openingState: true });
  }

  async cancel(request: WorkerCancelRequest): Promise<void> {
    const slot = this.slots.get(request.legId);
    if (slot === undefined || slot.attemptId !== request.attemptId) return;
    slot.controller?.abort();
    await slot.session.cancel().catch(() => undefined);
    if (this.slots.get(request.legId) === slot) this.slots.delete(request.legId);
  }

  async closeAll(): Promise<void> {
    const slots = [...this.slots.values()];
    this.slots.clear();
    await Promise.allSettled(slots.map(async (slot) => {
      slot.controller?.abort();
      await slot.session.close();
    }));
  }

  private async *run(
    request: WorkerExecutionRequest,
    options: Readonly<{ replaceSession: boolean; openingState: boolean; acknowledgedObservedOdds?: string; requireExistingSession?: boolean }>,
  ): AsyncIterable<WorkerPortEvent> {
    if (options.openingState) yield workerEvent(request, "OPENING");
    const bookmaker = asWorkerBookmaker(request.target.bookmaker);
    if (bookmaker === null) {
      yield workerEvent(request, "FAILED_SAFE", { failure: { code: "UNSUPPORTED_BOOKMAKER", stage: "PLAN", message: `No automation worker is registered for ${request.target.bookmaker}.`, recoverability: "NONE", activation: "NOT_ATTEMPTED", evidenceEpoch: request.evidenceEpoch } });
      return;
    }

    let slot: LegSlot;
    try {
      slot = await this.sessionFor(request.legId, bookmaker, options.replaceSession, !(options.requireExistingSession ?? false));
    } catch (error) {
      yield workerEvent(request, "FAILED_SAFE", { failure: runtimeFailure(request, error, "BROWSER_LAUNCH_FAILED") });
      return;
    }
    if (options.openingState) yield workerEvent(request, "WAITING_FOR_PAGE");

    slot.controller?.abort();
    const controller = new AbortController();
    slot.controller = controller;
    slot.attemptId = request.attemptId;

    let result: AdapterTerminalResult;
    try {
      const capabilities = slot.session.createAttemptCapabilities(request.evidenceEpoch, controller.signal);
      const context: AdapterExecutionContext = {
        legId: request.legId,
        attemptId: request.attemptId,
        evidenceEpoch: request.evidenceEpoch,
        browser: capabilities.browser,
        selectionGate: capabilities.selectionGate,
        ...(options.acknowledgedObservedOdds === undefined ? {} : { acknowledgedObservedOdds: options.acknowledgedObservedOdds }),
      };
      result = await adapterFor(bookmaker).prepare(context, request.target, {}, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        yield workerEvent(request, "CANCELLED");
        return;
      }
      yield workerEvent(request, "FAILED_SAFE", { failure: runtimeFailure(request, error) });
      return;
    }

    if (this.slots.get(request.legId) !== slot || slot.attemptId !== request.attemptId) return;
    for (const event of terminalEvents(request, result)) yield event;
  }

  private async sessionFor(legId: string, bookmaker: WorkerBookmaker, replace: boolean, allowCreate: boolean): Promise<LegSlot> {
    const existing = this.slots.get(legId);
    if (existing !== undefined && (replace || existing.bookmaker !== bookmaker)) {
      existing.controller?.abort();
      await existing.session.close().catch(() => undefined);
      if (this.slots.get(legId) === existing) this.slots.delete(legId);
    }
    const current = this.slots.get(legId);
    if (current !== undefined) return current;
    if (!allowCreate) throw new Error(`No active browser session exists for leg ${legId}.`);
    const session = await this.launcher({ bookmaker, headless: this.headless, ...(this.navigationTimeoutMs === undefined ? {} : { navigationTimeoutMs: this.navigationTimeoutMs }) });
    const slot: LegSlot = { bookmaker, session };
    this.slots.set(legId, slot);
    return slot;
  }
}

export function createBookmakerAutomationWorker(options: BookmakerAutomationWorkerOptions = {}): PlaywrightBookmakerAutomationWorker {
  return new PlaywrightBookmakerAutomationWorker(options);
}
