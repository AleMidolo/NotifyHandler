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

As of 2026-09-15, Milestones 0–5 are complete for the **local unsigned Windows x64 preview** path. The repository has a runnable desktop shell, automatic two-leg orchestration, isolated Playwright/Chromium execution, deterministic SISAL/BET365 fixture E2E, security/transaction-boundary coverage, reproducible CI, and verified preview packaging with SBOM/checksums/provenance.

This is not yet a production release. The first passive live-validation phase did not produce a supported bookmaker for the target pre-match football full-match total-corners scope:

- SISAL — live `Blocked`, fixture-backed `Testable`;
- BET365 — live `Blocked`, fixture-backed `Testable`;
- LOTTOMATICA — `Blocked (feasibility)`;
- EPLAY24 — `Blocked (feasibility)`;
- ADMIRALBET — `Blocked (feasibility)` under the passive probe despite richer public event/generic-market/line/odds visibility.

The common blocker is evidence collection depth: passive top-level probes cannot establish the complete dynamic selector chain required by the deterministic matcher. NotifyHandler will not compensate with guessed selectors, unrelated prices, protected/private API reverse engineering, or access-control bypasses.

Milestone 6 therefore keeps **pre-match football full-match total-corners over/under** as the target and moves to a controlled interactive evidence strategy:

1. #61 — build a safe non-CI interactive live-validation explorer for same-origin public navigation and non-transactional market expansion;
2. #62 — revalidate ADMIRALBET first because it exposed the richest public structure;
3. #63 — revalidate SISAL if fewer than two feasible candidates exist;
4. #64 — revalidate BET365 if still needed;
5. implement restricted live mappings only for candidates actually proven feasible;
6. #45 — QA-certify the first two bookmakers that genuinely become live `Supported`;
7. #46 — prepare a signed Windows production candidate only after #45 passes.

Exploratory validation may navigate public event/market UI but must not activate a betting outcome. Outcome activation and selected-state verification remain later restricted implementation/support gates after all deterministic predicates pass.

Unsigned preview artifacts must never be represented as production-ready, and a bookmaker must never be called `Supported` merely because a site is reachable or synthetic fixture tests pass.

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
- `docs/release.md` — preview/production artifact policy, signing gates, checksums/SBOM/provenance, and rollback;
- `docs/workflow.md` — end-to-end user/application workflow;
- `docs/safety-boundaries.md` — non-negotiable authentication, access, and transaction boundaries;
- `docs/error-model.md` — interruptions, safe failures, activation disposition, and recovery semantics;
- `docs/test-strategy.md` — automatic-start, unit/contract/browser/security/release test strategy;
- `docs/bookmaker-support.md` — bookmaker rollout, live-support gates, current support status, and live blockers;
- `docs/live-validation/` — sanitized evidence for controlled non-CI live validation attempts;
- `specs/notification-format.md` — input/normalization and primary-recommendation contract;
- `specs/selection-target.md` — immutable target for one bookmaker leg;
- `specs/execution-contract.md` — automatic start trigger, exact two-leg state machine, attempts, evidence epochs, and commands;
- `specs/bookmaker-adapter-contract.md` — worker/adapter interface and restricted browser/selection capability boundary;
- `specs/matching-policy.md` — deterministic matching evidence, exact-line rules, and odds-change policy.

## Development principle

Correctness is more important than clicking something. Automatic startup removes unnecessary user delay, but never weakens validation. When event, market, line, side, origin, odds state, freshness, or live mapping evidence is insufficient, the system must fail or pause safely instead of selecting a candidate.
