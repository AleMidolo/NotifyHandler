# NotifyHandler

NotifyHandler receives a surebet notification and automatically prepares the two bookmaker selections as quickly as safely possible while keeping authentication, stake entry, review, and final bet submission under manual user control.

## Product goal

Given a structured or textual surebet notification, NotifyHandler should:

1. parse the event, competition, date/time, market, outcomes, bookmaker offers, expected odds, deep links, and recommended paired options;
2. deterministically resolve the notification's primary recommended paired option into exactly two bookmaker legs without asking the user to review, confirm, or choose it;
3. immediately start the two legs and open the two bookmaker pages independently as soon as parsing, validation, adapter availability, and navigation-safety checks permit;
4. locate and verify the requested event, market, exact line, and outcome for each leg;
5. compare displayed odds with the expected odds from the notification;
6. activate the requested selection only when every required identity dimension is positively matched under the shared deterministic policy;
7. stop safely rather than guess when evidence is mismatched, ambiguous, unavailable, or stale;
8. hand control to the user with the prepared selections.

The normal path has no pre-execution confirmation screen and no user-driven recommended-option selector. For the initial notification contract, the first recommended option in source order is the primary option. If that option cannot deterministically resolve to exactly two valid, distinct, supported bookmaker legs, execution fails safely before bookmaker navigation rather than asking the user or silently substituting another option.

NotifyHandler must never enter credentials, automate MFA/CAPTCHA, enter stakes, or submit bets.

## MVP scope

The MVP focuses on deterministic notification parsing, automatic primary-option resolution, a transport-independent domain model, immediate execution planning, two-leg state tracking, bookmaker adapters, safe browser selection, odds-change reporting, and manual-user handoff.

Initial bookmaker candidates are SISAL, BET365, LOTTOMATICA, EPLAY24, and ADMIRALBET. Support is added incrementally through the shared adapter contract and evidence gates.

## Current status

As of 2026-09-22, Milestones 0–5 are complete for the **local unsigned Windows x64 preview/alpha** path. The repository has a runnable desktop shell, automatic two-leg orchestration, isolated Playwright/Chromium execution, deterministic SISAL/BET365 fixture E2E, security/transaction-boundary coverage, reproducible CI, and verified packaging with SBOM/checksums/provenance.

The first user-testable alpha is published as GitHub prerelease **`v0.0.0-alpha.1`**, built from commit `3327bc29078d0ab036453e1deaff1b7094fd29ee`. It provides a portable Windows x64 ZIP plus checksum and is intentionally **unsigned and non-production**; Windows may show an unsigned-app or SmartScreen warning.

The alpha is for testing the application itself. It does not imply live bookmaker support: no bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope. SISAL and BET365 remain fixture-backed `Testable`; real bookmaker flows may fail safely when deterministic live evidence is unavailable.

The initial passive validation phase did not establish a complete safe live mapping for SISAL, BET365, LOTTOMATICA, EPLAY24, or ADMIRALBET. The project therefore added a controlled interactive evidence path rather than guessing selectors or weakening the matching policy.

The live-validation tooling is now complete:

- **BOOK-012/#61:** controlled non-CI headed-browser explorer for same-origin public navigation and non-transactional market expansion, with no login/auth/CAPTCHA handling, outcome activation, stake entry, or wager submission capability;
- **DEVOPS-004/#69:** reproducible local-only runner with pinned toolchain checks, CI refusal, Chromium setup, and network diagnostics;
- **DEVOPS-007/#81:** portable Windows x64 ADMIRALBET diagnostic bundle containing the approved explorer plus pinned Node/Playwright/Chromium inputs, synthetic-only CI verification, checksum/provenance, and one-command local launcher.

The portable bundle is published as GitHub prerelease **`book012-admiralbet-diagnostic-v1`** from exact `main` commit `d16e34dec26086497c6b581a77ba26038b34b836`.

The generic interactive-validation queue is complete. ADMIRALBET/BOOK-013, SISAL/BOOK-014, and BET365/BOOK-015 all remain **Blocked** for the narrow live pre-match football full-match total-corners scope after qualifying bounded BOOK-012 runs. SISAL and BET365 remain fixture-backed **Testable**.

PRODUCT-015 keeps the full-match total-corners product target and changes the evidence strategy instead of weakening matching or adding more generic homepage exploration. The production surebet source will provide the exact two bookmaker legs plus a deep link intended to open each match page directly. Those links are now treated as first-class **preferred navigation candidates** for the next validation round.

A notification-provided match link remains untrusted input. NotifyHandler must validate HTTPS, exact approved bookmaker origin, URL/redirect safety, and final origin before navigation, and must still independently verify event identity, competition/time context, full-match total-corners market identity, exact line, requested side, and displayed odds. A correct-looking URL never substitutes for page evidence.

The structured-ingress implementation and security-hardening track is complete:

- **ARCH-004/#103** — structured `notifyhandler.direct-pair.v1` contract and trust boundary, merged via PR #108;
- **APP-005/#105** — authenticated loopback `POST /api/v1/notifications/direct-pair` implementation, merged via PR #112;
- **SEC-002/#106** — DNS/private-target validation, local token hardening/rotation, Host/Origin/privacy regressions, merged via PR #114;
- **SEC-003/#113** — restart-safe bounded idempotency tombstones with user-only persistence and zero sensitive payload storage, merged via PR #115.

User-supplied production examples revealed an important refinement: the surebet bot does **not** emit bookmaker-origin match URLs. It emits credential-free relay URLs shaped as `https://www.bet-up.it/lnk/<signal-uuid>/<bookmaker>`, which are expected to redirect to the bookmaker match page.

ARCH-005 introduces `notifyhandler.direct-pair.v2` with a typed `betup-relay` navigation candidate while keeping v1 frozen as direct-bookmaker-only. Relay syntax/binding is validated in the core, but actual relay resolution is restricted to the browser worker/gateway and can transition only from exact `https://www.bet-up.it` directly to an approved origin for the expected bookmaker.

The supplied examples already prove the relay-link shape for BET365 and SISAL, but their market is `DOPPIA CHANCE`, not the current Milestone-6 target full-match total-corners O/U. They are therefore useful for relay resolution and wrong-market safe-failure testing, but target-market feasibility still needs a representative total-corners signal after the relay contract is merged.

Current Milestone 6 sequence:
1. **#119 ARCH-005 — architecture track:** `direct-pair.v2`, typed navigation, and restricted `bet-up.it` relay resolution;
2. **#109 PRODUCT-016 — partially satisfied:** BET365/SISAL relay format is proven; still obtain a usable full-match total-corners upstream sample once #119 is merged;
3. **#104 BOOK-016 — after #119 + target-market evidence:** validate the real relay-aware path and independently establish event/competition-time/market/line/side/odds;
4. create restricted live-mapping implementation issues only for candidates that become `Feasible for implementation`;
5. **#45 QA-002** remains blocked until two bookmakers genuinely become narrowly scoped live `Supported`;
6. **#46 DEVOPS-003** remains blocked until #45 passes.

Remote Internet exposure of the desktop webhook is not part of this decision. The default integration is local/loopback; a remote surebet service would require a separately designed secure relay/outbound connection rather than opening the desktop listener to the public Internet.

Exploratory validation may navigate public event/market UI but must not activate a betting outcome. Outcome activation and selected-state verification remain later restricted implementation/support gates after all deterministic predicates pass.

Unsigned alpha/preview artifacts and diagnostic bundles must never be represented as production-ready, and a bookmaker must never be called `Supported` merely because a site is reachable or synthetic fixture tests pass.

## Architecture baseline

The accepted MVP runtime is a local-first desktop application with a TypeScript/Node.js core and a browser-automation worker using Playwright-controlled headed Chromium. Bookmaker sessions are isolated from the application UI and from the user's everyday browser profile; manual login and final transaction actions remain user-controlled.

Selection authorization is predicate-based, not a fuzzy confidence score. Event, market family/context, **market period**, exact numeric line, outcome, current origin, odds state, attempt freshness, and cancellation state are independently gated. The current executable corners-total target is explicitly `full_match`; first-half or unknown-period markets must fail safely.

The architecture has no pre-execution user-review, pair-selection, confirmation, or renderer-driven start gate. Legacy text uses deterministic recommendation index 0; structured v1/v2 carry the authoritative two legs directly. V1 is direct-bookmaker-only; v2 adds typed direct or `bet-up.it` relay navigation. All paths converge on the same execution/matching/activation contracts.

See `docs/architecture.md` and ADR-0001 through ADR-0004 for the accepted runtime, automatic-start, structured-ingress, and relay-resolution decisions.

## Development

The repository uses npm workspaces with a pinned Node/npm baseline and lockfile-driven installs. From a clean checkout:

```bash
nvm use
npm ci
npm run check
```

`npm run check` is the repository-wide build/lint/typecheck/unit-test entry point. Browser runtime bootstrap and release/packaging policy are documented in `docs/development.md`. Baseline CI uses local/mock tests and requires no bookmaker credentials or live betting transactions.

## Source of truth

Repository documentation and specifications are authoritative. Start with:

- `AGENTS.md` — autonomous team roles and coordination rules;
- `roadmap.md` — milestone status and sequencing;
- `backlog.md` — prioritized work;
- `docs/product-requirements.md` — product requirements, maturity, and acceptance criteria;
- `docs/architecture.md` — accepted runtime, component boundaries, automatic-start boundary, trust boundaries, and normative contract map;
- `docs/adr/0001-local-desktop-playwright-runtime.md` — deployment/runtime architecture decision record;
- `docs/adr/0002-automatic-primary-option-startup.md` — deterministic primary recommendation and automatic two-leg startup decision;
- `docs/adr/0003-loopback-structured-direct-pair-ingress.md` — authenticated loopback structured ingress and direct-bookmaker v1 trust decision;
- `docs/adr/0004-betup-relay-resolution.md` — v2 typed navigation and restricted `bet-up.it` relay-resolution decision;
- `docs/development.md` — reproducible local setup, CI, browser runtime, diagnostics, and release baseline;
- `docs/release.md` — CI preview, unsigned alpha prerelease, production artifact policy, signing gates, checksums/SBOM/provenance, and rollback;
- `docs/workflow.md` — end-to-end user/application workflow;
- `docs/safety-boundaries.md` — non-negotiable authentication, access, and transaction boundaries;
- `docs/error-model.md` — interruptions, safe failures, activation disposition, and recovery semantics;
- `docs/test-strategy.md` — automatic-start, unit/contract/browser/security/release test strategy;
- `docs/bookmaker-support.md` — bookmaker rollout, live-support gates, current support status, and live blockers;
- `docs/live-validation/` — sanitized evidence and live-validation runner documentation;
- `specs/notification-format.md` — legacy textual input/normalization and primary-recommendation contract;
- `specs/structured-ingestion-v1.md` — frozen direct-bookmaker explicit two-leg structured payload;
- `specs/structured-ingestion-v2.md` — relay-aware typed navigation payload and resolver policy;
- `specs/selection-target.md` — immutable target for one bookmaker leg;
- `specs/execution-contract.md` — automatic start trigger, exact two-leg state machine, attempts, evidence epochs, and commands;
- `specs/bookmaker-adapter-contract.md` — worker/adapter interface and restricted browser/selection capability boundary;
- `specs/matching-policy.md` — deterministic matching evidence, exact-line rules, and odds-change policy.

## Development principle

Correctness is more important than clicking something. Automatic startup removes unnecessary user delay, but never weakens validation. When event, market family/context/period, line, side, origin, odds state, freshness, or live mapping evidence is insufficient, the system must fail or pause safely instead of selecting a candidate.
