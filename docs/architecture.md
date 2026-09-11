# NotifyHandler architecture

Status: **Accepted baseline for Milestone 1**

NotifyHandler is a local-first desktop application that transforms a reviewed surebet notification into two independently prepared bookmaker selections while keeping authentication, stake entry, review, and final bet submission manual.

The runtime decision is recorded in `docs/adr/0001-local-desktop-playwright-runtime.md`. Shared execution contracts are now stabilized by ARCH-002.

## 1. Runtime model

NotifyHandler uses:

- a desktop renderer for notification input, parsed preview, recommended-option choice, execution status, recovery actions, and manual handoff;
- a trusted local core/main process for domain integration, execution-plan construction, two-leg orchestration, state, and typed IPC;
- a separate browser-automation worker containing the adapter registry, matching policy, navigation policy, and browser gateway;
- Playwright controlling dedicated visible/headed Chromium processes for bookmaker navigation and selection preparation;
- isolated, application-owned browser/session state per leg for the MVP.

TypeScript/Node.js is the common implementation language. An Electron-style shell is the preferred desktop host. Bookmaker pages are never embedded in the renderer.

## 2. Component model

```text
+-------------------------------+
| Desktop Renderer              |
| input / preview / option      |
| per-leg status / user actions |
+---------------+---------------+
                | typed IPC
                v
+-------------------------------+
| Local Core / Main Process     |
| parser/domain integration     |
| plan builder                  |
| two-leg orchestrator          |
| sanitized diagnostics         |
+---------------+---------------+
                | typed worker protocol
                v
+-------------------------------+
| Browser Automation Worker     |
| adapter registry              |
| matching + origin policy      |
| restricted browser gateway    |
| selection activation gate     |
+----------+--------------------+
           |
           +-----------------------------+
           v                             v
+----------------------+       +----------------------+
| Headed Chromium A    |       | Headed Chromium B    |
| isolated leg session |       | isolated leg session |
+----------------------+       +----------------------+
```

Bookmaker-specific DOM knowledge exists only in bookmaker adapters and their fixtures/tests.

## 3. Normative contract map

Downstream implementation must use these shared contracts:

- `specs/notification-format.md` — transport-neutral notification normalization;
- `specs/selection-target.md` — immutable bookmaker-agnostic identity target for one leg;
- `specs/execution-contract.md` — exact two-leg runtime model, states, transitions, attempts, evidence epochs, commands, and derived plan status;
- `specs/bookmaker-adapter-contract.md` — core/worker/adapter interface and restricted browser/selection capability boundary;
- `specs/matching-policy.md` — deterministic event/market/line/outcome evidence and odds policy;
- `docs/error-model.md` — interruption, safe-failure, cancellation, and recovery taxonomy;
- `docs/test-strategy.md` — unit, contract, browser integration, transaction-boundary, and release-gate tests;
- `docs/safety-boundaries.md` — non-negotiable authentication/access/transaction boundaries.

If implementation behavior conflicts with these contracts, implementation must change or an explicit architecture change/ADR must be accepted first.

## 4. Renderer boundary

The renderer is an unprivileged presentation surface. It may:

- accept notification input;
- display normalized parsing results;
- let the user choose a recommended pair;
- show the exact two immutable targets before execution;
- display independent leg states, matching evidence summaries, odds changes, failures, and safe recovery actions;
- request start, manual-auth resume, changed-odds continuation, retry, reopen, cancel, and plan restart through typed IPC.

It must not:

- import Playwright or bookmaker adapters;
- contain bookmaker DOM selectors;
- access bookmaker credentials, cookies, tokens, raw storage, or browser profiles;
- receive generic browser-control capabilities.

Renderer context isolation and disabled Node integration are required.

## 5. Core/main-process boundary

The core owns bookmaker-agnostic application behavior:

- transport-neutral parser/domain handoff;
- validation and reviewed plan creation;
- conversion of the chosen option into exactly two immutable `SelectionTarget` legs;
- independent per-leg runtime state;
- attempt/evidence-epoch freshness checks;
- cancellation and safe recovery commands;
- adapter lookup by canonical bookmaker id;
- sanitized diagnostics/result propagation.

The core does not receive raw browser objects and never sends credentials, stake-entry commands, or transaction commands to the worker.

The overall plan status is derived from the two authoritative leg states; one leg can never overwrite the other.

## 6. Browser-automation worker boundary

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

## 7. Browser/session model

Each leg receives a dedicated headed Chromium session/process with an ephemeral application-owned profile by default.

The application must not attach to the user's normal Chrome/Edge profile through remote debugging.

This provides:

- isolation between bookmakers/legs;
- reduced exposure to unrelated tabs/cookies/extensions;
- independent cancellation/cleanup;
- clearer manual takeover;
- deterministic fixture testing.

If both legs use the same bookmaker, they remain separate sessions in the MVP unless a later ADR approves safe session sharing.

Persistent authenticated bookmaker profiles are deferred and require a separate Security review/ADR.

## 8. Authentication boundary

If a bookmaker requires authentication:

1. adapter/worker reports `AUTH_REQUIRED`;
2. automated actions for that leg pause;
3. the user authenticates directly in the visible bookmaker browser;
4. the user requests resume;
5. the worker creates a fresh evidence epoch and re-runs origin, event, market, line, outcome, and odds validation.

NotifyHandler never receives/types credentials, reads password-manager secrets, automates MFA/OTP/security questions, or solves/bypasses CAPTCHA.

## 9. Matching and confidence architecture

Selection authorization is predicate-based, not score-based.

Required identity dimensions are independently classified as:

- `NOT_CHECKED`;
- `MATCHED`;
- `MISMATCHED`;
- `AMBIGUOUS`;
- `UNAVAILABLE`.

Only `MATCHED` authorizes a required identity dimension.

Fuzzy similarity may help discover candidates but cannot itself authorize selection. Approved aliases must be deterministic/version-controlled/tested. Exact numeric line matching uses decimal-safe semantics with no nearest-line tolerance.

See `specs/matching-policy.md` for the normative rules.

## 10. Odds policy

Expected odds from the notification and observed bookmaker odds are always distinct values.

For the MVP:

- equal odds can proceed when identity is fully matched;
- higher/lower changed odds produce `ODDS_CHANGED` **before selection activation**;
- the user must explicitly acknowledge the exact observed value;
- continuation invalidates prior evidence and fully revalidates the page/identity/odds;
- if the value changes again, the application pauses again;
- unavailable/unreadable odds fail safely and do not activate the selection.

Odds never compensate for wrong/ambiguous event, market, line, or outcome identity.

## 11. State, attempts, and stale evidence

The exact state graph is defined in `specs/execution-contract.md`.

Key architecture rules:

- two legs remain independently addressable;
- every execution attempt has a unique attempt id;
- matching evidence belongs to an evidence epoch;
- manual login, redirect, refresh, reopen, browser replacement, changed-odds continuation, or meaningful page replacement invalidates stale positive evidence;
- late events from obsolete attempts/epochs cannot mutate current state;
- retry/reopen never skip matching stages;
- cancellation prevents any later final selection activation for that attempt.

## 12. Selection activation boundary

Adapters must not perform the final requested outcome click through an unrestricted public `click()` contract.

The final candidate plus current evidence is submitted to a shared `SelectionActivationGate`. The gate permits activation only when:

- current origin is approved;
- event is matched;
- market/context is matched;
- required exact line is matched;
- outcome is matched;
- odds policy is satisfied for the current value;
- evidence belongs to the current attempt/epoch;
- cancellation has not occurred.

After activation, the adapter must verify that the exact target selection is visibly selected before reporting `SELECTION_PREPARED`/`READY_FOR_USER`.

## 13. Transaction boundary by design

The system models selection preparation, not wagering.

No public renderer/core/worker/adapter contract may contain operations equivalent to:

- credential entry or MFA/CAPTCHA automation;
- stake entry/change/calculation for bookmaker submission;
- `placeBet`, `submitBet`, `confirmBet`, `finalizeBet`, or equivalent;
- deposits, withdrawals, cash-out, or other financial actions;
- access-control, anti-bot, rate-limit, or geo-restriction bypass.

Stake recommendations may remain informational domain/presentation data but are not forwarded as browser actions.

Adding a transaction capability is an architecture-breaking change and release blocker.

## 14. Navigation and trust boundaries

Notification content, deep links, and bookmaker page content are untrusted.

Before accepting top-level navigation:

- scheme must be `https`;
- origin must be explicitly registered to the selected adapter;
- unsafe schemes, localhost, loopback/link-local/private internal-network destinations, and unrelated domains are blocked when input-controlled;
- cross-origin redirects require allow-list validation;
- navigation/redirect invalidates stale matching evidence.

The renderer never renders untrusted bookmaker HTML.

## 15. Persistence and diagnostics

MVP persistent application data should be minimal and non-sensitive.

Do not persist as application records:

- credentials/MFA values;
- cookies/raw browser storage;
- authentication tokens/headers;
- authenticated page dumps/screenshots by default;
- positive matching evidence for reuse after restart.

Diagnostics should prefer canonical ids, state transitions, error codes, sanitized candidate labels, expected/observed odds, timing, and redacted origin/path information.

## 16. Testability

Routine CI must not require bookmaker credentials, live accounts, or transactions.

The normative test strategy is `docs/test-strategy.md` and includes:

- pure state/matching/decimal/origin unit tests;
- one reusable shared adapter contract suite;
- deterministic sanitized local fixture pages;
- browser integration tests for session lifecycle, redirects, cancellation, stale evidence, and selection-gate behavior;
- application integration tests for independent two-leg status and action-required flows;
- static/package-boundary tests proving stake/bet-submit/credential capabilities are absent.

Live bookmaker checks, when permitted, remain manual/non-transactional verification and are not routine CI gates.

## 17. Packaging implications

Downstream Release/DevOps work should provide:

- strict TypeScript/Node package boundaries;
- desktop renderer/core packaging;
- reproducibly pinned Playwright/Chromium runtime;
- cleanup for orphaned browser/worker processes;
- CI commands for unit and local browser fixture tests;
- no required bookmaker secrets in CI.

Exact package manager, Electron/Node/Playwright versions, bundler, installer/signing approach, and supported OS targets are DevOps decisions constrained by this architecture.

## 18. Architecture completion state

ARCH-001 and ARCH-002 establish the Milestone 1 runtime and shared contracts.

Downstream work may now proceed in parallel against the normative contract map, particularly:

- DOMAIN-001 — normalized domain/parser and `SelectionTarget` construction;
- BOOK-001 — first bookmaker adapter against the shared adapter/matching contract;
- APP-001/APP-002 — reviewed plan UX and two-leg orchestration;
- QA-001 — shared contract/integration safety suite;
- SEC-001 — threat model and browser/security hardening;
- DEVOPS-001 — reproducible TypeScript/Electron/Playwright scaffold and CI.
