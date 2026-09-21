# NotifyHandler architecture

Status: **Accepted baseline for Milestone 1, amended by ARCH-003 and ARCH-004**

NotifyHandler is a local-first desktop application that receives either a legacy textual surebet notification or a versioned structured direct-pair notification, normalizes it into exactly two bookmaker-agnostic targets, and starts two independently prepared bookmaker legs as soon as deterministic validation and navigation-safety checks pass. Authentication, changed-odds acknowledgement where required, stake entry, review, and final bet submission remain manual boundaries.

The runtime decision is recorded in `docs/adr/0001-local-desktop-playwright-runtime.md`. Automatic-start semantics are recorded in `docs/adr/0002-automatic-primary-option-startup.md`. The loopback structured-ingress and direct-link-first trust decision is recorded in `docs/adr/0003-loopback-structured-direct-pair-ingress.md`. Shared execution contracts are defined by ARCH-002 and amended by ARCH-003/ARCH-004.

## 1. Runtime model

NotifyHandler uses:

- transport adapters for legacy text/manual input and authenticated loopback structured ingestion;
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

- `specs/notification-format.md` — legacy textual normalization, source-order preservation, and primary recommendation semantics;
- `specs/structured-ingestion-v1.md` — versioned explicit two-leg payload, loopback HTTP trust boundary, idempotency/freshness, and direct-link-first rules;
- `specs/selection-target.md` — immutable bookmaker-agnostic identity target for one leg;
- `specs/execution-contract.md` — automatic plan/start trigger, exact two-leg runtime model, states, attempts, evidence epochs, commands, and derived plan status;
- `specs/bookmaker-adapter-contract.md` — core/worker/adapter interface and restricted browser/selection capability boundary;
- `specs/matching-policy.md` — deterministic event/market/line/outcome evidence and odds policy;
- `docs/error-model.md` — interruption, safe-failure, cancellation, and recovery taxonomy;
- `docs/test-strategy.md` — notification-to-auto-start, unit, contract, browser integration, transaction-boundary, and release-gate tests;
- `docs/safety-boundaries.md` — non-negotiable authentication/access/transaction boundaries.

If implementation behavior conflicts with these contracts, implementation must change or an explicit architecture change/ADR must be accepted first.

## 4. Ingestion-to-execution boundary

The core owns the transition from any accepted notification transport to one immutable two-leg execution plan.

Two input contracts are supported:

### 4.1 Legacy textual notification

1. a transport delivers text to the parser/domain boundary;
2. parsing and deterministic validation begin immediately;
3. `recommendedOptions` source order is preserved;
4. recommendation index `0` is the authoritative primary recommendation;
5. that recommendation must resolve to exactly two valid `SelectionTarget` values for distinct canonical bookmakers;
6. existing adapter-availability and navigation-candidate preflight runs;
7. the core creates one immutable `ExecutionPlan` and starts both legs automatically.

An invalid primary recommendation fails safely. The core does not ask the user to choose another recommendation and does not fall through to index 1+.

### 4.2 Structured direct-pair v1

The machine-to-machine contract is `notifyhandler.direct-pair.v1` from `specs/structured-ingestion-v1.md`.

For this version:

1. the request is accepted only through the authenticated, bounded loopback ingress policy;
2. schema, freshness, idempotency, exact-two-leg, distinct-bookmaker, market, odds, and URL requirements are validated before execution creation;
3. the explicit two legs are authoritative; there is no `recommendedOptions` chooser or fallback;
4. each required direct match link is treated as untrusted navigation input and must pass application preflight;
5. structured normalization produces exactly two immutable `SelectionTarget` values;
6. the core creates the same `ExecutionPlan` type used by the legacy path;
7. both legs start automatically, preferably concurrently.

The structured transport is not allowed to call bookmaker adapters directly. Both ingestion modes converge before the worker/adapter boundary.

### 4.3 Loopback HTTP boundary

The first structured transport is a local HTTP endpoint, conceptually:

```text
POST /api/v1/notifications/direct-pair
```

Architecture requirements:

- bind to `127.0.0.1` by default; `::1` requires an explicit local listener/configuration;
- never bind LAN/Internet interfaces by default;
- require an unguessable local bearer capability of at least 256 bits;
- keep the token outside renderer state, URLs, payloads, logs, and bookmaker/browser credentials;
- require JSON and cap request bodies at 64 KiB;
- reject unexpected browser `Origin` requests and validate the configured loopback `Host`;
- require bounded freshness and idempotency before execution creation;
- bound request concurrency/rate so ingress cannot create an unbounded number of browser starts;
- return sanitized HTTP error/result metadata only.

Remote/public webhook exposure, tunnels, reverse proxies, or Internet relays require a separate architecture/security decision.

### 4.4 Idempotency and replay

`notificationId` is the structured-v1 idempotency key and `sentAt` is required freshness evidence.

Default semantics:

- accept timestamps at most 5 minutes old and at most 60 seconds in the future;
- same id + same normalized payload hash returns the existing execution reference and never starts another plan;
- same id + different payload hash is a conflict;
- retain only a bounded id/hash/execution association, not the full raw notification, for the required duplicate-suppression horizon.

The renderer may observe parsed/plan/status updates, but renderer completion or acknowledgement is never a prerequisite for startup.

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

Notification content, structured payload fields, deep links, and bookmaker page content are untrusted.

Before accepting a notification-derived bookmaker navigation:

- URL must parse successfully;
- scheme must be exactly `https:`;
- username/password components must be empty;
- origin must exactly match an origin registered for the selected adapter;
- literal or resolved loopback/link-local/private/internal destinations are rejected;
- unsafe schemes, local files, browser-internal/custom executable schemes, and unrelated domains are blocked;
- notification-controlled strings are never used as shell commands or arbitrary browser-evaluation source.

Structured-v1 direct match links are validated twice: during core preflight and again by the browser/worker gateway immediately before navigation.

A direct match link is only a navigation/latency hint. It never proves event, competition/time context, market/context, line, outcome, or odds. Those dimensions must still be independently matched in the current evidence epoch.

Redirects and final locations do not inherit trust from the starting URL. Cross-origin/final-origin changes must pass the adapter's exact allowlist, and any navigation that can stale identity evidence advances the evidence epoch before later activation.

For structured v1, an unsafe, stale, wrong-event, blocked, or insufficient direct link produces safe failure. The worker must not silently fall back to generic homepage/competition discovery. Legacy textual input remains governed by its existing adapter navigation behavior.

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

ARCH-001 through ARCH-004 now establish the current runtime and shared contracts:

- ARCH-001 — local desktop + headed Playwright runtime;
- ARCH-002 — execution/adapter/matching/error contracts;
- ARCH-003 — deterministic automatic startup;
- ARCH-004 — versioned structured direct-pair ingestion, authenticated loopback HTTP boundary, idempotency/freshness, and direct-link-first trust semantics.

Downstream responsibilities are now explicit:

- **Application Engineer / APP-005:** implement the loopback transport and `notifyhandler.direct-pair.v1` validator, local bearer lifecycle, bounds/freshness/idempotency, and convergence into the existing automatic two-leg orchestration;
- **Bookmaker Automation Engineer / BOOK-016:** treat the immutable validated direct match link as the first navigation candidate, revalidate it at the browser boundary, and independently re-establish all identity/odds evidence without generic-discovery fallback for structured v1;
- **Security & Compliance Engineer / SEC-002:** review listener binding, token lifecycle, Host/Origin policy, replay/idempotency, URL/DNS/redirect defenses, and ingress logging/privacy;
- **QA / Integration Engineer:** prove legacy and structured inputs converge on the same state/matching/transaction contracts and that rejected ingress produces zero browser navigation.

QA-002 remains blocked until two bookmakers reach narrowly scoped evidence-backed live `Supported` status. Production release remains blocked behind that qualification.
