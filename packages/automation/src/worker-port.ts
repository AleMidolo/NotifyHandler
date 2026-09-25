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
import { NavigationPolicy, type HostResolver } from "./navigation-policy.ts";
import {
  launchBookmakerLegSession,
  supportedOriginsFor,
  type BookmakerLegSession,
  type LaunchBookmakerLegSessionOptions,
} from "./session.ts";
import { BookmakerNetworkPolicyViolation } from "./page-runtime.ts";

export type WorkerLegState =
  | "PENDING"
  | "OPENING"
  | "WAITING_FOR_PAGE"
  | "AUTH_REQUIRED"
  | "MATCHING_EVENT"
  | "MATCHING_MARKET"
  | "MATCHING_LINE"
  | "MATCHING_OUTCOME"
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
  readonly expected?: string;
  readonly observed?: string;
  readonly comparison?: "EQUAL" | "HIGHER" | "LOWER";
  readonly status: "NOT_OBSERVED" | "OBSERVED" | "UNAVAILABLE" | "INVALID";
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
  retry(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent>;
  reopen(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent>;
  cancel(request: WorkerCancelRequest): Promise<void>;
}

export type SessionLauncher = (
  options: LaunchBookmakerLegSessionOptions,
) => Promise<BookmakerLegSession>;

export interface WorkerExecutionPreflightOptions {
  readonly resolveHostname?: HostResolver;
}

export interface BookmakerAutomationWorkerOptions {
  readonly headless?: boolean;
  readonly navigationTimeoutMs?: number;
  readonly relayResolutionTimeoutMs?: number;
  readonly resolveHostname?: HostResolver;
  /** Fixture-only dependency injection. Production callers leave this undefined. */
  readonly sessionLauncher?: SessionLauncher;
}

interface LegSlot {
  readonly bookmaker: WorkerBookmaker;
  readonly session: BookmakerLegSession;
  controller?: AbortController;
  attemptId?: string;
  resolvedRelayUrl?: string;
}

interface RunOptions {
  readonly replaceSession: boolean;
  readonly openingState: boolean;
  readonly resolveRelay: boolean;
  readonly requireExistingSession?: boolean;
}

function attemptKey(request: Pick<WorkerExecutionRequest, "legId" | "attemptId">): string {
  return `${request.legId}\u0000${request.attemptId}`;
}

function asWorkerBookmaker(bookmaker: BookmakerId): WorkerBookmaker | null {
  if (bookmaker === "sisal" || bookmaker === "bet365") return bookmaker;
  return null;
}

function adapterFor(bookmaker: WorkerBookmaker): BookmakerAdapter {
  return bookmaker === "sisal" ? new SisalAdapter() : new Bet365Adapter();
}

const BETUP_RELAY_ORIGIN = "https://www.bet-up.it";
const RELAY_SUFFIX: Readonly<Record<WorkerBookmaker, string>> = Object.freeze({
  sisal: "sisal",
  bet365: "bet365",
});
const RELAY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

type RelayValidation =
  | { readonly ok: true; readonly url: string; readonly signalId: string }
  | { readonly ok: false; readonly code: "RELAY_INVALID" | "RELAY_BOOKMAKER_MISMATCH"; readonly message: string };

function validateRelayTarget(target: SelectionTarget, bookmaker: WorkerBookmaker): RelayValidation {
  const navigation = target.navigation;
  if (navigation?.kind !== "BETUP_RELAY") {
    return { ok: false, code: "RELAY_INVALID", message: "Selection target does not contain a typed bet-up relay navigation candidate." };
  }
  if (navigation.bookmaker !== bookmaker || target.bookmaker !== bookmaker) {
    return { ok: false, code: "RELAY_BOOKMAKER_MISMATCH", message: "Relay bookmaker binding does not match the leg bookmaker." };
  }

  let parsed: URL;
  try {
    parsed = new URL(navigation.url);
  } catch {
    return { ok: false, code: "RELAY_INVALID", message: "Relay URL is malformed." };
  }
  const match = /^\/lnk\/([0-9a-fA-F-]+)\/([a-z0-9]+)$/u.exec(parsed.pathname);
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== BETUP_RELAY_ORIGIN ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    match === null
  ) {
    return { ok: false, code: "RELAY_INVALID", message: "Relay URL violates the exact approved bet-up grammar." };
  }

  const signalId = (match[1] ?? "").toLowerCase();
  const suffix = match[2] ?? "";
  if (!RELAY_UUID.test(signalId) || navigation.signalId !== signalId) {
    return { ok: false, code: "RELAY_INVALID", message: "Relay signal identifier is malformed or inconsistent with the typed target." };
  }
  if (suffix !== RELAY_SUFFIX[bookmaker]) {
    return { ok: false, code: "RELAY_BOOKMAKER_MISMATCH", message: "Relay suffix does not match the target bookmaker." };
  }
  return { ok: true, url: parsed.href, signalId };
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
  const networkPolicyFailure = error instanceof BookmakerNetworkPolicyViolation
    ? error
    : undefined;
  return {
    code: networkPolicyFailure?.code ?? code,
    stage: "BROWSER_RUNTIME",
    message: networkPolicyFailure?.message
      ?? (error instanceof Error ? error.message : "Unknown browser automation runtime failure."),
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
    && target.market.period === "full_match"
    && target.market.line.trim().length > 0;
}

async function safeDeepLink(
  target: SelectionTarget,
  bookmaker: WorkerBookmaker,
  options: WorkerExecutionPreflightOptions,
): Promise<boolean> {
  if (target.navigation?.kind === "BETUP_RELAY") {
    const relay = validateRelayTarget(target, bookmaker);
    if (!relay.ok) return false;
    try {
      const policy = new NavigationPolicy([BETUP_RELAY_ORIGIN], options.resolveHostname);
      return policy.isResolvedTargetAllowed(relay.url);
    } catch {
      return false;
    }
  }

  const candidate = target.navigation?.kind === "BOOKMAKER_DIRECT"
    ? target.navigation.url
    : target.deepLink;
  if (candidate === undefined) return target.provenance.kind !== "structured-direct-pair";

  try {
    const policy = new NavigationPolicy(supportedOriginsFor(bookmaker), options.resolveHostname);
    if (!policy.isAllowed(candidate)) return false;
    if (target.provenance.kind !== "structured-direct-pair") return true;
    return policy.isResolvedTargetAllowed(candidate);
  } catch {
    return false;
  }
}

function adapterTarget(target: SelectionTarget, resolvedRelayUrl?: string): SelectionTarget {
  if (resolvedRelayUrl !== undefined) return { ...target, deepLink: resolvedRelayUrl };
  if (target.navigation?.kind !== "BOOKMAKER_DIRECT") return target;
  return { ...target, deepLink: target.navigation.url };
}

export function createWorkerExecutionPreflight(
  options: WorkerExecutionPreflightOptions = {},
): WorkerExecutionPreflightPort {
  return {
    async validate(plan): Promise<WorkerPreflightResult> {
      if (plan.legs.length !== 2) {
        return { ok: false, failure: { code: "CONTRACT_VIOLATION", message: "Execution plan must contain exactly two legs." } };
      }
      if (plan.legs[0].target.bookmaker === plan.legs[1].target.bookmaker) {
        return { ok: false, failure: { code: "CONTRACT_VIOLATION", message: "Execution plan must target two distinct bookmakers." } };
      }
      const relaySignals = plan.legs
        .map((leg) => leg.target.navigation)
        .filter((navigation): navigation is Extract<NonNullable<SelectionTarget["navigation"]>, { readonly kind: "BETUP_RELAY" }> => navigation?.kind === "BETUP_RELAY")
        .map((navigation) => navigation.signalId);
      if (relaySignals.length === 2 && relaySignals[0] !== relaySignals[1]) {
        return { ok: false, failure: { code: "CONTRACT_VIOLATION", message: "Relay legs must originate from the same signal identifier." } };
      }
      for (const leg of plan.legs) {
        const bookmaker = asWorkerBookmaker(leg.target.bookmaker);
        if (bookmaker === null) {
          return { ok: false, failure: { code: "UNSUPPORTED_BOOKMAKER", message: `No automation worker is registered for ${leg.target.bookmaker}.`, legId: leg.id } };
        }
        if (!validTarget(leg.target)) {
          return { ok: false, failure: { code: "INVALID_SELECTION_TARGET", message: `Selection target ${leg.target.id} is missing required identity data.`, legId: leg.id } };
        }
        if (!(await safeDeepLink(leg.target, bookmaker, options))) {
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
  ];
}

function readyProgress(request: WorkerExecutionRequest, odds?: ObservedOdds): readonly WorkerPortEvent[] {
  const options = odds === undefined ? {} : { odds };
  return [
    ...matchingProgress(request),
    workerEvent(request, "ACTIVATING_SELECTION", options),
    workerEvent(request, "VERIFYING_SELECTION", options),
    workerEvent(request, "SELECTION_PREPARED", options),
    workerEvent(request, "READY_FOR_USER", options),
  ];
}

function terminalEvents(request: WorkerExecutionRequest, result: AdapterTerminalResult): readonly WorkerPortEvent[] {
  switch (result.kind) {
    case "AUTH_REQUIRED": return [workerEvent(request, "AUTH_REQUIRED")];
    case "READY_FOR_USER": return readyProgress(request, result.odds);
    case "FAILED_SAFE": return [workerEvent(request, "FAILED_SAFE", { ...(result.odds === undefined ? {} : { odds: result.odds }), failure: result.failure })];
    case "CANCELLED": return [workerEvent(request, "CANCELLED")];
  }
}

export class PlaywrightBookmakerAutomationWorker implements BookmakerWorkerPort {
  private readonly launcher: SessionLauncher;
  private readonly headless: boolean;
  private readonly navigationTimeoutMs: number | undefined;
  private readonly relayResolutionTimeoutMs: number;
  private readonly resolveHostname: HostResolver | undefined;
  private readonly slots = new Map<string, LegSlot>();
  private readonly cancelledAttempts = new Set<string>();

  constructor(options: BookmakerAutomationWorkerOptions = {}) {
    this.launcher = options.sessionLauncher ?? launchBookmakerLegSession;
    this.headless = options.headless ?? false;
    this.navigationTimeoutMs = options.navigationTimeoutMs;
    this.relayResolutionTimeoutMs = options.relayResolutionTimeoutMs ?? 5_000;
    this.resolveHostname = options.resolveHostname;
  }

  start(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent> {
    return this.beginRun(request, { replaceSession: true, openingState: true, resolveRelay: true });
  }
  resumeAfterManualAuth(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent> {
    return this.beginRun(request, { replaceSession: false, openingState: false, resolveRelay: false, requireExistingSession: true });
  }
  retry(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent> {
    return this.beginRun(request, { replaceSession: false, openingState: true, resolveRelay: true });
  }
  reopen(request: WorkerExecutionRequest): AsyncIterable<WorkerPortEvent> {
    return this.beginRun(request, { replaceSession: true, openingState: true, resolveRelay: true });
  }

  async cancel(request: WorkerCancelRequest): Promise<void> {
    this.cancelledAttempts.add(attemptKey(request));
    const slot = this.slots.get(request.legId);
    if (slot === undefined || slot.attemptId !== request.attemptId) return;
    slot.controller?.abort();
    await slot.session.cancel().catch(() => undefined);
    if (this.slots.get(request.legId) === slot) this.slots.delete(request.legId);
  }

  async closeAll(): Promise<void> {
    const slots = [...this.slots.values()];
    this.slots.clear();
    this.cancelledAttempts.clear();
    await Promise.allSettled(slots.map(async (slot) => {
      slot.controller?.abort();
      await slot.session.close();
    }));
  }

  private beginRun(request: WorkerExecutionRequest, options: RunOptions): AsyncIterable<WorkerPortEvent> {
    this.cancelledAttempts.delete(attemptKey(request));
    return this.run(request, options);
  }

  private async *run(
    request: WorkerExecutionRequest,
    options: RunOptions,
  ): AsyncIterable<WorkerPortEvent> {
    const key = attemptKey(request);
    if (options.openingState) yield workerEvent(request, "OPENING");
    if (this.cancelledAttempts.has(key)) {
      this.cancelledAttempts.delete(key);
      yield workerEvent(request, "CANCELLED");
      return;
    }

    const bookmaker = asWorkerBookmaker(request.target.bookmaker);
    if (bookmaker === null) {
      yield workerEvent(request, "FAILED_SAFE", { failure: { code: "UNSUPPORTED_BOOKMAKER", stage: "PLAN", message: `No automation worker is registered for ${request.target.bookmaker}.`, recoverability: "NONE", activation: "NOT_ATTEMPTED", evidenceEpoch: request.evidenceEpoch } });
      return;
    }

    let slot: LegSlot;
    try {
      slot = await this.sessionFor(request.legId, bookmaker, options.replaceSession, !(options.requireExistingSession ?? false));
    } catch (error) {
      if (this.cancelledAttempts.has(key)) {
        this.cancelledAttempts.delete(key);
        yield workerEvent(request, "CANCELLED");
        return;
      }
      yield workerEvent(request, "FAILED_SAFE", { failure: runtimeFailure(request, error, "BROWSER_LAUNCH_FAILED") });
      return;
    }

    if (this.cancelledAttempts.has(key)) {
      this.cancelledAttempts.delete(key);
      slot.controller?.abort();
      await slot.session.cancel().catch(() => undefined);
      if (this.slots.get(request.legId) === slot) this.slots.delete(request.legId);
      yield workerEvent(request, "CANCELLED");
      return;
    }

    if (options.openingState) yield workerEvent(request, "WAITING_FOR_PAGE");
    if (this.cancelledAttempts.has(key)) {
      this.cancelledAttempts.delete(key);
      slot.controller?.abort();
      await slot.session.cancel().catch(() => undefined);
      if (this.slots.get(request.legId) === slot) this.slots.delete(request.legId);
      yield workerEvent(request, "CANCELLED");
      return;
    }

    slot.controller?.abort();
    const controller = new AbortController();
    slot.controller = controller;
    slot.attemptId = request.attemptId;

    let resolvedRelayUrl: string | undefined;
    if (request.target.navigation?.kind === "BETUP_RELAY") {
      const relay = validateRelayTarget(request.target, bookmaker);
      if (!relay.ok) {
        yield workerEvent(request, "FAILED_SAFE", { failure: {
          code: relay.code,
          stage: "NAVIGATION",
          message: relay.message,
          recoverability: "RESTART_PLAN",
          activation: "NOT_ATTEMPTED",
          evidenceEpoch: request.evidenceEpoch,
        } });
        return;
      }

      if (options.resolveRelay) {
        delete slot.resolvedRelayUrl;
        const resolution = await slot.session.resolveRelay({
          relayUrl: relay.url,
          timeoutMs: this.relayResolutionTimeoutMs,
          signal: controller.signal,
        });
        if (controller.signal.aborted || this.cancelledAttempts.has(key)) {
          this.cancelledAttempts.delete(key);
          yield workerEvent(request, "CANCELLED");
          return;
        }
        if (resolution.kind === "FAILED") {
          yield workerEvent(request, "FAILED_SAFE", { failure: {
            code: resolution.code,
            stage: "NAVIGATION",
            message: resolution.message,
            recoverability:
              resolution.code === "RELAY_INVALID"
              || resolution.code === "RELAY_SIGNAL_MISMATCH"
              || resolution.code === "RELAY_BOOKMAKER_MISMATCH"
                ? "RESTART_PLAN"
                : "REOPEN",
            activation: "NOT_ATTEMPTED",
            evidenceEpoch: request.evidenceEpoch,
          } });
          return;
        }
        slot.resolvedRelayUrl = resolution.finalLocation.href;
      }

      if (slot.resolvedRelayUrl === undefined) {
        yield workerEvent(request, "FAILED_SAFE", { failure: {
          code: "RELAY_UNRESOLVED",
          stage: "NAVIGATION",
          message: "No current resolved bookmaker page exists for this relay attempt.",
          recoverability: "REOPEN",
          activation: "NOT_ATTEMPTED",
          evidenceEpoch: request.evidenceEpoch,
        } });
        return;
      }
      resolvedRelayUrl = slot.resolvedRelayUrl;
    }

    let result: AdapterTerminalResult;
    try {
      const capabilities = slot.session.createAttemptCapabilities(request.evidenceEpoch, controller.signal);
      const context: AdapterExecutionContext = {
        legId: request.legId,
        attemptId: request.attemptId,
        evidenceEpoch: request.evidenceEpoch,
        browser: capabilities.browser,
        selectionGate: capabilities.selectionGate,
      };
      result = await adapterFor(bookmaker).prepare(context, adapterTarget(request.target, resolvedRelayUrl), {}, controller.signal);
    } catch (error) {
      if (controller.signal.aborted || this.cancelledAttempts.has(key)) {
        this.cancelledAttempts.delete(key);
        yield workerEvent(request, "CANCELLED");
        return;
      }
      yield workerEvent(request, "FAILED_SAFE", { failure: runtimeFailure(request, error) });
      return;
    }

    if (this.slots.get(request.legId) !== slot || slot.attemptId !== request.attemptId) {
      this.cancelledAttempts.delete(key);
      return;
    }
    if (this.cancelledAttempts.has(key)) {
      this.cancelledAttempts.delete(key);
      yield workerEvent(request, "CANCELLED");
      return;
    }
    this.cancelledAttempts.delete(key);
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
    const session = await this.launcher({
      bookmaker,
      headless: this.headless,
      ...(this.navigationTimeoutMs === undefined ? {} : { navigationTimeoutMs: this.navigationTimeoutMs }),
      ...(this.resolveHostname === undefined ? {} : { resolveHostname: this.resolveHostname }),
    });
    const slot: LegSlot = { bookmaker, session };
    this.slots.set(legId, slot);
    return slot;
  }
}

export function createBookmakerAutomationWorker(options: BookmakerAutomationWorkerOptions = {}): PlaywrightBookmakerAutomationWorker {
  return new PlaywrightBookmakerAutomationWorker(options);
}
