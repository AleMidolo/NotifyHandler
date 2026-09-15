# NotifyHandler backlog

Priority levels: **P0** blocks the current product milestone or protects correctness/safety; **P1** is required for the next planned release milestone; **P2** is later expansion.

## Current product status

The automatic local desktop MVP is complete for the **unsigned Windows x64 preview channel**. Deterministic parsing, automatic first-recommendation resolution, automatic two-leg orchestration, independent leg state/recovery, isolated Playwright/Chromium execution, fixture-backed SISAL/BET365 adapters, security regressions, reproducible CI, and preview packaging are implemented.

The product is **not production-ready**. The passive live-validation phase is now exhausted:

- SISAL — live `Blocked`; fixture-backed `Testable`.
- BET365 — live `Blocked`; fixture-backed `Testable`.
- LOTTOMATICA — `Blocked (feasibility)`.
- EPLAY24 — `Blocked (feasibility)`.
- ADMIRALBET — `Blocked (feasibility)` under the passive probe despite richer public event/generic-market/line/odds visibility.

Across the candidate pool, the common limitation was inability to establish the complete deterministic selector-level chain for the target pre-match football full-match total-corners market using passive top-level inspection. The next step is to improve evidence collection through **controlled interactive public navigation**, not to weaken matching, bypass controls, or silently change the target market.

## Product decision for Milestone 6

Keep **pre-match football full-match total-corners over/under** as the current live-support target. Generic goal U/O, 1X2, live corner statistics, next-corner products, and editorial references do not satisfy the representative product use case.

Split live-readiness into three distinct stages:

1. controlled interactive evidence gathering;
2. restricted adapter/worker implementation for candidates proven feasible;
3. QA certification of the first two genuinely live-supported bookmakers.

Exploratory feasibility requires a deterministic pre-activation chain:
`event → competition/time context → full-match total-corners market → exact numeric line → requested side → displayed odds`.

Selected-state verification is a later implementation/support gate and must occur only through the existing restricted production selection capability after all deterministic predicates pass.

## Ready now

### P0 — BOOK-012 / #61: Build controlled interactive live-validation explorer
Owner: Bookmaker Automation Engineer
Milestone: 6 — Evidence-backed live bookmaker readiness

Replace the passive-only discovery limitation with a non-CI headed-browser explorer that can follow normal public same-origin navigation and expand non-transactional market UI.

Acceptance summary:
- preserve exact approved-origin, redirect, URL-userinfo, and private/internal destination protections;
- allow only explicitly non-transactional public navigation/expansion such as event links, tabs, accordions, filters, market categories, scrolling, and lazy-load waits;
- default-deny and reject login/auth/CAPTCHA controls, outcome/odds controls that add a selection, betslip/stake/submit/payment controls, and any access-control bypass behavior;
- use bounded interaction/rate budgets and stop on anti-bot, login, geo, or access denial rather than retrying around them;
- emit only sanitized structural evidence, never credentials, cookies/storage, authenticated captures, full HTML, user/session data, stakes, or wager actions;
- add boundary regressions proving forbidden controls cannot be interacted with;
- keep repository/browser/security tests green.

## Next in Milestone 6

### P0 — BOOK-013 / #62: Revalidate ADMIRALBET interactively
Owner: Bookmaker Automation Engineer
Depends on: #61

Revalidate ADMIRALBET first because its passive run exposed the richest public event, generic market, line, and odds structure. If the full total-corners pre-activation chain becomes deterministic, create a separate implementation issue; otherwise keep it blocked with explicit missing dimensions.

### P1 — BOOK-014 / #63: Revalidate SISAL interactively
Owner: Bookmaker Automation Engineer
Depends on: #61; execute if fewer than two feasible candidates exist after #62

SISAL has an existing fixture-backed adapter and public corner-product documentation. Use the interactive explorer to determine whether normal public event/market navigation exposes a deterministic total-corners chain. If feasible, create a live-mapping implementation issue that reuses the current adapter.

### P1 — BOOK-015 / #64: Revalidate BET365 interactively
Owner: Bookmaker Automation Engineer
Depends on: #61; execute if fewer than two feasible candidates exist after #62/#63

BET365 also has an existing fixture-backed adapter and public event/pricing visibility. Revalidate the total-corners path through normal public market navigation and create a live-mapping implementation issue only if deterministic evidence is sufficient.

### Implementation issues for feasible candidates
Owner: Bookmaker Automation Engineer

A candidate marked `Feasible for implementation` still needs a separately reviewable restricted adapter/worker live-mapping change with:
- deterministic sanitized fixtures learned from permitted live structure;
- exact event/competition/time/market/line/side/odds gates;
- origin, redirect, auth, odds-change, cancellation, freshness, and stale-attempt protection;
- selected-state verification through the authorized selection gate;
- no credential/MFA/CAPTCHA/stake/submit capability.

Feasibility alone never changes status to `Supported`.

### P1 — QA-002 / #45: Certify the first evidence-backed live-supported bookmaker pair
Owner: QA / Integration Engineer
Depends on: two bookmakers completing interactive feasibility, implementation, and live `Supported` qualification

QA-002 qualifies whichever first two candidates genuinely satisfy the support gate for the common full-match total-corners notification scope.

## Blocked release work

### P1 — DEVOPS-003 / #46: Prepare signed Windows production release candidate
Owner: Release / DevOps Engineer
Milestone: 7 — Production release readiness
Depends on: #45 passing and at least two release-scope bookmakers remaining live `Supported`

The unsigned preview pipeline is healthy, but production signing/release must not proceed as a publication path until Milestone 6 succeeds. Lack of supported bookmakers or an approved signing identity is a release blocker, not a reason to relax gates.

## Completed / historical live-validation work

- #43 / BOOK-007 — SISAL passive public live validation: `Blocked` live, `Testable` fixtures.
- #44 / BOOK-008 — BET365 passive public live validation: `Blocked` live, `Testable` fixtures.
- #52 / BOOK-009 — LOTTOMATICA passive feasibility: `Blocked`.
- #53 / BOOK-010 — EPLAY24 passive feasibility: `Blocked`.
- #54 / BOOK-011 — ADMIRALBET passive feasibility: `Blocked`.
- #51 / PRODUCT-004 — feasibility-first re-plan after SISAL/BET365 blockers.
- #60 / PRODUCT-005 — re-plan after the passive candidate pool was exhausted.

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
- Exploratory live validation may navigate/expand public non-transactional UI but must not activate betting outcomes.
- Keep expected and observed odds distinct and surface changes explicitly.
- `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states.
- Unsigned Windows preview artifacts are not production releases.
- Repository docs/specs override stale chat context and superseded closed-issue assumptions.
