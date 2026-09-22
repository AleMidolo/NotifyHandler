# Execution plan and state contract

Status: **Accepted architecture contract for Milestone 1, amended by ARCH-003, ARCH-004, and ARCH-005**

This specification defines the bookmaker-agnostic execution model from receipt of a valid notification through automatic two-leg startup, execution-time interruptions, and manual handoff. It is normative for domain, application, automation, QA, and security implementations.

## 1. Core invariants

An executable `ExecutionPlan`:

- represents exactly one authoritative two-leg source: either the legacy notification's deterministic primary recommendation (index `0` in preserved source order) or the explicit pair in `notifyhandler.direct-pair.v1`;
- contains exactly two independently addressable legs;
- contains one immutable `SelectionTarget` per leg;
- targets two distinct canonical bookmakers;
- has passed deterministic target validation, adapter-availability checks, and pre-navigation safety checks required before dispatch;
- never contains an actionable stake instruction;
- never contains credentials, MFA/CAPTCHA values, cookies, or authentication tokens;
- never contains a command to submit, confirm, place, finalize, cash out, deposit, withdraw, or otherwise perform a financial transaction.

A valid plan does **not** require user preview, recommended-option choice, execution-summary approval, or a manual start action. Displaying parsed/plan data is non-blocking observability.

If the primary recommendation is invalid, ambiguous, same-bookmaker, unsupported, or cannot yield exactly two valid targets, execution fails before bookmaker navigation. The system must not silently use a later recommendation.

## 2. Authoritative pair construction

There are two accepted sources for plan construction.

### 2.1 Legacy textual source

For `specs/notification-format.md`:

1. preserve `recommendedOptions` source order;
2. use recommendation index `0` as the authoritative primary;
3. resolve it to exactly two distinct supported bookmaker targets;
4. fail safely on invalid/ambiguous/same-bookmaker/unsupported primary input;
5. never fall through to a later recommendation.

### 2.2 Structured direct-pair v1/v2 source

For `specs/structured-ingestion-v1.md` and `specs/structured-ingestion-v2.md`:

1. validate the authenticated/bounded structured request;
2. treat `legs[0]` and `legs[1]` as the authoritative pair;
3. require exactly two distinct supported canonical bookmakers;
4. require a valid source-version-appropriate navigation candidate for each leg;
5. normalize both legs into immutable `SelectionTarget` values;
6. fail safely on any schema, freshness, idempotency, semantic, bookmaker, or URL violation;
7. never synthesize `recommendedOptions` and never substitute another pair.

Both sources produce the same `ExecutionPlan` and runtime state model. Source selection affects only pre-plan normalization/provenance, not bookmaker execution semantics.

## 3. Conceptual TypeScript contract

Implementation names may differ only if semantics remain equivalent.

```ts
type ExecutionPlanId = string;
type LegId = string;
type AttemptId = string;
type EvidenceEpoch = number;

type ExecutionPlan = Readonly<{
  id: ExecutionPlanId;
  notificationId: string;
  recommendedOptionId: string; // resolved primary option
  recommendedOptionIndex: 0;   // initial notification contract
  createdAt: string;            // ISO-8601 UTC
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

The plan's overall status is derived from its two leg states. It is not a mutable source of truth that can overwrite either leg.

`recommendedOptionIndex` need not be stored literally if the implementation can prove the id came from primary source-order resolution, but that provenance must remain diagnosable.

## 4. Automatic-start trigger and preflight

A plan is dispatched automatically when its source-specific normalization has produced exactly two valid immutable targets and common preflight succeeds.

Common preflight requires:

- two distinct supported bookmaker adapters;
- required event/market/line/outcome/expected-odds fields;
- navigation candidates satisfying application-level URL policy;
- no stale/cancelled prior execution being reused;
- no renderer/user approval dependency.

Structured v1 additionally requires:

- authenticated loopback request acceptance;
- supported schema version;
- request size/media-type policy;
- accepted `sentAt` freshness;
- idempotency registration;
- required direct match links for both legs.

For structured v1, URL failure produces safe failure before worker start. The application must not replace the direct link with a generic bookmaker entry point.

After preflight the core creates the plan and dispatches both legs, preferably concurrently. Worker-level `START` remains an internal lifecycle operation; it is not a renderer/user command.

## 5. Leg states

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

`PENDING` is normally transient after a valid plan is created because automatic dispatch follows immediately.

`MATCHING_LINE` is skipped only for a market family whose normalized target has no line/threshold by definition.

`SELECTION_PREPARED` means the verified target selection was activated in the bookmaker UI. It does not mean a stake was entered or a bet was submitted.

`READY_FOR_USER` is the automation handoff boundary. Automated actions for that attempt stop there.

## 6. Allowed transition graph

Normal automatically started path:

```text
plan ready
  -> PENDING
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

## 7. Attempts, retry, reopen, restart, and stale evidence

Matching evidence belongs to an attempt and an evidence epoch.

A new attempt is required after retry from `FAILED_SAFE`, explicit reopen, browser process/session replacement, or recovery after an unrecoverable page error.

Within an attempt, increment `evidenceEpoch` and invalidate all prior positive evidence after any event that can make page identity stale, including manual login completion, cross-document navigation, redirect, page refresh, material event/market DOM replacement, browser-disconnection recovery, or continuation after `ODDS_CHANGED`.

No positive evidence from an earlier epoch may authorize selection activation.

`retry` and `reopen` are not permission to weaken matching. They run the same policy from the beginning.

`restart` is a plan-level recovery action that constructs a new runtime execution from the same immutable automatically resolved targets. It does not ask the user to re-select a recommendation and does not reuse matching evidence. A newly received/edited notification is a new input and must be parsed/resolved as a new plan.

## 8. Commands accepted by orchestration

At the worker lifecycle boundary, the core may conceptually issue:

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

`START` is an **internal core-to-worker dispatch generated automatically by plan readiness**. The renderer/user does not issue `START` in the normal valid-notification path.

The renderer may request only post-start/recovery commands exposed by product policy: manual-auth resume, changed-odds continuation, retry, reopen, cancel, and plan restart.

There is intentionally no lifecycle command carrying stake, credential, MFA/CAPTCHA, or transaction-submit data.

## 9. Structured progress events

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

## 10. Derived plan status

A UI may derive summary labels such as:

- `STARTING` — plan is valid and one/both automatic start dispatches are pending;
- `IN_PROGRESS` — at least one leg is actively executing;
- `ACTION_REQUIRED` — at least one leg is `AUTH_REQUIRED` or `ODDS_CHANGED`;
- `PARTIAL` — one leg is `READY_FOR_USER` and the other is failed/cancelled/action-required;
- `READY_FOR_USER` — both legs are `READY_FOR_USER`;
- `FAILED_SAFE` — neither leg is in progress/action-required and the plan is not fully ready;
- `CANCELLED` — both legs cancelled.

`NOT_STARTED` may exist internally before automatic dispatch, but it must not represent a normal user-awaiting-start state.

These summaries never replace the two authoritative leg states.

## 11. Concurrency semantics

For a valid plan, both legs are scheduled as soon as safely practical. Concurrent startup is the default architectural intent because notification-to-browser-open latency is a product requirement.

Required behavior:

- preflight validates both targets before either is intentionally dispatched, so a known invalid/unsupported second leg cannot trigger navigation of only the first;
- once dispatch begins, each leg owns its own browser session, attempt id, cancellation signal, state, evidence, and error;
- runtime launch/failure on one leg does not silently cancel, rewrite, or block the other leg after dispatch;
- a login pause, odds change, cancellation, or retry on one leg does not rewrite the other;
- the application must not label the surebet pair fully prepared unless both legs are `READY_FOR_USER` for the current plan.

Sequential execution is allowed only as a documented implementation fallback where concurrency is technically unsafe; it must not be caused by renderer acknowledgement or pair-selection UX.

## 12. Success invariant

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

Automatic plan/start semantics never weaken these predicates.

## 13. Authentication boundary

`AUTH_REQUIRED` is an execution-time interruption state, not an adapter failure or initial startup gate.

While in `AUTH_REQUIRED`:

- NotifyHandler does not inspect or enter credential values;
- NotifyHandler does not automate MFA/OTP/security questions;
- NotifyHandler does not solve or bypass CAPTCHA;
- the user interacts directly with the headed bookmaker browser;
- no selection activation is permitted.

Resume starts a new evidence epoch and re-runs page/event/market/line/outcome/odds validation.

## 14. Odds interruption boundary

`ODDS_CHANGED` occurs only after automatic execution has started and the current target has been located sufficiently to read its price.

The system surfaces expected and observed odds and requires the existing explicit acknowledgement policy before continuing. This does not create a general plan-confirmation step: it is bound to one concrete changed price on one active leg.

Continuation starts fresh validation. Another changed value pauses again.

## 15. Transaction boundary

No execution-plan, command, state, or event type may represent stake entry or transaction submission.

Stake recommendations parsed from a notification remain informational domain/presentation data and are deliberately excluded from `ExecutionLeg`, `SelectionTarget` automation commands, and bookmaker worker commands.

## 16. Automatic-start failure semantics

Before worker dispatch, deterministic failures use structured plan/input failure codes and must cause **zero bookmaker navigations**. Examples include:

- malformed/ambiguous notification;
- missing primary recommendation;
- primary recommendation resolves to other than two legs;
- primary recommendation resolves both legs to the same bookmaker;
- unsupported bookmaker adapter;
- target invalid for its market;
- deep-link/navigation candidate rejected by preflight.

The system does not ask the user to repair the pair as part of automatic execution and does not try a later recommendation.

After dispatch, worker/adapter failures follow `docs/error-model.md` and preserve independent leg state.

## 17. Structured-v1 direct-link runtime semantics

When a plan originates from `notifyhandler.direct-pair.v1`:

- each leg carries its immutable direct match link as untrusted navigation provenance;
- the worker/browser gateway revalidates HTTPS, URL userinfo, exact approved origin, private/internal-target policy, and redirects immediately before navigation;
- successful navigation creates no positive identity evidence by itself;
- event, competition/time context, market/context, exact line, outcome, and displayed odds must still be matched in the current evidence epoch;
- a redirect or material navigation invalidates prior evidence;
- `AUTH_REQUIRED` resume revalidates current origin and, when needed, may reopen only the same validated immutable direct link before a fresh full match pass;
- `ODDS_CHANGED`, cancellation, stale-event rejection, and activation-gate behavior are unchanged;
- direct-link failure never authorizes generic-discovery fallback for structured v1.

The HTTP transport's duplicate/idempotency handling is outside the leg state machine: an exact duplicate returns the already-created execution reference and does not create a new attempt or plan.


## 18. Relay-resolution phase

For a v2 `BETUP_RELAY` target, relay resolution is part of `OPENING` / navigation readiness, before event matching.

Rules:

- no positive identity evidence is recorded on the relay origin;
- cancellation during relay resolution prevents any later matching/activation;
- an unexpected intermediary, wrong bookmaker destination, private/internal target, loop/limit, or relay challenge produces `FAILED_SAFE` before event matching;
- successful arrival at the expected bookmaker origin advances to a fresh evidence epoch before `MATCHING_EVENT`;
- only bookmaker-side login after successful relay resolution may produce `AUTH_REQUIRED`;
- retry/reopen starts relay resolution again from the immutable typed navigation target;
- a previously resolved bookmaker URL is not trusted/reused as plan input.

The state graph does not add a user-visible pre-execution confirmation state. Relay resolution is automatic and bounded.
