# NotifyHandler backlog

Priority levels: **P0** blocks the current product milestone or protects correctness/safety; **P1** is required for the next planned release milestone; **P2** is later expansion.

## Current product status

The automatic local desktop MVP is complete for the **unsigned Windows x64 preview channel**. Deterministic parsing, automatic first-recommendation resolution, automatic two-leg orchestration, independent leg state/recovery, isolated Playwright/Chromium execution, fixture-backed SISAL/BET365 adapters, security regressions, reproducible CI, and preview packaging are implemented.

The product is **not production-ready**. No bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope.

The controlled interactive explorer (**#61**) and reproducible local runner (**#69**) are complete. The remaining live-readiness blocker is environmental: the autonomous container cannot satisfy the pinned runtime/network prerequisites needed for the real ADMIRALBET run.

**Product rule:** runner, DNS, browser-host, or toolchain failure is not bookmaker feasibility evidence. It must not classify a bookmaker `Blocked` or relax matching.

## Ready now — parallel P0 tracks

### P0 — DEVOPS-005 / #71: Execute ADMIRALBET interactive validation on a qualifying local host
Owner: Release / DevOps Engineer
Milestone: 6 — Evidence-backed live bookmaker readiness

Run `npm run live:explore:local -- admiralbet` from a qualifying non-CI workstation/development host with repository-pinned Node/npm, normal outbound DNS/HTTPS, and headed Chromium support. Preserve BOOK-012 restrictions and retain only sanitized `ExplorerSummary` evidence. Environment failure is not bookmaker evidence.

### P0 — DEVOPS-006 / #75: Publish downloadable unsigned Windows alpha prerelease
Owner: Release / DevOps Engineer
Milestone: 5/6 bridge — user-testable alpha preview
Depends on: PRODUCT-007 / #74

Publish the already-proven Windows x64 preview as an easy-to-download GitHub **prerelease** so the user can try the application without relying on an expiring Actions artifact.

Acceptance summary:
- use the existing verified desktop release pipeline on an exact current `main` revision;
- retain repository checks, dependency audit, deterministic browser/desktop suites, packaged smoke, sensitive-content verification, SBOM, checksums, and provenance;
- publish a portable Windows x64 ZIP in a durable GitHub prerelease location;
- label it prominently **unsigned alpha / non-production**;
- state that no bookmaker is currently live `Supported`; SISAL/BET365 remain fixture-backed `Testable` unless the support docs change before publication;
- state that real bookmaker flows may fail safely;
- provide checksum verification/extract/run instructions and warn that Windows may show an unsigned-app warning;
- do not weaken live-support qualification, signing, authentication, or transaction boundaries.

#71 and #75 are independent and may proceed in parallel.

## Next in Milestone 6

### P0 — BOOK-013 / #62: Revalidate ADMIRALBET interactively
Owner: Bookmaker Automation Engineer
Depends on: actual sanitized qualifying-host result from #71

Interpret the real BOOK-012 result. If the full total-corners pre-activation chain is deterministic, create a separate live-mapping implementation issue. If evidence is genuinely insufficient after a qualifying run, keep ADMIRALBET `Blocked` and document the exact missing dimensions.

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

The unsigned alpha channel is not a substitute for this production gate.

## Completed / historical work

- #43 / BOOK-007 — SISAL passive public live validation: `Blocked` live, `Testable` fixtures.
- #44 / BOOK-008 — BET365 passive public live validation: `Blocked` live, `Testable` fixtures.
- #52 / BOOK-009 — LOTTOMATICA passive feasibility: `Blocked`.
- #53 / BOOK-010 — EPLAY24 passive feasibility: `Blocked`.
- #54 / BOOK-011 — ADMIRALBET passive feasibility: `Blocked`.
- #61 / BOOK-012 — controlled interactive headed-browser explorer: complete/merged.
- #69 / DEVOPS-004 — reproducible non-CI local explorer runner: complete/merged.
- #72 / PRODUCT-006 — qualifying-host blocker/routing reconciliation: complete.

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
- `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states.
- Unsigned alpha/preview artifacts are not production releases.
- Repository docs/specs override stale chat context and superseded closed-issue assumptions.
