# NotifyHandler architecture

Status: **Accepted baseline for Milestone 1, amended by ARCH-003**

NotifyHandler is a local-first desktop application that receives a surebet notification, deterministically resolves its primary recommendation, and starts two independently prepared bookmaker legs as soon as required validation and navigation-safety checks pass. Authentication, changed-odds acknowledgement where required, stake entry, review, and final bet submission remain manual boundaries.

The runtime decision is recorded in `docs/adr/0001-local-desktop-playwright-runtime.md`. Automatic-start semantics are recorded in `docs/adr/0002-automatic-primary-option-startup.md`. Shared execution contracts are defined by ARCH-002 and amended by ARCH-003.

## 1. Runtime model

NotifyHandler uses:

- an unprivileged desktop renderer for notification input/observability, execution status, recovery actions, and manual handoff;
- a trusted local core/main process for transport handoff, domain integration, automatic primary-option resolution, execution-plan construction, automatic two-leg orchestration, state, and typed IPC;
- a separate browser-automation worker containing the adapter registry, matching policy, navigation policy, and browser gateway;
- Playwright controlling dedicated visible/headed Chromium processes for bookmaker navigation and selection preparation;
- isolated, application-owned browser/session state per leg for the MVP.

TypeScript/Node.js is the common implementation language. An Electron-style shell is the preferred desktop host. Bookmaker pages are never embedded in the renderer.

The normal valid-notification path has **no renderer-owned pre-execution gate**. Preview rendering, target summaries, and status display are observability and must not delay browser startup.

## 2. Component model

```text
Input transport
      |
      v
+-------------------------------+
| Local Core / Main Process     |
| parse + deterministic validate|
| resolve primary recommendation|
| build exactly two targets     |
| preflight adapter/navigation  |
| auto-start two-leg execution  |
| sanitized diagnostics         |
+---------------+---------------+
                | typed worker protocol
      +---------+---------+
      |                   |
      v                   v
+------------------+   +------------------+
| Automation Leg A |   | Automation Leg B |
| adapter + policy |   | adapter + policy |
+--------+---------+   +--------+---------+
         |                      |
         v                      v
+------------------+   +------------------+
| Headed Chromium A|   | Headed Chromium B|
| isolated session |   | isolated session |
+------------------+   +------------------+

       core state/events
             |
             v
+-------------------------------+
| Desktop Renderer              |
| non-blocking parsed/target view|
| per-leg status/user recovery  |
+-------------------------------+
```

Bookmaker-specific DOM knowledge exists only in bookmaker adapters and their fixtures/tests.

## 3. Normative contract map

Downstream implementation must use these shared contracts:

- `specs/notification-format.md` — transport-neutral normalization, source-order preservation, and primary recommendation semantics;
- `specs/selection-target.md` — immutable bookmaker-agnostic identity target for one leg;
- `specs/execution-contract.md` — automatic plan/start trigger, exact two-leg runtime model, states, attempts, evidence epochs, commands, and derived plan status;
- `specs/bookmaker-adapter-contract.md` — core/worker/adapter interface and restricted browser/selection capability boundary;
- `specs/matching-policy.md` — deterministic event/market/line/outcome evidence and odds policy;
- `docs/error-model.md` — interruption, safe-failure, cancellation, and recovery taxonomy;
- `docs/test-strategy.md` — notification-to-auto-start, unit, contract, browser integration, transaction-boundary, and release-gate tests;
- `docs/safety-boundaries.md` — non-negotiable authentication/access/transaction boundaries.

If implementation behavior conflicts with these contracts, implementation must change or an explicit architecture change/ADR must be accepted first.

## 4. Automatic notification-to-execution boundary

The core owns the transition from input receipt to execution startup.

For the initial notification contract:

1. a transport delivers one notification to the core/application ingestion boundary;
2. parsing and deterministic validation begin immediately;
3. `recommendedOptions` source order is preserved;
4. the first recommendation in source order is the **primary recommendation**;
5. the primary recommendation must resolve deterministically to exactly two valid `SelectionTarget` values for distinct canonical bookmakers;
6. both bookmakers must have registered adapters and each target must pass pre-navigation validation, including safe/approved navigation candidates;
7. the core creates one immutable `ExecutionPlan` and starts both legs automatically, preferably concurrently;
8. the renderer may receive parsed/plan/status updates in parallel, but renderer completion or acknowledgement is not a prerequisite for step 7.

If any preflight condition fails, the core returns a structured safe failure **before bookmaker navigation**. It must not ask the user to choose a recommendation and must not silently fall through to a later recommendation.

A future notification version may define an explicit primary/preferred marker, but that requires a versioned protocol/spec change. It must not be inferred heuristically.

## 5. Renderer boundary

The renderer is an unprivileged presentation and recovery surface. It may:

- submit or receive notification input through a transport integration;
- display normalized parsing results and the automatically resolved primary recommendation;
- display the exact two immutable targets and execution status, including if execution has already started;
- display independent leg states, evidence summaries, odds changes, failures, and safe recovery actions;
- request manual-auth resume, changed-odds continuation, retry, reopen, cancel, and plan restart through typed IPC.

The renderer does **not** own or require:

- recommended-pair selection in the normal flow;
- parsed-preview acknowledgement;
- execution-summary confirmation;
- a user-driven start command for a newly valid notification.

It must not:

- import Playwright or bookmaker adapters;
- contain bookmaker DOM selectors;
- access bookmaker credentials, cookies, tokens, raw storage, or browser profiles;
- receive generic browser-control capabilities.

Renderer context isolation and disabled Node integration are required.

## 6. Core/main-process boundary

The core owns bookmaker-agnostic application behavior:

- transport-neutral notification receipt;
- parser/domain handoff and deterministic validation;
- deterministic primary recommendation resolution from source order;
- conversion of that primary option into exactly two immutable `SelectionTarget` legs;
- adapter-availability and navigation-candidate preflight;
- creation of the immutable `ExecutionPlan`;
- automatic start of both leg runtimes without a renderer start request;
- independent per-leg runtime state;
- attempt/evidence-epoch freshness checks;
- cancellation and safe recovery commands;
- adapter lookup by canonical bookmaker id;
- sanitized diagnostics/result propagation.

The core does not receive raw browser objects and never sends credentials, stake-entry commands, or transaction commands to the worker.

The overall plan status is derived from the two authoritative leg states; one leg can never overwrite the other.

### 6.1 Implementation/API consequences

Domain/Application implementations must provide a deterministic primary-plan path. Equivalent APIs are acceptable, but semantics should resemble one of:

```ts
resolvePrimaryRecommendation(notification): RecommendedOption
buildPrimaryExecutionPlan(notification, createdAt): ExecutionPlan
```

or an application composition that takes `notification.recommendedOptions[0].id` and invokes the existing validated `buildExecutionPlan(...)` function.

Whichever form is used:

- source order is authoritative;
- no UI-selected recommendation id participates in the normal path;
- no fallback to recommendation index 1+ is allowed when index 0 fails;
- plan construction and startup are one continuous core workflow after deterministic preflight;
- existing explicit plan-building APIs may remain for tests/tools, but the production ingestion path must not depend on a user-selected id.

## 7. Browser-automation worker boundary

Only the automation worker may import Playwright and bookmaker adapter modules.

The worker owns:

- browser launch/cleanup;
- isolated leg sessions;
- allowed-origin/deep-link/redirect validation;
- page readiness;
- manual-login interruption coordination;
- adapter execution;
- shared matching/evidence policy;
- observed-odds capture/comparison;
- final verified selection activation through the shared activation gate;
- structured progress/result/error events.

Adapters do not receive the Electron renderer, application privilege surface, credential stores, password manager access, or raw application filesystem authority.

Adapters should receive a restricted bookmaker-page abstraction rather than raw Playwright `Browser`, `BrowserContext`, or `Page` objects as their public dependency.

The worker-level `start(...)` operation remains valid, but it is invoked by the core automatically after plan preflight. It is not a renderer/user approval operation.

## 8. Browser/session model

Each leg receives a dedicated headed Chromium session/process with an ephemeral application-owned profile by default.

The application must not attach to the user's normal Chrome/Edge profile through remote debugging.

This provides isolation between bookmakers/legs, reduced exposure to unrelated sessions, independent cancellation/cleanup, clearer manual takeover, and deterministic fixture testing.

If both legs use the same bookmaker, the notification is non-executable under the current primary-option invariant before any browser session starts. Separate same-bookmaker execution is therefore not part of the initial surebet path.

Persistent authenticated bookmaker profiles are deferred and require a separate Security review/ADR.

## 9. Authentication boundary

If a bookmaker requires authentication:

1. adapter/worker reports `AUTH_REQUIRED` for that leg;
2. automated actions for that leg pause;
3. the user authenticates directly in the visible bookmaker browser;
4. the user requests resume;
5. the worker creates a fresh evidence epoch and re-runs origin, event, market, line, outcome, and odds validation.

This is a post-start interruption and does not reintroduce a normal pre-execution confirmation step.

NotifyHandler never receives/types credentials, reads password-manager secrets, automates MFA/OTP/security questions, or solves/bypasses CAPTCHA.

## 10. Matching and confidence architecture

Selection authorization is predicate-based, not score-based.

Required identity dimensions are independently classified as `NOT_CHECKED`, `MATCHED`, `MISMATCHED`, `AMBIGUOUS`, or `UNAVAILABLE`. Only `MATCHED` authorizes a required identity dimension.

Fuzzy similarity may help discover candidates but cannot itself authorize selection. Approved aliases must be deterministic/version-controlled/tested. Exact numeric line matching uses decimal-safe semantics with no nearest-line tolerance.

See `specs/matching-policy.md` for normative rules.

## 11. Odds policy

Expected odds from the notification and observed bookmaker odds are always distinct values.

For the MVP:

- equal odds can proceed when identity is fully matched;
- higher/lower changed odds produce `ODDS_CHANGED` before selection activation;
- the user must explicitly acknowledge the exact observed value;
- continuation invalidates prior evidence and fully revalidates page/identity/odds;
- if the value changes again, the application pauses again;
- unavailable/unreadable odds fail safely and do not activate the selection.

This is an execution-time interruption after automatic startup, not a pre-execution approval gate. Odds never compensate for wrong/ambiguous identity.

## 12. State, attempts, and stale evidence

The exact state graph is defined in `specs/execution-contract.md`.

Key architecture rules:

- both legs are created and scheduled automatically for a valid plan;
- two legs remain independently addressable;
- every execution attempt has a unique attempt id;
- matching evidence belongs to an evidence epoch;
- manual login, redirect, refresh, reopen, browser replacement, changed-odds continuation, or meaningful page replacement invalidates stale positive evidence;
- late events from obsolete attempts/epochs cannot mutate current state;
- retry/reopen never skip matching stages;
- cancellation prevents any later final selection activation for that attempt.

## 13. Selection activation boundary

Adapters must not perform the final requested outcome click through an unrestricted public `click()` contract.

The final candidate plus current evidence is submitted to a shared `SelectionActivationGate`. The gate permits activation only when current origin is approved; event, market/context, required exact line, and outcome are matched; odds policy is satisfied; evidence belongs to the current attempt/epoch; and cancellation has not occurred.

After activation, the adapter must verify that the exact target selection is visibly selected before reporting `SELECTION_PREPARED`/`READY_FOR_USER`.

Automatic startup never bypasses this gate.

## 14. Transaction boundary by design

The system models selection preparation, not wagering.

No public renderer/core/worker/adapter contract may contain operations equivalent to credential entry or MFA/CAPTCHA automation; stake entry/change/calculation for bookmaker submission; `placeBet`, `submitBet`, `confirmBet`, `finalizeBet`, or equivalent; deposits/withdrawals/cash-out; or access-control/anti-bot/rate-limit/geo-restriction bypass.

Stake recommendations may remain informational domain/presentation data but are not forwarded as browser actions.

Adding a transaction capability is an architecture-breaking change and release blocker.

## 15. Navigation and trust boundaries

Notification content, deep links, and bookmaker page content are untrusted.

Before the core considers a plan ready to start, each leg must have a supported adapter and a navigation candidate that can be validated under the adapter's origin policy. The worker performs authoritative validation immediately before every top-level navigation and redirect acceptance.

- scheme must be `https`;
- origin must be explicitly registered to the selected adapter;
- unsafe schemes, localhost, loopback/link-local/private internal-network destinations, and unrelated domains are blocked when input-controlled;
- cross-origin redirects require allow-list validation;
- navigation/redirect invalidates stale matching evidence.

The renderer never renders untrusted bookmaker HTML.

## 16. Persistence and diagnostics

MVP persistent application data should be minimal and non-sensitive.

Do not persist as application records credentials/MFA values, cookies/raw browser storage, authentication tokens/headers, authenticated page dumps/screenshots by default, or positive matching evidence for reuse after restart.

Diagnostics should prefer canonical ids, primary recommendation id/index, state transitions, error codes, sanitized candidate labels, expected/observed odds, notification-receipt/plan-ready/browser-open timing, and redacted origin/path information.

## 17. Testability and latency observability

Routine CI must not require bookmaker credentials, live accounts, or transactions.

The normative test strategy is `docs/test-strategy.md` and includes:

- notification receipt -> primary resolution -> plan -> automatic two-leg worker start with zero pre-execution user action;
- invalid/ambiguous primary recommendation -> zero worker starts/navigation and no fallback;
- non-blocking renderer observability;
- pure state/matching/decimal/origin unit tests;
- one reusable shared adapter contract suite;
- deterministic sanitized local fixture pages;
- browser integration tests for session lifecycle, redirects, cancellation, stale evidence, and selection-gate behavior;
- application integration tests for independent two-leg status and action-required flows;
- static/package-boundary tests proving stake/bet-submit/credential capabilities are absent.

Instrumentation should make notification-receipt, plan-ready, and first-browser-open timestamps available as sanitized diagnostics so latency can be measured without weakening validation.

Live bookmaker checks, when permitted, remain manual/non-transactional verification and are not routine CI gates.

## 18. Packaging implications

Downstream Release/DevOps work should provide strict TypeScript/Node package boundaries, desktop renderer/core packaging, reproducibly pinned Playwright/Chromium runtime, cleanup for orphaned browser/worker processes, CI commands for unit/local fixture tests, and no required bookmaker secrets in CI.

Exact package manager, Electron/Node/Playwright versions, bundler, installer/signing approach, and supported OS targets remain DevOps decisions constrained by this architecture.

## 19. Architecture completion state

ARCH-001 selected the runtime. ARCH-002 stabilized execution/adapter safety contracts. ARCH-003 removes obsolete pre-execution review/selection/start assumptions and defines deterministic automatic primary-option startup.

Current downstream priorities are:

- APP-002 / #21 — implement notification-to-automatic-two-leg orchestration against this amended contract;
- QA-001 / #6 — add end-to-end automatic-start and no-fallback regressions plus the remaining safety suite;
- SEC-001 / #7 — complete threat-model/security hardening for the accepted local runtime and automatic flow;
- second bookmaker path — provide the second adapter needed for a real two-bookmaker preparation pair.

Existing APP-001 preview/selector code may remain as non-blocking observability or tooling, but it must not gate the production valid-notification path.
