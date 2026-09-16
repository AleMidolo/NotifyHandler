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

As of 2026-09-16, Milestones 0–5 are complete for the **local unsigned Windows x64 preview/alpha** path. The repository has a runnable desktop shell, automatic two-leg orchestration, isolated Playwright/Chromium execution, deterministic SISAL/BET365 fixture E2E, security/transaction-boundary coverage, reproducible CI, and verified packaging with SBOM/checksums/provenance.

The first user-testable alpha is published as GitHub prerelease **`v0.0.0-alpha.1`**, built from commit `3327bc29078d0ab036453e1deaff1b7094fd29ee`. It provides a portable Windows x64 ZIP plus checksum and is intentionally **unsigned and non-production**; Windows may show an unsigned-app or SmartScreen warning.

The alpha is for testing the application itself. It does not imply live bookmaker support: no bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope. SISAL and BET365 remain fixture-backed `Testable`; real bookmaker flows may fail safely when deterministic live evidence is unavailable.

The initial passive validation phase did not establish a complete safe live mapping for SISAL, BET365, LOTTOMATICA, EPLAY24, or ADMIRALBET. The project therefore added a controlled interactive evidence path rather than guessing selectors or weakening the matching policy.

The live-validation tooling is now complete:

- **BOOK-012/#61:** controlled non-CI headed-browser explorer for same-origin public navigation and non-transactional market expansion, with no login/auth/CAPTCHA handling, outcome activation, stake entry, or wager submission capability;
- **DEVOPS-004/#69:** reproducible local-only runner with pinned toolchain checks, CI refusal, Chromium setup, and network diagnostics;
- **DEVOPS-007/#81:** portable Windows x64 ADMIRALBET diagnostic bundle containing the approved explorer plus pinned Node/Playwright/Chromium inputs, synthetic-only CI verification, checksum/provenance, and one-command local launcher.

The portable bundle is published as GitHub prerelease **`book012-admiralbet-diagnostic-v1`** from exact `main` commit `d16e34dec26086497c6b581a77ba26038b34b836`.

The live-support critical path is now blocked on one real external execution step:

1. **#71 DEVOPS-005** — on a normal non-CI Windows x64 workstation, download `notifyhandler-book012-admiralbet-d16e34dec260-win32-x64.zip` and its `.sha256` companion from `book012-admiralbet-diagnostic-v1`, verify ZIP SHA-256 `ee7bc881b6823fb80f64c51e9bf43732329a5eb1ca3a0987915c0eacabc033de`, extract to a fresh writable directory, run `run-admiralbet-validation.cmd`, and retain only the sanitized `ExplorerSummary.json`;
2. **#62 BOOK-013** — interpret that actual ADMIRALBET result; PR #68 remains pending until the evidence exists;
3. **#63 BOOK-014** — revalidate SISAL if fewer than two feasible candidates exist;
4. **#64 BOOK-015** — revalidate BET365 if still needed;
5. implement restricted live mappings only for candidates genuinely proven feasible;
6. **#45 QA-002** — certify the first two bookmakers that become live `Supported`;
7. **#46 DEVOPS-003** — prepare a signed Windows production candidate only after #45 passes.

The current autonomous execution container is known not to satisfy #71's live network/runtime requirements, so repeating the same run there does not constitute progress. A runner, DNS, toolchain, or browser-host failure is **not bookmaker evidence** and must not be used to mark a bookmaker `Blocked` or to relax the full-match total-corners target.

Exploratory validation may navigate public event/market UI but must not activate a betting outcome. Outcome activation and selected-state verification remain later restricted implementation/support gates after all deterministic predicates pass.

Unsigned alpha/preview artifacts and diagnostic bundles must never be represented as production-ready, and a bookmaker must never be called `Supported` merely because a site is reachable or synthetic fixture tests pass.

## Architecture baseline

The accepted MVP runtime is a local-first desktop application with a TypeScript/Node.js core and a browser-automation worker using Playwright-controlled headed Chromium. Bookmaker sessions are isolated from the application UI and from the user's everyday browser profile; manual login and final transaction actions remain user-controlled.

Selection authorization is predicate-based, not a fuzzy confidence score. Event, market/context, exact numeric line, outcome, current origin, odds state, attempt freshness, and cancellation state are independently gated.

The architecture has no pre-execution user-review, pair-selection, confirmation, or renderer-driven start gate. Valid input flows from deterministic parsing to primary-option resolution, shared preflight, and automatic two-leg startup. Preview/target rendering is non-blocking observability.

See `docs/architecture.md`, `docs/adr/0001-local-desktop-playwright-runtime.md`, and `docs/adr/0002-automatic-primary-option-startup.md` for the accepted runtime and automatic-start decisions.

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
- `docs/development.md` — reproducible local setup, CI, browser runtime, diagnostics, and release baseline;
- `docs/release.md` — CI preview, unsigned alpha prerelease, production artifact policy, signing gates, checksums/SBOM/provenance, and rollback;
- `docs/workflow.md` — end-to-end user/application workflow;
- `docs/safety-boundaries.md` — non-negotiable authentication, access, and transaction boundaries;
- `docs/error-model.md` — interruptions, safe failures, activation disposition, and recovery semantics;
- `docs/test-strategy.md` — automatic-start, unit/contract/browser/security/release test strategy;
- `docs/bookmaker-support.md` — bookmaker rollout, live-support gates, current support status, and live blockers;
- `docs/live-validation/` — sanitized evidence and live-validation runner documentation;
- `specs/notification-format.md` — input/normalization and primary-recommendation contract;
- `specs/selection-target.md` — immutable target for one bookmaker leg;
- `specs/execution-contract.md` — automatic start trigger, exact two-leg state machine, attempts, evidence epochs, and commands;
- `specs/bookmaker-adapter-contract.md` — worker/adapter interface and restricted browser/selection capability boundary;
- `specs/matching-policy.md` — deterministic matching evidence, exact-line rules, and odds-change policy.

## Development principle

Correctness is more important than clicking something. Automatic startup removes unnecessary user delay, but never weakens validation. When event, market, line, side, origin, odds state, freshness, or live mapping evidence is insufficient, the system must fail or pause safely instead of selecting a candidate.
