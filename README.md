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

As of 2026-09-14, Milestones 0–5 are complete for the **local unsigned Windows x64 preview** path. The repository has a runnable desktop shell, automatic two-leg orchestration, isolated Playwright/Chromium execution, deterministic SISAL/BET365 fixture E2E, security/transaction-boundary coverage, reproducible CI, and verified preview packaging with SBOM/checksums/provenance.

This is not yet a production release. The attempted live promotion of the original SISAL + BET365 pair did not pass the evidence gate:

- SISAL is `Blocked` for the live pre-match football total-corners scope while remaining fixture-backed `Testable`;
- BET365 is `Blocked` for the same live scope while remaining fixture-backed `Testable`.

The public validation surfaces did not establish the complete deterministic selector-level event → total-corners market → exact line → requested side → displayed odds → selected-state chain. NotifyHandler will not compensate with guessed selectors, unrelated prices, protected/private API reverse engineering, or access-control bypasses.

Milestone 6 is therefore feasibility-first for the remaining prioritized candidates:

1. LOTTOMATICA — #52;
2. EPLAY24 — #53 if fewer than two viable candidates exist;
3. ADMIRALBET — #54 if fewer than two viable candidates exist after #53.

A feasibility result is not support. Candidates judged feasible still need restricted adapter/worker implementation, deterministic sanitized regressions, and controlled live qualification. QA #45 will certify the first pair that truly reaches narrowly scoped live `Supported` status. Signed Windows production work in #46 remains blocked until then.

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
