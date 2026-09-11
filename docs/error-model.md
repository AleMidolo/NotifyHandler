# Error and interruption model

Status: **Accepted architecture contract for Milestone 1**

NotifyHandler distinguishes **interruptions requiring user action**, **safe failures**, and **cancellation**. Errors must never be converted into speculative clicks.

## 1. Result categories

### Interruption

An interruption is expected workflow state, not a failure:

- `AUTH_REQUIRED` — user must authenticate manually;
- `ODDS_CHANGED` — current odds differ from notification odds and require explicit user acknowledgement before revalidation/continuation.

### Safe failure

A safe failure means the system stopped without claiming the target is prepared.

```ts
type ActivationDisposition =
  | "NOT_ATTEMPTED"
  | "ATTEMPTED_NOT_VERIFIED";

type SafeFailure = Readonly<{
  code: FailureCode;
  stage: FailureStage;
  message: string;
  recoverability: Recoverability;
  activation: ActivationDisposition;
  evidenceEpoch: number;
  diagnostic?: SanitizedDiagnostic;
}>;
```

For all failures before final selection activation, `activation` must be `NOT_ATTEMPTED`.

If the final target control was activated but post-activation verification fails, return `SELECTION_VERIFICATION_FAILED` with `activation: "ATTEMPTED_NOT_VERIFIED"`. The system must not report `SELECTION_PREPARED` or `READY_FOR_USER`; the UI must explicitly tell the user to inspect the bookmaker state manually because a selection may be present.

This distinction prevents both dangerous false success and the opposite false claim that no browser selection action occurred.

### Cancellation

Cancellation is neither success nor safe failure. It records that the user/application requested execution stop. A cancelled attempt may not emit a later selection activation. If cancellation races with an already-started final activation, the worker must report the observed activation disposition rather than silently claiming nothing occurred.

## 2. Failure stages

```ts
type FailureStage =
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
```

## 3. Failure codes

The initial shared taxonomy is:

### Plan/contract

- `INVALID_SELECTION_TARGET`
- `UNSUPPORTED_BOOKMAKER`
- `CONTRACT_VIOLATION`
- `STALE_ATTEMPT_EVENT`
- `STALE_EVIDENCE`

### Navigation/page

- `UNSAFE_OR_UNSUPPORTED_URL`
- `BLOCKED_REDIRECT`
- `PAGE_LOAD_TIMEOUT`
- `UNSUPPORTED_PAGE_STATE`
- `BROWSER_DISCONNECTED`
- `BROWSER_LAUNCH_FAILED`

### Event

- `EVENT_NOT_FOUND`
- `EVENT_MISMATCH`
- `EVENT_AMBIGUOUS`
- `EVENT_CONTEXT_UNAVAILABLE`

### Market

- `MARKET_NOT_FOUND`
- `MARKET_MISMATCH`
- `MARKET_AMBIGUOUS`
- `MARKET_CONTEXT_UNAVAILABLE`

### Line

- `LINE_NOT_FOUND`
- `LINE_MISMATCH`
- `LINE_AMBIGUOUS`
- `LINE_UNAVAILABLE`

### Outcome

- `OUTCOME_NOT_FOUND`
- `OUTCOME_MISMATCH`
- `OUTCOME_AMBIGUOUS`
- `OUTCOME_UNAVAILABLE`

### Odds

- `ODDS_UNAVAILABLE`
- `ODDS_INVALID`

Changed valid odds are not an error; they produce `ODDS_CHANGED`.

### Activation/verification

- `SELECTION_ACTIVATION_REJECTED`
- `SELECTION_ACTIVATION_FAILED`
- `SELECTION_VERIFICATION_FAILED`

## 4. Recoverability

```ts
type Recoverability =
  | "NONE"
  | "RETRY"
  | "REOPEN"
  | "USER_REVIEW"
  | "RESTART_PLAN";
```

Recoverability is a UI hint, not authorization to bypass validation.

- `RETRY`: create a new attempt against the same reviewed target;
- `REOPEN`: replace/reopen the leg browser and create a new attempt;
- `USER_REVIEW`: user must inspect the source notification/target or bookmaker page before deciding what to do;
- `RESTART_PLAN`: return to the reviewed plan/application workflow;
- `NONE`: no automatic recovery is appropriate.

Every retry/reopen starts fresh matching evidence.

`SELECTION_VERIFICATION_FAILED` with `ATTEMPTED_NOT_VERIFIED` should normally use `USER_REVIEW` before any automated retry, because the existing bookmaker state may already contain the intended or an uncertain selection.

## 5. Safe-failure invariants

The following conditions must never be represented as success:

- wrong or ambiguous event;
- wrong or ambiguous market/context;
- wrong, neighboring, ambiguous, or unavailable required line;
- wrong or ambiguous outcome;
- unsupported/unsafe current origin;
- unreadable required odds under the MVP policy;
- failed selection activation;
- failed post-selection verification;
- stale attempt/evidence;
- cancellation.

No failure handler may compensate by choosing a different event, market, line, outcome, or bookmaker.

All failures before final activation must prove `activation: "NOT_ATTEMPTED"` through the shared selection gate/activation recorder.

## 6. Authentication/challenge handling

Manual authentication is `AUTH_REQUIRED` when normal login is possible for the user.

If the page presents CAPTCHA, MFA, OTP, security questions, or another authentication challenge, NotifyHandler may only pause and hand the browser to the user. It must not attempt to solve, bypass, automate, or outsource the challenge.

If normal automation cannot safely resume after the user completes it, return an appropriate `UNSUPPORTED_PAGE_STATE` safe failure.

## 7. Sanitized diagnostics

A `SanitizedDiagnostic` may contain:

- bookmaker id;
- target id;
- stage and reason code;
- activation disposition;
- normalized candidate labels/ids where non-sensitive;
- expected and observed odds;
- safe origin and redacted path category;
- elapsed timings;
- state/attempt/evidence-epoch identifiers.

It must not contain:

- passwords, usernames entered into bookmaker login, OTP/MFA values;
- cookies, local/session-storage dumps, bearer tokens, authorization headers;
- password-manager data;
- full account pages or raw authenticated HTML by default;
- unrelated personal/account/balance information.

## 8. UI requirements

The application should translate structured failures into concise user-visible explanations while preserving the code for diagnostics.

At minimum show:

- which leg failed;
- which stage failed;
- whether final selection activation was not attempted or was attempted but could not be verified;
- expected vs observed odds when relevant;
- allowed recovery actions;
- an explicit inspection warning after `ATTEMPTED_NOT_VERIFIED` before any retry/reopen.

Never tell the user the pair is ready when either current leg is not `READY_FOR_USER`.
