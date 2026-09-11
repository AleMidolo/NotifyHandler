# NotifyHandler architecture

Status: **Accepted baseline for Milestone 1**

This document defines the runtime and component architecture for NotifyHandler. Detailed shared execution and bookmaker-adapter contracts are refined separately under `ARCH-002`.

## 1. Architectural decision

NotifyHandler is a **local-first desktop application** with:

- a desktop UI renderer for notification input, parsed preview, option choice, execution status, and manual handoff;
- a trusted local core process for parsing/domain orchestration and state management;
- a browser-automation worker boundary containing bookmaker adapters;
- **Playwright controlling dedicated headed Chromium browser processes** for bookmaker navigation and outcome selection;
- isolated browser/session state per bookmaker leg for the MVP.

The initial implementation should use TypeScript/Node.js across the core and automation layers. An Electron-style desktop shell is the preferred packaging host because it provides a local desktop UI plus a Node-capable privileged process while allowing the bookmaker browser to remain a separate visible Chromium process.

The desktop shell must not embed bookmaker pages in the application renderer. The user interacts with bookmaker pages only in the dedicated headed browser windows opened for execution.

## 2. Why this model

The product requires both automation and a deliberate manual boundary. The selected model provides:

- direct, normal browser interaction through Playwright;
- a visible browser where the user can manually authenticate when required;
- no need to control the user's everyday browser profile;
- deterministic browser testing against local fixtures;
- process/session isolation between the application UI and bookmaker pages;
- a straightforward cancellation boundary because a leg browser process/session can be stopped without terminating the application;
- local execution without a remote service holding bookmaker session state.

Correctness and safe failure take priority over preserving an existing login session or maximizing automation speed.

## 3. High-level component model

```text
+-------------------------------+
| Desktop Renderer              |
| - input                       |
| - parsed preview              |
| - option selection            |
| - leg status / user actions   |
+---------------+---------------+
                | typed IPC
                v
+-------------------------------+
| Local Core / Main Process     |
| - input transport boundary    |
| - parser + validation         |
| - normalized domain model     |
| - execution-plan builder      |
| - two-leg orchestrator        |
| - adapter registry            |
| - sanitized diagnostics       |
+---------------+---------------+
                | typed worker protocol
                v
+-------------------------------+
| Browser Automation Worker     |
| - shared adapter contract     |
| - bookmaker adapters          |
| - matching policy helpers     |
| - navigation/origin policy    |
| - Playwright browser gateway  |
+----------+--------------------+
           |
           +-----------------------------+
           v                             v
+----------------------+       +----------------------+
| Headed Chromium A    |       | Headed Chromium B    |
| isolated leg session |       | isolated leg session |
| user can take control|       | user can take control|
+----------------------+       +----------------------+
```

Bookmaker-specific DOM rules exist only inside bookmaker adapters and their fixture/test code.

## 4. Component responsibilities

### 4.1 Desktop renderer

The renderer is an unprivileged presentation surface. It may:

- accept pasted notification text;
- display parsed/normalized data;
- let the user select a recommended pair;
- display the exact two-leg plan before execution;
- show independent leg states, evidence summaries, odds changes, failures, and recovery actions;
- request start/resume/retry/reopen/cancel operations through typed IPC.

It must not:

- import Playwright or bookmaker adapters;
- access arbitrary filesystem or Node APIs;
- receive credentials, cookies, authentication tokens, or raw browser storage;
- contain bookmaker DOM selectors.

Desktop-shell security features such as renderer context isolation and disabled Node integration are required.

### 4.2 Local core / main process

The core owns application behavior independent of bookmaker DOM structure:

- transport-neutral input handoff;
- parser/domain validation;
- conversion of the chosen recommendation into exactly two selection targets;
- execution-plan creation;
- independent per-leg orchestration and cancellation;
- lifecycle/state persistence for the current application run;
- adapter lookup by canonical bookmaker identifier;
- sanitized diagnostics and error propagation.

The core communicates with automation through a typed protocol containing normalized targets and structured results. It does not pass credentials, stakes, or transaction commands.

### 4.3 Browser automation worker

The automation worker is the only component allowed to import Playwright and bookmaker-specific adapters.

It owns:

- browser launch and teardown;
- approved-origin/deep-link validation;
- page readiness and redirect checks;
- manual-login detection and pause/resume coordination;
- bookmaker-specific event/market/line/outcome matching;
- observed-odds capture;
- safe selection activation only after required identity evidence passes;
- structured evidence/result reporting.

The worker protocol intentionally has no operation for credential entry, MFA/CAPTCHA handling, stake entry, bet submission, deposits, withdrawals, cash-out, or equivalent transaction actions.

The implementation should enforce package/module boundaries so application/core code cannot reach Playwright directly and adapter code cannot bypass the shared browser/selection capability layer without an explicit architecture change.

## 5. Browser and session model

### 5.1 Headed browser

Bookmaker execution uses a visible Chromium browser controlled by Playwright. Headed mode is required for the MVP because the user must be able to perform manual authentication and later take control of the prepared selection.

### 5.2 Isolation

Each leg receives its own isolated browser session. The MVP preference is a dedicated browser process with an ephemeral application-owned user-data directory per leg/run.

This prevents:

- one bookmaker adapter from operating on another bookmaker's page;
- leakage from unrelated tabs or the user's normal browser profile;
- accidental reuse of stale matching evidence between legs.

If both legs target the same bookmaker, they still remain separate executions unless a later ADR explicitly introduces a safe shared-session model.

### 5.3 Authentication

NotifyHandler never accepts credentials. When authentication is required:

1. the adapter returns `manual_login_required`;
2. automation for that leg pauses;
3. the user authenticates directly in the visible bookmaker browser;
4. the user requests resume from NotifyHandler;
5. the adapter re-validates origin, page state, event, market, line, and outcome before any selection action.

No credential-field introspection, password-manager access, automated OTP/MFA, or CAPTCHA handling is permitted.

### 5.4 Session persistence

For the MVP, browser profiles are **ephemeral by default** and are not a product persistence mechanism. Application restart invalidates active matching evidence and execution state.

A future opt-in persistent bookmaker profile may be considered only after Security review and a separate ADR because it materially increases exposure of session cookies and authenticated state.

## 6. Data flow

1. An input transport produces raw notification text or structured input.
2. The parser normalizes input into the bookmaker-agnostic domain model and retains safe provenance for diagnostics.
3. The renderer displays the normalized preview; invalid/ambiguous input cannot proceed.
4. The user chooses one recommended pair.
5. Core resolves it into exactly two normalized selection targets and displays them before execution.
6. The orchestrator starts two independent leg executions.
7. For each leg, the automation worker validates the target URL/origin, opens a headed browser session, and applies the shared matching policy through the relevant bookmaker adapter.
8. If login is required, that leg pauses for manual user interaction and later revalidates.
9. Only after event, market, exact line, and outcome identity satisfy the contract may the adapter activate the requested selection.
10. The worker reports observed odds, matching evidence, and a structured result to the core.
11. The renderer shows each leg's state independently. `ready_for_user` means selection preparation only; stake entry, review, and final submission remain manual.

## 7. State and concurrency

The application owns one execution-plan state containing two independent leg state machines. A leg failure must never overwrite or imply the state of the other.

The architecture permits concurrent leg execution, but concurrency is an orchestration policy rather than an adapter behavior. Implementations may start sequentially initially if that reduces ambiguity during early development, provided the state model remains independently addressable.

Any retry, resume after login, redirect, refresh, reopened page, browser restart, or meaningful DOM state change must invalidate stale matching evidence and force required checks to run again.

The detailed state/event/result contract is defined under `ARCH-002`.

## 8. Transaction boundary by design

The system models **selection preparation**, not wagering.

No public core, worker, or adapter interface may contain methods or messages equivalent to:

- `setStake` / `enterStake` / `changeStake`;
- `placeBet` / `submitBet` / `confirmBet` / `finalizeBet`;
- credential/MFA/CAPTCHA entry;
- deposit/withdraw/cash-out or other financial actions.

Stake values present in a notification are informational domain data only and are not forwarded as actionable browser instructions.

The browser capability layer used by adapters must be narrowed around page inspection, permitted navigation, and activation of an already-verified selection candidate. Direct generic automation access outside that layer should be prevented by module/package boundaries and tested as a release gate.

## 9. Navigation and trust boundaries

Notification content, deep links, and bookmaker page content are untrusted.

Before browser navigation:

- only `https` bookmaker origins explicitly registered for the selected adapter are allowed;
- supplied deep links are parsed and validated, never executed as script/data/file URLs;
- redirects across origins require allow-list validation and page-context revalidation;
- adapters must not navigate to localhost, file paths, internal-network addresses, or unrelated domains based on notification-controlled data.

The renderer must not render untrusted bookmaker HTML.

## 10. Persistence and diagnostics

MVP persistent application data should be minimal:

- non-sensitive user preferences;
- supported-bookmaker configuration supplied by the application;
- optional sanitized diagnostic records if enabled.

Do not persist:

- credentials or MFA values;
- cookies or raw browser storage as application records;
- authentication headers/tokens;
- complete browser snapshots containing sensitive account data;
- stale positive matching evidence for reuse after restart.

Diagnostic data should prefer normalized identifiers, state transitions, reason codes, expected/observed odds, and redacted/allow-listed URL origin information.

## 11. Testability strategy

Most automated tests must not require live bookmaker access.

### Unit tests

Run without a browser for:

- parser/domain normalization;
- execution-plan construction;
- state transitions;
- matching-policy helpers;
- odds comparison;
- URL/origin validation;
- structured error/result handling.

### Adapter contract tests

Each bookmaker adapter must run against deterministic sanitized HTML/app fixtures served locally. Contract cases include exact matches, wrong event, wrong market, neighboring line, wrong side, duplicate/ambiguous candidates, changed odds, login-required pages, redirects, and cancellation.

### Browser integration tests

Playwright runs against local fixture pages in CI, normally headless. A smaller headed smoke path may be used locally to verify user-handoff behavior.

Tests must assert that stake-entry and bet-submission capabilities are absent from the adapter/worker protocol.

### Live verification

Live bookmaker checks, if permitted and needed, are manual/non-transactional verification activities and are not required for routine CI. They must never place a bet or require automated authentication.

## 12. Packaging and development implications

The chosen model implies these downstream requirements:

- TypeScript/Node.js project scaffold with strict package/module boundaries;
- desktop shell packaging for renderer + core;
- Playwright runtime and a reproducibly managed Chromium dependency;
- operating-system process cleanup for orphaned leg browsers/workers;
- signed/distributable desktop packaging can be added after MVP behavior stabilizes;
- CI must run parser/domain tests and local fixture browser tests without bookmaker credentials or external betting transactions.

The exact build tooling, package manager, bundler, installer format, and supported operating systems are Release/DevOps decisions constrained by this architecture.

## 13. Rejected alternatives

The rationale is recorded formally in ADR-0001. In summary:

- controlling the user's existing everyday Chrome/Edge profile through remote debugging was rejected because it exposes unrelated sessions/tabs and creates weak isolation;
- a browser-extension-only architecture was rejected for the MVP because orchestration, fixture testing, permissions, packaging, and cross-bookmaker state management become more complex and browser-vendor-specific;
- a remote/cloud automation service was rejected because authenticated bookmaker sessions and manual handoff should remain local;
- embedding bookmaker sites in the desktop renderer/webview was rejected because of site compatibility, authentication, origin/security, and user-handoff concerns.

## 14. Downstream architectural work

`ARCH-002` must now stabilize:

- execution-plan types;
- exact per-leg state machine and allowed transitions;
- bookmaker-adapter interface;
- evidence/confidence model;
- odds comparison policy;
- cancellation/retry/resume semantics;
- error taxonomy;
- test-double/contract-test interface;
- narrow browser/selection capability boundary.

No downstream implementation should invent incompatible versions of these contracts before `ARCH-002` is accepted.
