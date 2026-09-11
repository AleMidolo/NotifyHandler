# Bookmaker adapter contract

Status: **Accepted architecture contract for Milestone 1**

This specification defines how bookmaker-specific code participates in execution without leaking DOM details into the core application or gaining transaction-submission capabilities.

## 1. Boundary

The core application knows only:

- canonical bookmaker id;
- immutable `SelectionTarget`;
- execution lifecycle commands;
- structured progress/evidence/results.

It does not know selectors, bookmaker HTML, browser locators, or bookmaker-specific navigation rules.

Each bookmaker integration implements this contract inside the browser-automation worker.

## 2. Public automation port exposed to the core

Conceptually:

```ts
interface BookmakerAutomationPort {
  start(request: StartLegRequest): AsyncIterable<LegEvent>;
  resumeAfterManualAuth(request: ResumeLegRequest): AsyncIterable<LegEvent>;
  continueWithObservedOdds(request: ContinueOddsRequest): AsyncIterable<LegEvent>;
  retry(request: RetryLegRequest): AsyncIterable<LegEvent>;
  reopen(request: ReopenLegRequest): AsyncIterable<LegEvent>;
  cancel(request: CancelLegRequest): Promise<void>;
}
```

The core talks to this worker-level port, not directly to Playwright or bookmaker adapters.

Every request is keyed by `legId`, `attemptId` where applicable, and the immutable target identity. Late events from obsolete attempts must be ignored.

## 3. Adapter interface inside the worker

```ts
interface BookmakerAdapter {
  readonly bookmaker: BookmakerId;
  readonly supportedOrigins: readonly HttpsOrigin[];

  prepare(
    ctx: AdapterExecutionContext,
    target: SelectionTarget,
    observer: AdapterObserver,
    signal: AbortSignal,
  ): Promise<AdapterTerminalResult>;
}
```

`prepare` owns one fresh validation pass from page readiness through either:

- `READY_FOR_USER`;
- `AUTH_REQUIRED`;
- `ODDS_CHANGED`;
- `FAILED_SAFE`;
- `CANCELLED`.

Resume/retry/reopen are orchestrator/worker lifecycle operations that call the adapter again with fresh evidence. An adapter must not provide a special fast-path that reuses stale successful matching.

## 4. Adapter execution context

```ts
interface AdapterExecutionContext {
  readonly legId: LegId;
  readonly attemptId: AttemptId;
  readonly evidenceEpoch: number;
  readonly browser: BookmakerPagePort;
  readonly selectionGate: SelectionActivationGate;
  readonly clock: Clock;
  readonly policy: MatchingPolicy;
  readonly acknowledgedObservedOdds?: DecimalOddsString;
}
```

The adapter does **not** receive the Electron renderer, application state store, filesystem credentials, password manager access, or raw browser profile data.

## 5. Restricted browser/page capability

Bookmaker adapters must not receive a raw Playwright `Browser`, `BrowserContext`, or `Page` object as their public dependency.

They receive a worker-owned capability abstraction conceptually similar to:

```ts
interface BookmakerPagePort {
  openAllowed(url: HttpsUrl): Promise<NavigationResult>;
  currentLocation(): Promise<SafeLocation>;
  waitForPageReady(options: PageReadyOptions): Promise<PageReadyResult>;

  query(query: ReadQuery): Promise<readonly ElementSnapshot[]>;
  readText(ref: ElementRef): Promise<string>;
  readAttribute(ref: ElementRef, name: SafeAttributeName): Promise<string | null>;
  isVisible(ref: ElementRef): Promise<boolean>;

  activateNavigationControl(action: NonTransactionalUiAction): Promise<UiActionResult>;
}
```

The exact read/query abstraction may be implemented on Playwright locators, but raw browser objects do not cross the shared adapter boundary.

`activateNavigationControl` is limited to non-transactional page navigation/disclosure actions required to expose an event or market. It must be auditable and may not carry stake values or transaction intent.

## 6. Selection activation gate

The final requested betting outcome is not clicked through a generic adapter `click()` method.

The adapter submits the candidate and current structured evidence to a shared gate:

```ts
interface SelectionActivationGate {
  activate(request: Readonly<{
    target: SelectionTarget;
    candidate: ElementRef;
    evidence: MatchingEvidenceSnapshot;
    odds: ObservedOdds;
    acknowledgedObservedOdds?: DecimalOddsString;
  }>): Promise<SelectionActivationResult>;
}
```

The gate must reject activation unless the current evidence epoch satisfies `specs/execution-contract.md` and `specs/matching-policy.md`.

The gate performs only the single verified selection activation and post-click verification support. It contains no stake-entry or bet-submission operation.

## 7. Navigation policy

Before every top-level navigation or redirect acceptance:

- scheme must be `https`;
- origin must be registered to the selected adapter;
- localhost, loopback, link-local, private/internal-network destinations, `file:`, `data:`, `javascript:`, custom executable schemes, and unrelated domains are rejected;
- cross-origin redirects require explicit allow-list membership;
- a redirect/navigation that can stale identity evidence starts a new evidence epoch before any later activation.

A notification deep link is a navigation candidate, not trusted executable input.

## 8. Required adapter algorithm

For every fresh preparation pass, an adapter must conceptually:

1. validate and open an allowed deep link or approved entry point;
2. wait for a supported page state;
3. return `AUTH_REQUIRED` if user authentication is needed;
4. enumerate event candidates;
5. evaluate event evidence using the shared policy;
6. establish exactly one acceptable event;
7. enumerate/find market candidates;
8. establish exact market family/context;
9. establish exact line when required;
10. establish exact outcome/side;
11. read observed odds;
12. compare observed to expected odds;
13. return `ODDS_CHANGED` before activation when changed;
14. submit the selected candidate plus evidence to `SelectionActivationGate`;
15. verify the intended candidate is selected;
16. return `READY_FOR_USER`.

Any ambiguous, contradictory, unavailable required identity, unsupported page state, blocked navigation, or verification failure returns a structured safe failure without speculative selection.

## 9. Terminal result

```ts
type AdapterTerminalResult =
  | {
      kind: "READY_FOR_USER";
      evidence: MatchingEvidenceSnapshot;
      odds: ObservedOdds;
      selection: VerifiedPreparedSelection;
    }
  | {
      kind: "AUTH_REQUIRED";
      safeLocation: SafeLocation;
    }
  | {
      kind: "ODDS_CHANGED";
      evidence: MatchingEvidenceSnapshot;
      odds: ObservedOdds;
    }
  | {
      kind: "FAILED_SAFE";
      failure: SafeFailure;
      evidence?: MatchingEvidenceSnapshot;
      odds?: ObservedOdds;
    }
  | { kind: "CANCELLED" };
```

A `READY_FOR_USER` result is invalid unless post-activation verification succeeded for the exact target candidate.

## 10. Authentication behavior

Adapters may detect that a login boundary exists and may report it. They must not:

- read username/password field contents;
- receive credentials from the app;
- type credentials;
- interact with password managers;
- type or retrieve OTP/MFA/security answers;
- solve, bypass, or outsource CAPTCHA;
- defeat authentication restrictions.

After manual login, the worker starts a fresh validation pass.

## 11. Explicitly absent capabilities

No interface in this contract contains or may acquire an operation equivalent to:

- `enterCredentials`;
- `submitOtp` / `handleMfa` / `solveCaptcha`;
- `setStake` / `enterStake` / `changeStake`;
- `placeBet` / `submitBet` / `confirmBet` / `finalizeBet`;
- `deposit` / `withdraw` / `cashOut`;
- anti-bot, geo, access-control, or rate-limit bypass.

Adding any such capability is an architecture-breaking change and a release blocker.

## 12. Cancellation

The worker supplies an `AbortSignal` for each active attempt.

Adapters must:

- check/propagate cancellation through waits and navigation;
- avoid starting a new UI action after cancellation is observed;
- never call `SelectionActivationGate.activate` after the attempt is cancelled;
- return `CANCELLED` rather than converting cancellation into a generic failure.

The worker must discard late adapter events after cancellation.

## 13. Diagnostics

Adapter diagnostics may include:

- sanitized origin/path category;
- normalized candidate labels;
- evidence status/reason codes;
- expected and observed odds;
- timings and state transitions.

They must not include:

- credentials/MFA values;
- cookies/storage tokens;
- authorization headers;
- complete account-page HTML/screenshots by default;
- unrelated personal/session data.

## 14. Contract-test requirements

Every adapter implementation must pass the same deterministic contract suite against sanitized local fixtures covering:

- exact successful selection preparation;
- wrong event;
- duplicate/ambiguous event;
- wrong market family/context;
- neighboring numeric line;
- wrong outcome;
- duplicate/ambiguous outcome;
- changed odds interruption;
- manual-login interruption;
- blocked unsafe origin/redirect;
- cancellation before selection activation;
- failed post-click selection verification;
- absence of stake and bet-submit operations.

Bookmaker-specific tests may add cases but may not weaken these shared requirements.
