# Execution plan and state contract

Status: **Accepted architecture contract for Milestone 1**

This specification defines the bookmaker-agnostic execution model used after a user has reviewed a parsed notification and chosen one recommended pair. It is normative for domain, application, automation, QA, and security implementations.

## 1. Core invariants

An executable `ExecutionPlan`:

- represents exactly one user-selected recommended pair;
- contains exactly two independently addressable legs;
- contains one immutable `SelectionTarget` per leg;
- never contains an actionable stake instruction;
- never contains credentials, MFA/CAPTCHA values, cookies, or authentication tokens;
- never contains a command to submit, confirm, place, finalize, cash out, deposit, withdraw, or otherwise perform a financial transaction.

A plan is not executable until the application has displayed both normalized targets to the user.

## 2. Conceptual TypeScript contract

Implementation names may differ only if semantics remain equivalent.

```ts
type ExecutionPlanId = string;
type LegId = string;
type AttemptId = string;
type EvidenceEpoch = number;

type ExecutionPlan = Readonly<{
  id: ExecutionPlanId;
  notificationId: string;
  recommendedOptionId: string;
  createdAt: string; // ISO-8601 UTC
  legs: readonly [ExecutionLeg, ExecutionLeg];
}>;

type ExecutionLeg = Readonly<{
  id: LegId;
  target: SelectionTarget;
}>;
```

Runtime state is stored separately from the immutable plan:

```ts
type LegRuntime = Readonly<{
  legId: LegId;
  state: LegState;
  attemptId?: AttemptId;
  attemptNumber: number;
  evidenceEpoch: EvidenceEpoch;
  observedOdds?: ObservedOdds;
  lastError?: SafeFailure;
}>;
```

The plan's overall status is **derived** from its two leg states. It is not a mutable source of truth that can overwrite either leg.

## 3. Leg states

```ts
type LegState =
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
```

`MATCHING_LINE` is skipped only for a market family whose normalized target has no line/threshold by definition.

`SELECTION_PREPARED` means the verified target selection was activated in the bookmaker UI. It does **not** mean a stake was entered or a bet was submitted.

`READY_FOR_USER` is the automation handoff boundary. Automated actions for that attempt stop there.

## 4. Allowed transition graph

Normal successful path:

```text
PENDING
  -> OPENING
  -> WAITING_FOR_PAGE
  -> MATCHING_EVENT
  -> MATCHING_MARKET
  -> MATCHING_LINE? 
  -> MATCHING_OUTCOME
  -> VERIFYING_ODDS
  -> ACTIVATING_SELECTION
  -> VERIFYING_SELECTION
  -> SELECTION_PREPARED
  -> READY_FOR_USER
```

Authentication interruption:

```text
WAITING_FOR_PAGE -> AUTH_REQUIRED
AUTH_REQUIRED --resume_after_manual_auth--> WAITING_FOR_PAGE
```

The resume transition intentionally returns to `WAITING_FOR_PAGE`; it never returns directly to the point where matching previously stopped.

Changed-odds interruption:

```text
VERIFYING_ODDS -> ODDS_CHANGED
ODDS_CHANGED --continue_with_observed_odds--> WAITING_FOR_PAGE
```

Continuation after changed odds forces complete page and identity revalidation. The acknowledgement is bound to the observed odds value shown to the user. If a different odds value is observed after revalidation, the leg enters `ODDS_CHANGED` again.

Safe failure/cancellation:

- any non-terminal automated state may transition to `FAILED_SAFE` with a structured reason;
- any non-terminal automated state may transition to `CANCELLED` when cancellation is requested;
- cancellation must prevent any later selection activation for the cancelled attempt.

## 5. Attempts, retry, reopen, and stale evidence

Matching evidence belongs to an **attempt** and an **evidence epoch**.

A new attempt is required after:

- retry from `FAILED_SAFE`;
- explicit reopen;
- browser process/session replacement;
- recovery after an unrecoverable page error.

Within an attempt, increment `evidenceEpoch` and invalidate all prior positive evidence after any event that can make the page identity stale, including:

- manual login completion;
- cross-document navigation;
- redirect;
- page refresh;
- material event/market DOM replacement;
- recovery from browser disconnection;
- continuation after `ODDS_CHANGED`.

No positive evidence from an earlier epoch may authorize selection activation.

`retry` and `reopen` are not permission to weaken matching. They run the same policy from the beginning.

`restart` is a plan-level application action: construct a new runtime execution from the reviewed immutable targets. It does not reuse successful matching evidence from the previous runtime.

## 6. Commands accepted by orchestration

The application/core may conceptually issue only these execution lifecycle commands:

```ts
type LegCommand =
  | { type: "START"; legId: LegId }
  | { type: "RESUME_AFTER_MANUAL_AUTH"; legId: LegId }
  | {
      type: "CONTINUE_WITH_OBSERVED_ODDS";
      legId: LegId;
      acknowledgedObservedOdds: string;
    }
  | { type: "RETRY"; legId: LegId }
  | { type: "REOPEN"; legId: LegId }
  | { type: "CANCEL"; legId: LegId };
```

There is intentionally no lifecycle command carrying stake, credential, MFA/CAPTCHA, or transaction-submit data.

## 7. Structured progress events

Automation reports append-only progress/events to the core. Conceptually:

```ts
type LegEvent = Readonly<{
  legId: LegId;
  attemptId: AttemptId;
  evidenceEpoch: EvidenceEpoch;
  at: string;
  type: LegEventType;
  evidence?: MatchingEvidenceSnapshot;
  odds?: ObservedOdds;
  failure?: SafeFailure;
}>;
```

Events from an obsolete attempt or evidence epoch must never mutate the current leg state. This protects against late asynchronous browser callbacks after retry/cancel/reopen.

## 8. Derived plan status

A UI may derive summary labels such as:

- `NOT_STARTED` — both legs pending;
- `IN_PROGRESS` — at least one leg actively executing;
- `ACTION_REQUIRED` — at least one leg is `AUTH_REQUIRED` or `ODDS_CHANGED`;
- `PARTIAL` — one leg is `READY_FOR_USER` and the other is failed/cancelled/action-required;
- `READY_FOR_USER` — both legs are `READY_FOR_USER`;
- `FAILED_SAFE` — neither leg is in progress/action-required and the plan is not fully ready;
- `CANCELLED` — both legs cancelled.

These summaries never replace the two authoritative leg states.

## 9. Concurrency semantics

The two legs may execute concurrently or sequentially. The contract is identical in either mode.

Required behavior:

- each leg owns its own browser session, attempt id, cancellation signal, state, evidence, and error;
- a failure, login pause, odds change, cancellation, or retry on one leg does not silently cancel or rewrite the other;
- the application must not label the surebet pair fully prepared unless both legs are `READY_FOR_USER` for the currently reviewed plan.

## 10. Success invariant

Transition to `ACTIVATING_SELECTION` is legal only when the current evidence epoch satisfies all of the following:

- navigation/origin policy is satisfied;
- event identity is `MATCHED`;
- market family/context identity is `MATCHED`;
- required line identity is `MATCHED`;
- outcome identity is `MATCHED`;
- no required identity dimension is `AMBIGUOUS`, `MISMATCHED`, `UNAVAILABLE`, or `NOT_CHECKED`;
- odds policy has either produced `EQUAL`, or the user has explicitly acknowledged the exact current changed odds and a fresh revalidation has confirmed that acknowledgement is still current;
- the attempt is not cancelled.

Transition to `SELECTION_PREPARED` additionally requires post-activation verification that the intended selection is visibly selected in the bookmaker UI.

## 11. Authentication boundary

`AUTH_REQUIRED` is an interruption state, not an adapter failure.

While in `AUTH_REQUIRED`:

- NotifyHandler does not inspect or enter credential values;
- NotifyHandler does not automate MFA/OTP/security questions;
- NotifyHandler does not solve or bypass CAPTCHA;
- the user interacts directly with the headed bookmaker browser;
- no selection activation is permitted.

Resume starts a new evidence epoch and re-runs page/event/market/line/outcome/odds validation.

## 12. Transaction boundary

No execution-plan, command, state, or event type may represent stake entry or transaction submission.

Stake recommendations parsed from a notification remain informational presentation/domain data and are deliberately excluded from `ExecutionLeg`, `SelectionTarget` automation commands, and bookmaker worker commands.
