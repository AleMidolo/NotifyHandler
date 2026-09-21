# NotifyHandler backlog

Priority levels: **P0** blocks the current product milestone or protects correctness/safety; **P1** is required for the next planned release milestone; **P2** is later expansion.

## Current product status

The automatic local desktop MVP is complete for the **unsigned Windows x64 preview/alpha channel**. Deterministic parsing, automatic first-recommendation resolution, automatic two-leg orchestration, independent leg state/recovery, isolated Playwright/Chromium execution, fixture-backed SISAL/BET365 adapters, security regressions, reproducible CI, and preview packaging are implemented.

The first downloadable user alpha is published as GitHub prerelease **`v0.0.0-alpha.1`** from source commit `3327bc29078d0ab036453e1deaff1b7094fd29ee`. It is unsigned, non-production, and does not imply live bookmaker support.

The product is **not production-ready**. No bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope.

The controlled interactive explorer (**#61**), reproducible local runner (**#69**), and portable Windows ADMIRALBET validation bundle (**#81**) are complete. The durable diagnostic prerelease is **`book012-admiralbet-diagnostic-v1`**, built from exact `main` commit `d16e34dec26086497c6b581a77ba26038b34b836`.

DEVOPS-005/#71 is now complete. A real non-CI Windows workstation produced the sanitized BOOK-012 ADMIRALBET result. The run ended with `status: BUDGET_EXHAUSTED` after the fixed 10-action budget, produced 11 snapshots, and kept `authorizesProductionMapping: false`. The result is qualifying explorer evidence, not a feasibility/support classification.

**Product rule:** runner, DNS, browser-host, or toolchain failure is environment evidence, not bookmaker feasibility evidence. It must not classify a bookmaker `Blocked` or relax deterministic matching.

## Ready now

### P0 — BOOK-013 / #62: Revalidate ADMIRALBET interactively
Owner: Bookmaker Automation Engineer
Milestone: 6 — Evidence-backed live bookmaker readiness
Depends on: completed qualifying workstation handoff #71.

Interpret the actual sanitized BOOK-012 result now recorded on #62 / PR #68. The explorer reached the approved origin and completed its fixed 10-action budget with `status: BUDGET_EXHAUSTED`, 11 snapshots, and `authorizesProductionMapping: false`.

Determine whether the captured evidence establishes the required deterministic pre-activation chain:
`event → competition/time context → full-match total-corners market → exact numeric line → requested side → displayed odds`.

If the chain is deterministic, mark `Feasible for implementation` and create a separate restricted live-mapping implementation issue. If evidence remains genuinely insufficient after this qualifying run, mark the scope `Blocked` with the exact missing dimensions. Do not increase the explorer budget, guess selectors, weaken matching, or infer support from site reachability.

PR #68 is now ready for Bookmaker Automation Engineer interpretation/update.

## Next in Milestone 6

### P1 — BOOK-014 / #63: Revalidate SISAL interactively
Owner: Bookmaker Automation Engineer
Execute only if fewer than two feasible candidates exist after #62.

### P1 — BOOK-015 / #64: Revalidate BET365 interactively
Owner: Bookmaker Automation Engineer
Execute only if fewer than two feasible candidates exist after #62/#63.

### Implementation issues for feasible candidates
Owner: Bookmaker Automation Engineer

A candidate marked `Feasible for implementation` still requires a separately reviewable restricted adapter/worker live-mapping change with deterministic fixtures, exact event/competition/time/market/line/side/odds gates, origin/redirect/auth/odds/cancellation/freshness protections, and selected-state verification. Feasibility alone never changes status to `Supported`.

### P1 — QA-002 / #45: Certify the first evidence-backed live-supported bookmaker pair
Owner: QA / Integration Engineer
Depends on: two bookmakers completing interactive feasibility, implementation, and live `Supported` qualification.

## Blocked production release work

### P1 — DEVOPS-003 / #46: Prepare signed Windows production release candidate
Owner: Release / DevOps Engineer
Milestone: 7 — Production release readiness
Depends on: #45 passing and at least two release-scope bookmakers remaining live `Supported`.

The unsigned alpha channel and diagnostic validation bundle are not substitutes for this production gate.

## Completed / historical work

- #43 / BOOK-007 — SISAL passive public live validation: `Blocked` live, `Testable` fixtures.
- #44 / BOOK-008 — BET365 passive public live validation: `Blocked` live, `Testable` fixtures.
- #52 / BOOK-009 — LOTTOMATICA passive feasibility: `Blocked`.
- #53 / BOOK-010 — EPLAY24 passive feasibility: `Blocked`.
- #54 / BOOK-011 — ADMIRALBET passive feasibility: `Blocked`.
- #61 / BOOK-012 — controlled interactive headed-browser explorer: complete/merged.
- #69 / DEVOPS-004 — reproducible non-CI local explorer runner: complete/merged.
- #72 / PRODUCT-006 — qualifying-host blocker/routing reconciliation: complete.
- #74 / PRODUCT-007 — downloadable unsigned alpha channel definition: complete.
- #75 / DEVOPS-006 — `v0.0.0-alpha.1` Windows x64 GitHub prerelease publication: complete.
- #78 / PRODUCT-008 — published-alpha/external-host reconciliation: complete.
- #80 / PRODUCT-009 — portable validation handoff decision and task decomposition: complete.
- #81 / DEVOPS-007 — portable Windows BOOK-012 ADMIRALBET diagnostic bundle and prerelease: complete.
- #71 / DEVOPS-005 — qualifying non-CI Windows ADMIRALBET explorer execution and sanitized result handoff: complete.

All Milestones 0–5 implementation work remains complete for the unsigned local-preview/alpha channel.

## Later expansion

After a live-supported pair and production-release path are stable:
- additional evidence-backed bookmakers;
- Telegram ingestion;
- HTTP/webhook or clipboard/application ingestion;
- richer notification provenance and observability;
- macOS/Linux packaging after platform-specific distribution review.

## Product constraints applying to every backlog item

- Correctness is more important than completing a click.
- Minimize notification-to-browser-open latency without weakening validation.
- Never require routine pre-execution user review, pair selection, confirmation, or start action for a valid notification.
- Never guess event, market, line, side, outcome, recommendation identity, or live DOM mapping.
- Never silently substitute a later recommended pair when the primary recommendation is invalid.
- Never automate bookmaker credentials, MFA, CAPTCHA, stakes, or bet submission.
- Do not bypass authentication, anti-bot measures, access controls, rate limits, or geo restrictions.
- Do not rely on protected/private bookmaker APIs.
- Exploratory live validation may navigate/expand public non-transactional UI but must not activate betting outcomes.
- Live validation against bookmakers must remain non-CI; CI may only package and test synthetic/local behavior.
- `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states.
- Unsigned alpha/preview artifacts and diagnostic validation bundles are not production releases.
- Repository docs/specs override stale chat context and superseded closed-issue assumptions.
