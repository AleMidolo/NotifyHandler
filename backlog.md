# NotifyHandler backlog

Priority levels: **P0** blocks the current product milestone or protects correctness/safety; **P1** is required for the next planned release milestone; **P2** is later expansion.

## Current product status

The automatic local desktop MVP is complete for the **unsigned Windows x64 preview channel**. Deterministic parsing, automatic first-recommendation resolution, automatic two-leg orchestration, independent leg state/recovery, isolated Playwright/Chromium execution, fixture-backed SISAL/BET365 adapters, security regressions, reproducible CI, and preview packaging are implemented.

The product is **not production-ready**. Live validation on 2026-09-14 established:

- SISAL: `Blocked` for the live pre-match football total-corners scope; fixture-backed path remains `Testable`.
- BET365: `Blocked` for the live pre-match football total-corners scope; fixture-backed path remains `Testable`.

Both blockers arise because the complete deterministic selector-level event/market/exact-line/side/odds/selected-state chain could not be established through the permitted controlled public surface. This is not a reason to weaken matching or bypass access controls.

## Ready now

### P0 — BOOK-009 / #52: Validate live LOTTOMATICA feasibility for the MVP scope
Owner: Bookmaker Automation Engineer
Milestone: 6 — Evidence-backed live bookmaker readiness

Run feasibility-first permitted public-browser validation before implementing a full LOTTOMATICA adapter.

Acceptance summary:
- identify the canonical approved HTTPS origin/navigation path;
- determine whether selector-level evidence can establish the exact event → full-match total-corners market → numeric line → requested side → displayed odds chain required by the shared contracts;
- use no guessed selectors, unrelated prices, protected/private APIs, or CAPTCHA/login/anti-bot/rate/geo/access-control bypass;
- collect no credentials/session data and perform no stake entry or wager submission;
- record a sanitized outcome of `Feasible for implementation` or `Blocked`;
- if feasible, create a separate implementation issue rather than calling feasibility evidence `Supported`.

## Next in Milestone 6

### P1 — BOOK-010 / #53: Validate live EPLAY24 feasibility
Owner: Bookmaker Automation Engineer
Depends on: #52 outcome/patterns

Execute next if fewer than two viable live candidates have been identified. Apply the same feasibility-only evidence gate and safe public-browser constraints.

### P1 — BOOK-011 / #54: Validate live ADMIRALBET feasibility
Owner: Bookmaker Automation Engineer
Depends on: #53 outcome/patterns

Execute if fewer than two viable live candidates exist after EPLAY24 validation. Apply the same feasibility-only evidence gate.

### Implementation issues for feasible candidates
Owner: Bookmaker Automation Engineer

A candidate that passes feasibility still needs a separately reviewable restricted adapter/worker implementation with deterministic sanitized fixtures, exact matching regressions, origin policy, auth/odds/cancellation/stale-attempt handling, post-selection verification, and transaction-boundary tests before it may become live `Supported`.

### P1 — QA-002 / #45: Certify the first evidence-backed live-supported bookmaker pair
Owner: QA / Integration Engineer
Depends on: two bookmakers reaching narrowly scoped live `Supported` status

The former hard-coded SISAL + BET365 certification dependency is superseded. QA-002 will qualify whichever first two candidates genuinely satisfy the support gate for a common market/notification scope.

## Blocked release work

### P1 — DEVOPS-003 / #46: Prepare signed Windows production release candidate
Owner: Release / DevOps Engineer
Milestone: 7 — Production release readiness
Depends on: #45 passing and at least two release-scope bookmakers remaining live `Supported`

The unsigned preview pipeline is healthy, but production signing/release must not proceed as a publication path until Milestone 6 succeeds. Lack of supported bookmakers or an approved signing identity is a release blocker, not a reason to relax gates.

## Completed / historical live-validation work

- #43 / BOOK-007 — SISAL public live validation: `Blocked` live, `Testable` fixtures.
- #44 / BOOK-008 — BET365 public live validation: `Blocked` live, `Testable` fixtures.
- #51 / PRODUCT-004 — re-plan Milestone 6 after those blockers.

All Milestones 0–5 implementation work remains complete for the unsigned local-preview channel.

## Later expansion

After a live-supported pair and production-release path are stable:

### P2 — Additional bookmaker adapters
Owner: Bookmaker Automation Engineer

Continue adding evidence-backed bookmakers incrementally using the same feasibility/support distinction. Do not equate a reachable page or fixture-backed adapter with live support.

### P2 — Additional notification transports
Owner: Application Engineer / Notification & Domain Engineer

Add Telegram, HTTP/webhook, clipboard monitoring, or other ingestion adapters without coupling transport code to parsing/domain logic. Every transport must feed the existing deterministic automatic-start path.

## Product constraints applying to every backlog item

- Correctness is more important than completing a click.
- Minimize notification-to-browser-open latency without weakening validation.
- Never require routine pre-execution user review, pair selection, confirmation, or start action for a valid notification.
- Never guess event, market, line, side, outcome, recommendation identity, or live DOM mapping.
- Never silently substitute a later recommended pair when the primary recommendation is invalid.
- Never automate bookmaker credentials, MFA, CAPTCHA, stakes, or bet submission.
- Do not bypass authentication, anti-bot measures, access controls, rate limits, or geo restrictions.
- Do not rely on protected/private bookmaker APIs.
- Keep expected and observed odds distinct and surface changes explicitly.
- `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states.
- Unsigned Windows preview artifacts are not production releases.
- Repository docs/specs override stale chat context and superseded closed-issue assumptions.
