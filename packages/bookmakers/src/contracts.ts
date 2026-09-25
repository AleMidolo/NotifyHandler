import type { BookmakerId, DecimalString, SelectionTarget } from "../../domain/src/core.ts";

export type EvidenceStatus =
  | "NOT_CHECKED"
  | "MATCHED"
  | "MISMATCHED"
  | "AMBIGUOUS"
  | "UNAVAILABLE";

export interface EvidenceDimension {
  readonly status: EvidenceStatus;
  readonly reasonCode: string;
  readonly normalizedTarget?: string;
  readonly normalizedObserved?: readonly string[];
}

export interface EventEvidence {
  readonly participants: EvidenceDimension;
  readonly competition: EvidenceDimension;
  readonly scheduledTime: EvidenceDimension;
  readonly overall: EvidenceDimension;
}

export interface MatchingEvidenceSnapshot {
  readonly evidenceEpoch: number;
  readonly origin: EvidenceDimension;
  readonly event: EventEvidence;
  readonly market: EvidenceDimension;
  readonly line: EvidenceDimension;
  readonly outcome: EvidenceDimension;
}

export type OddsComparison = "EQUAL" | "HIGHER" | "LOWER";
export type OddsObservationStatus = "NOT_OBSERVED" | "OBSERVED" | "UNAVAILABLE" | "INVALID";

export interface ObservedOdds {
  readonly expected?: DecimalString;
  readonly observed?: DecimalString;
  readonly comparison?: OddsComparison;
  readonly status: OddsObservationStatus;
}

export type FailureStage =
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

export type FailureCode =
  | "INVALID_SELECTION_TARGET"
  | "UNSUPPORTED_BOOKMAKER"
  | "CONTRACT_VIOLATION"
  | "UNSAFE_OR_UNSUPPORTED_URL"
  | "BLOCKED_REDIRECT"
  | "PAGE_LOAD_TIMEOUT"
  | "UNSUPPORTED_PAGE_STATE"
  | "EVENT_NOT_FOUND"
  | "EVENT_MISMATCH"
  | "EVENT_AMBIGUOUS"
  | "EVENT_CONTEXT_UNAVAILABLE"
  | "MARKET_NOT_FOUND"
  | "MARKET_MISMATCH"
  | "MARKET_AMBIGUOUS"
  | "MARKET_CONTEXT_UNAVAILABLE"
  | "LINE_NOT_FOUND"
  | "LINE_MISMATCH"
  | "LINE_AMBIGUOUS"
  | "LINE_UNAVAILABLE"
  | "OUTCOME_NOT_FOUND"
  | "OUTCOME_MISMATCH"
  | "OUTCOME_AMBIGUOUS"
  | "OUTCOME_UNAVAILABLE"
  | "SELECTION_ACTIVATION_REJECTED"
  | "SELECTION_ACTIVATION_FAILED"
  | "SELECTION_VERIFICATION_FAILED";

export type Recoverability = "NONE" | "RETRY" | "REOPEN" | "USER_REVIEW" | "RESTART_PLAN";
export type ActivationDisposition = "NOT_ATTEMPTED" | "ATTEMPTED_NOT_VERIFIED";

export interface SafeFailure {
  readonly code: FailureCode;
  readonly stage: FailureStage;
  readonly message: string;
  readonly recoverability: Recoverability;
  readonly activation: ActivationDisposition;
  readonly evidenceEpoch: number;
}

export interface ElementRef {
  readonly id: string;
}

/**
 * Bookmaker-neutral semantic read queries. Concrete Playwright workers map each
 * bookmaker's permitted DOM into these semantic candidates without exposing raw
 * locators or browser objects to adapters.
 */
export type BookmakerReadQuery =
  | { readonly kind: "auth-wall" }
  | { readonly kind: "event-candidate" }
  | { readonly kind: "market-candidate"; readonly within: ElementRef }
  | { readonly kind: "outcome-candidate"; readonly within: ElementRef };

/** @deprecated Use `BookmakerReadQuery`. Kept for source compatibility with SISAL tests/workers. */
export type SisalReadQuery = BookmakerReadQuery;
export type Bet365ReadQuery = BookmakerReadQuery;

export interface NavigationResult {
  readonly ok: boolean;
}

export interface SafeLocation {
  readonly href: string;
  readonly origin: string;
}

export interface PageReadyResult {
  readonly ready: boolean;
}

export interface BookmakerPagePort {
  openAllowed(url: string): Promise<NavigationResult>;
  currentLocation(): Promise<SafeLocation>;
  waitForPageReady(options?: { readonly timeoutMs?: number }): Promise<PageReadyResult>;
  query(query: BookmakerReadQuery): Promise<readonly ElementRef[]>;
  readText(ref: ElementRef): Promise<string>;
  readAttribute(ref: ElementRef, name: string): Promise<string | null>;
  isVisible(ref: ElementRef): Promise<boolean>;
  activateNavigationControl(action: Readonly<{ ref: ElementRef; purpose: "DISCLOSE_EVENT" | "DISCLOSE_MARKET" }>): Promise<{ readonly ok: boolean }>;
}

export interface VerifiedPreparedSelection {
  readonly candidate: ElementRef;
}

export type SelectionActivationResult =
  | { readonly kind: "ACTIVATED"; readonly selection: VerifiedPreparedSelection }
  | { readonly kind: "REJECTED"; readonly reasonCode: string }
  | { readonly kind: "FAILED"; readonly reasonCode: string };

export interface SelectionActivationGate {
  activate(request: Readonly<{
    target: SelectionTarget;
    candidate: ElementRef;
    evidence: MatchingEvidenceSnapshot;
  }>): Promise<SelectionActivationResult>;
}

export interface AdapterObserver {
  onEvidence?(evidence: MatchingEvidenceSnapshot): void;
}

export interface AdapterExecutionContext {
  readonly legId: string;
  readonly attemptId: string;
  readonly evidenceEpoch: number;
  readonly browser: BookmakerPagePort;
  readonly selectionGate: SelectionActivationGate;
}

export type AdapterTerminalResult =
  | {
      readonly kind: "READY_FOR_USER";
      readonly evidence: MatchingEvidenceSnapshot;
      readonly odds?: ObservedOdds;
      readonly selection: VerifiedPreparedSelection;
    }
  | { readonly kind: "AUTH_REQUIRED"; readonly safeLocation: SafeLocation }
  | { readonly kind: "FAILED_SAFE"; readonly failure: SafeFailure; readonly evidence?: MatchingEvidenceSnapshot; readonly odds?: ObservedOdds }
  | { readonly kind: "CANCELLED" };

export interface BookmakerAdapter {
  readonly bookmaker: BookmakerId;
  readonly supportedOrigins: readonly string[];
  prepare(
    ctx: AdapterExecutionContext,
    target: SelectionTarget,
    observer: AdapterObserver,
    signal: AbortSignal,
  ): Promise<AdapterTerminalResult>;
}
