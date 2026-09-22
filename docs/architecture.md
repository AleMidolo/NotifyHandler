# NotifyHandler architecture

Status: **Accepted baseline for Milestone 1, amended by ARCH-003, ARCH-004, ARCH-005, and ARCH-006**

NotifyHandler is a local-first desktop application that receives either a legacy textual surebet notification or a versioned structured direct-pair notification, normalizes it into exactly two bookmaker-agnostic targets, and starts two independently prepared bookmaker legs as soon as deterministic validation and navigation-safety checks pass. Authentication, changed-odds acknowledgement where required, stake entry, review, and final bet submission remain manual boundaries.

The runtime decision is recorded in `docs/adr/0001-local-desktop-playwright-runtime.md`. Automatic-start semantics are recorded in `docs/adr/0002-automatic-primary-option-startup.md`. The loopback structured-ingress/direct-bookmaker-link decision is recorded in `docs/adr/0003-loopback-structured-direct-pair-ingress.md`. Relay-aware typed navigation and restricted `bet-up.it` resolution are recorded in `docs/adr/0004-betup-relay-resolution.md`. Shared execution contracts are defined by ARCH-002 and amended by ARCH-003/ARCH-004/ARCH-005.

## 1. Runtime model

NotifyHandler uses:

- transport adapters for legacy text/manual input and authenticated loopback structured ingestion;
- an unprivileged desktop renderer for notification input/observability, execution status, recovery actions, and manual handoff;
- a trusted local core/main process for transport handoff, domain integration, automatic primary-option resolution, execution-plan construction, automatic two-leg orchestration, state, and typed IPC;
- a separate browser-automation worker containing the adapter registry, typed navigation resolver, matching policy, navigation policy, and browser gateway;
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
- `specs/structured-ingestion-v1.md` — frozen direct-bookmaker structured payload and loopback trust rules;
- `specs/structured-ingestion-v2.md` — typed direct/`bet-up.it` relay navigation candidates and restricted relay resolution;
- `specs/selection-target.md` — immutable bookmaker-agnostic identity target for one leg;
- `specs/execution-contract.md` — automatic plan/start trigger, exact two-leg runtime model, states, attempts, evidence epochs, commands, and derived plan status;
- `specs/bookmaker-adapter-contract.md` — core/worker/adapter interface and restricted browser/selection capability boundary;
- `specs/matching-policy.md` — deterministic event/market/line/outcome evidence and odds policy;
- `docs/error-model.md` — interruption, safe-failure, cancellation, and recovery taxonomy;
- `docs/test-strategy.md` — notification-to-auto-start, unit, contract, browser integration, transaction-boundary, and release-gate tests;
- `docs/safety-boundaries.md` — non-negotiable authentication/access/transaction boundaries.

If implementation behavior conflicts with these contracts, implementation must change or an explicit architecture change/ADR must be accepted first.

## 4. Ingestion-to-execution boundary

The core owns the transition from accepted notification input to one immutable two-leg execution plan.

Three compatible source contracts are supported:

### 4.1 Legacy textual notification

Legacy text preserves `recommendedOptions` source order and uses recommendation index `0` as the authoritative primary. It must resolve to exactly two distinct valid targets and never falls through to a later recommendation.

### 4.2 Structured direct-pair v1

`notifyhandler.direct-pair.v1` remains supported and frozen for producers that can supply a direct bookmaker-origin match URL per leg.

V1 keeps the ARCH-004 rules:

- authenticated/bounded loopback ingress;
- exactly two explicit distinct bookmaker legs;
- direct link required for each leg;
- initial URL itself must satisfy that bookmaker adapter's approved-origin policy;
- no generic-discovery fallback when the v1 direct link fails.

V1 is not widened to accept `bet-up.it`.

### 4.3 Structured direct-pair v2

`notifyhandler.direct-pair.v2` preserves the explicit two-leg payload but replaces the untyped leg `deepLink` with a typed navigation candidate:

- `bookmaker-direct`;
- `betup-relay`.

The application validates v2 schema, freshness/idempotency, pair semantics, navigation kind, relay grammar, relay suffix/bookmaker binding, and—when both legs are relays—the shared relay signal UUID. It does not follow the relay.

Both v1 and v2 normalize into the same immutable `SelectionTarget` / `ExecutionPlan` runtime. No second orchestration path exists.

### 4.4 Loopback HTTP boundary

The existing authenticated loopback endpoint remains the machine-to-machine ingress boundary. `schemaVersion` selects the validator deterministically.

ARCH-004 request-size, Host/Origin, local bearer token, replay/idempotency, rate/concurrency, logging/privacy, and loopback-only binding requirements remain unchanged.

A failed v2 message is not reinterpreted as v1.

### 4.5 Typed navigation normalization

The core normalizes navigation intent before worker dispatch:

```ts
type NavigationTarget =
  | { kind: "BOOKMAKER_DIRECT"; url: HttpsUrl }
  | {
      kind: "BETUP_RELAY";
      url: HttpsUrl;
      signalId: string;
      bookmaker: BookmakerId;
    };
```

This typed value is immutable execution intent. The worker must not infer relay behavior from string heuristics alone.

### 4.6 Bet-up relay preflight

For `BETUP_RELAY`, application preflight accepts only:

- exact origin `https://www.bet-up.it`;
- no userinfo/query/fragment;
- exact `/lnk/<uuid>/<bookmaker-suffix>` path grammar;
- version-controlled suffix mapping equal to the leg's canonical bookmaker;
- supported adapter availability for that bookmaker.

The relay signal UUID is correlation/provenance only and never selection evidence.

When both legs are relay candidates, their signal UUIDs must agree.

The renderer may observe plan/status updates, but no renderer acknowledgement is required before automatic startup.

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
- typed direct/relay navigation resolution;
- allowed-origin/DNS/private-target/redirect validation;
- page readiness;
- manual-login interruption coordination;
- adapter execution;
- shared matching/evidence policy;
- observed-odds capture/comparison;
- final verified selection activation through the shared activation gate;
- structured progress/result/error events.

Adapters do not receive the Electron renderer, application privilege surface, credential stores, password manager access, or raw application filesystem authority.

Adapters should receive a restricted bookmaker-page abstraction rather than raw Playwright `Browser`, `BrowserContext`, or `Page` objects as their public dependency.

Relay resolution is a shared worker/browser-gateway responsibility before bookmaker adapter matching. Bookmaker adapters do not implement `bet-up.it` parsing or redirect policy.

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

Required identity dimensions are independently classified as `NOT_CHECKED`, `MATCHED`, `MISMATCHED`, `AMBIGUOUS`, or `UNAVAILABLE`. Only `MATCHED` authorizes a required identity dimension. Market identity includes family, context/subtype, and explicit market period; current executable targets require `period: "full_match"`.

Fuzzy similarity may help discover candidates but cannot itself authorize selection. Approved aliases must be deterministic/version-controlled/tested. Exact numeric line matching uses decimal-safe semantics with no nearest-line tolerance. A first-half/other-period market can never satisfy a `full_match` target, even when line, side, and odds are identical.

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

Notification content, structured payload fields, navigation URLs, relay responses, redirects, and bookmaker page content are untrusted.

### 15.1 Direct bookmaker navigation

Legacy/v1 and v2 `BOOKMAKER_DIRECT` navigation keep the existing fail-closed rules: HTTPS only, empty URL userinfo, exact adapter-approved origin, DNS/private-target checks, redirect/final-origin revalidation, and no silent generic-discovery substitution for authoritative structured input.

### 15.2 Bet-up relay navigation

For v2 `BETUP_RELAY`:

1. application preflight validates exact relay origin/path/suffix binding but does not follow the URL;
2. the worker/browser gateway revalidates the candidate and its resolved addresses immediately before navigation;
3. the exact relay origin is `https://www.bet-up.it`;
4. the only authorized cross-origin transition during relay resolution is directly from that relay origin to an origin already registered for the leg's expected bookmaker adapter;
5. an affiliate, tracker, shortener, unrelated identity provider, or other intermediary origin is rejected unless a later reviewed architecture explicitly adds it;
6. the expected-bookmaker target is DNS/private-target validated before navigation;
7. upon reaching the expected bookmaker origin, relay resolution ends and normal adapter navigation/matching policy begins;
8. every later top-level navigation remains subject to adapter origin policy and evidence invalidation.

A client-side/meta/script-driven top-level transition is not automatically trusted; the actual next top-level request must satisfy the same destination policy.

A relay challenge/login/CAPTCHA on `bet-up.it` is a safe relay-resolution failure, not `AUTH_REQUIRED`. Manual `AUTH_REQUIRED` begins only after a valid expected-bookmaker origin has been reached.

### 15.3 Evidence boundary

Successful relay resolution proves only that navigation reached an approved origin for the expected bookmaker. It proves nothing about event, competition/time, market, line, outcome, or odds.

Matching begins in a fresh evidence epoch after bookmaker arrival. Relay URL, UUID, suffix, hop result, and redirect destination cannot be positive `MatchingEvidenceSnapshot` dimensions and cannot authorize `SelectionActivationGate`.

### 15.4 Retry and persistence

Retry/reopen re-resolves the immutable navigation candidate from the beginning. A previously resolved bookmaker URL is not cached as trusted target input.

Diagnostics may record navigation kind, relay origin, bookmaker id/suffix, hop count, failure code, timings, sanitized final origin/path category, and a hashed/truncated signal identifier. Full relay URLs and signal UUIDs are not logged/persisted by default.

The renderer never renders untrusted bookmaker or relay HTML.

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

ARCH-001 through ARCH-006 now establish the current runtime and shared contracts:

- ARCH-001 — local desktop + headed Playwright runtime;
- ARCH-002 — execution/adapter/matching/error contracts;
- ARCH-003 — deterministic automatic startup;
- ARCH-004 — versioned structured direct-pair ingestion, authenticated loopback HTTP boundary, idempotency/freshness, and direct-bookmaker trust semantics;
- ARCH-005 — `direct-pair.v2`, typed navigation candidates, and restricted `bet-up.it` relay resolution;
- ARCH-006 — explicit market-period identity propagated from input through SelectionTarget and required by adapter market matching.

Downstream responsibilities are now explicit:

- **Notification & Domain Engineer:** add canonical `MarketPeriod`, normalize current legacy `U/O CORNER <line>` to `full_match`, and propagate period into SelectionTarget;
- **Application Engineer:** preserve structured v1/v2 `market.period` in generated SelectionTargets while adding v2 typed navigation;
- **Bookmaker Automation Engineer:** require deterministic period evidence in SISAL/BET365 market matching and fixtures before `MARKET_MATCHED`;
- **Bookmaker Automation Engineer / BOOK-016:** after the shared relay resolver and period-matching implementation, collect evidence only after expected-bookmaker arrival and independently re-establish event/market-period/line/side/odds evidence;
- **Security & Compliance Engineer:** review relay DNS/request interception, direct-transition enforcement, challenge behavior, redirect/final-origin checks, and diagnostics/privacy;
- **QA / Integration Engineer:** prove legacy and structured inputs converge on the same state/matching/transaction contracts and that rejected ingress produces zero browser navigation.

QA-002 remains blocked until two bookmakers reach narrowly scoped evidence-backed live `Supported` status. Production release remains blocked behind that qualification.
