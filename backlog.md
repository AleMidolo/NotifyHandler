# NotifyHandler backlog

Priority levels: **P0** blocks the current product milestone or protects correctness/safety; **P1** is required for the next planned release milestone; **P2** is later expansion.

## Current product status

The automatic local desktop MVP is complete for the **unsigned Windows x64 preview channel**. Deterministic parsing, automatic first-recommendation resolution, automatic two-leg orchestration, independent leg state/recovery, isolated Playwright/Chromium execution, fixture-backed SISAL/BET365 adapters, security regressions, reproducible CI, and preview packaging are implemented.

The product is **not production-ready**. No bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope.

The passive validation phase is exhausted:
- SISAL — live `Blocked`; fixture-backed `Testable`.
- BET365 — live `Blocked`; fixture-backed `Testable`.
- LOTTOMATICA — `Blocked (feasibility)`.
- EPLAY24 — `Blocked (feasibility)`.
- ADMIRALBET — `Blocked (feasibility)` under the earlier passive probe.

The controlled interactive explorer (**BOOK-012/#61**) is now implemented and merged. The reproducible local-only runner (**DEVOPS-004/#69**) is also implemented and merged. The remaining immediate blocker is environmental: the autonomous container cannot satisfy the repository-pinned Node/npm runtime and cannot resolve `www.admiralbet.it`.

**Product rule:** runner, DNS, browser-host, or toolchain failure is not bookmaker feasibility evidence. It must not be used to classify a bookmaker `Blocked`, must not relax the matching policy, and must not trigger a market-scope downgrade.

## Product decision for Milestone 6

Keep **pre-match football full-match total-corners over/under** as the live-support target.

Live readiness remains split into three stages:
1. controlled interactive evidence gathering;
2. restricted adapter/worker implementation for candidates proven feasible;
3. QA certification of the first two genuinely live-supported bookmakers.

Exploratory feasibility requires a deterministic pre-activation chain:
`event → competition/time context → full-match total-corners market → exact numeric line → requested side → displayed odds`.

Selected-state verification remains a later implementation/support gate through the existing restricted production selection capability.

## Ready now

### P0 — DEVOPS-005 / #71: Execute ADMIRALBET interactive validation on a qualifying local host
Owner: Release / DevOps Engineer
Milestone: 6 — Evidence-backed live bookmaker readiness
Depends on: completed #61 and #69

Run the existing command from a normal non-CI workstation/development environment that satisfies the repository pins, outbound DNS/HTTPS, and headed Chromium requirements:

`npm run live:explore:local -- admiralbet`

Acceptance summary:
- use a clean current `main` checkout and repository-pinned Node/npm;
- preserve BOOK-012 interaction/capability restrictions unchanged;
- do not add proxy/bypass/auth/session-capture behavior merely to make the run succeed;
- retain only sanitized `ExplorerSummary` JSON and minimal non-sensitive prerequisite diagnostics;
- attach/record the result for BOOK-013/#62 and PR #68;
- environment failure remains an environment result, not bookmaker evidence.

## Next in Milestone 6

### P0 — BOOK-013 / #62: Revalidate ADMIRALBET interactively
Owner: Bookmaker Automation Engineer
Depends on: an actual sanitized qualifying-host result from #71

Interpret the real BOOK-012 explorer result. If the full total-corners pre-activation chain is deterministic, create a separate ADMIRALBET live-mapping implementation issue. If evidence is genuinely insufficient after a qualifying run, keep ADMIRALBET `Blocked` and document the exact missing dimensions.

### P1 — BOOK-014 / #63: Revalidate SISAL interactively
Owner: Bookmaker Automation Engineer
Depends on: #61; execute only if fewer than two feasible candidates exist after #62

Use the interactive explorer to determine whether normal public event/market navigation exposes a deterministic total-corners chain. If feasible, create a live-mapping implementation issue that reuses the current fixture-backed adapter.

### P1 — BOOK-015 / #64: Revalidate BET365 interactively
Owner: Bookmaker Automation Engineer
Depends on: #61; execute only if fewer than two feasible candidates exist after #62/#63

Revalidate through normal public market navigation and create a live-mapping implementation issue only if deterministic evidence is sufficient.

### Implementation issues for feasible candidates
Owner: Bookmaker Automation Engineer

A candidate marked `Feasible for implementation` still requires a separately reviewable restricted adapter/worker live-mapping change with deterministic fixtures, exact event/competition/time/market/line/side/odds gates, origin/redirect/auth/odds/cancellation/freshness protections, and selected-state verification. Feasibility alone never changes status to `Supported`.

### P1 — QA-002 / #45: Certify the first evidence-backed live-supported bookmaker pair
Owner: QA / Integration Engineer
Depends on: two bookmakers completing interactive feasibility, implementation, and live `Supported` qualification

QA-002 qualifies whichever first two candidates genuinely satisfy the support gate for the common full-match total-corners notification scope.

## Blocked release work

### P1 — DEVOPS-003 / #46: Prepare signed Windows production release candidate
Owner: Release / DevOps Engineer
Milestone: 7 — Production release readiness
Depends on: #45 passing and at least two release-scope bookmakers remaining live `Supported`

The unsigned preview pipeline is healthy, but production signing/publication must not proceed until Milestone 6 succeeds.

## Completed / historical live-validation work

- #43 / BOOK-007 — SISAL passive public live validation: `Blocked` live, `Testable` fixtures.
- #44 / BOOK-008 — BET365 passive public live validation: `Blocked` live, `Testable` fixtures.
- #52 / BOOK-009 — LOTTOMATICA passive feasibility: `Blocked`.
- #53 / BOOK-010 — EPLAY24 passive feasibility: `Blocked`.
- #54 / BOOK-011 — ADMIRALBET passive feasibility: `Blocked`.
- #61 / BOOK-012 — controlled interactive headed-browser explorer: complete/merged.
- #69 / DEVOPS-004 — reproducible non-CI local explorer runner: complete/merged.
- #51 / PRODUCT-004 — feasibility-first re-plan after SISAL/BET365 blockers.
- #60 / PRODUCT-005 — interactive-evidence re-plan after passive candidate exhaustion.

All Milestones 0–5 implementation work remains complete for the unsigned local-preview channel.

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
- Keep expected and observed odds distinct and surface changes explicitly.
- `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states.
- Unsigned Windows preview artifacts are not production releases.
- Repository docs/specs override stale chat context and superseded closed-issue assumptions.
