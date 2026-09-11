# NotifyHandler backlog

Priority levels: **P0** blocks multiple downstream agents or protects correctness/safety; **P1** is required for the MVP; **P2** is post-MVP or incremental expansion.

## Product change — automatic notification execution

The original MVP flow required a parsed preview, user recommended-pair choice, and execution confirmation before browser actions. That requirement is superseded.

The current authoritative product behavior is:
- receiving a valid notification triggers processing automatically;
- the first recommended option in notification source order is the primary option for the initial contract;
- the primary option is resolved automatically into exactly two distinct bookmaker legs;
- the application must not ask the user to review, choose a pair, confirm the plan, or press start before opening the bookmaker pages;
- once deterministic parsing/target/adapter/navigation-safety checks pass, both legs should start as soon as safely practical;
- if the primary option is invalid/ambiguous/unsupported, fail safely before navigation rather than asking or silently choosing another recommendation;
- previews and target summaries may remain visible as non-blocking observability.

## Ready now

### P0 — ARCH-003 / #22: Reconcile execution contracts with automatic notification startup
Owner: Software Architect

Update architecture and normative execution contracts that still assume the user reviewed the parsed notification, selected a recommendation, or explicitly started execution.

Acceptance criteria:
- no normal pre-execution user gate remains in architecture/contracts;
- deterministic primary-option resolution has an explicit owner/boundary;
- execution begins automatically once required safety checks pass;
- matching, origin, freshness, cancellation, login, odds, and transaction-boundary invariants remain intact;
- automated test expectations include notification-to-auto-start behavior.

### P0 — BOOK-002 / #17: Prevent cancellation race from reporting READY_FOR_USER
Owner: Bookmaker Automation Engineer

Resolve the current selection-activation cancellation race and preserve activation uncertainty correctly.

### P0 — APP-002 / #21: Automatic two-leg orchestration and manual handoff
Owner: Application Engineer
Depends on: #22 and usable adapter/test doubles

Implement the automatic flow from received valid notification to both bookmaker legs, removing/bypassing the old APP-001 preview/selector/start gate.

Acceptance criteria:
- parser/validation starts on notification receipt;
- first recommendation is resolved automatically;
- invalid primary recommendation stops before navigation with no fallback;
- both legs start automatically as soon as validation permits;
- preview/target rendering does not block startup;
- two legs retain independent state;
- login-required, odds-changed, retry/reopen/cancel/restart, partial failure, and ready-for-user behavior remains explicit;
- orchestration never enters credentials, MFA/CAPTCHA values, stakes, or bet submissions.

### P1 — QA-001 / #6: Contract and integration safety suite
Owner: QA / Integration Engineer
Depends on: #22, APP-002, domain implementation, adapter/test doubles

Add deterministic regressions for automatic primary-option resolution and notification-to-browser startup alongside wrong-event/market/line/outcome, odds mismatch, login pause, partial failure, cancellation, and transaction-boundary tests.

### P1 — DEVOPS-001 / #8: Reproducible development and CI baseline
Owner: Release / DevOps Engineer

Complete/merge any remaining CI and reproducible-runtime work after current stacked changes are reconciled.

## Completed foundations

The following foundational work has already been completed but may require targeted updates because of the automatic-start product change:
- ARCH-001 / #1 — deployment/runtime architecture;
- ARCH-002 / #2 — shared execution/adapter contracts;
- DOMAIN-001 / #3 — normalized surebet domain model and deterministic parser;
- APP-001 / #5 — parsed-preview/recommended-option UI (its gating behavior is now superseded and must be bypassed/removed by APP-002);
- security baseline and other merged implementation work as represented by repository issues/commits.

Closed work remains historical evidence; current product docs and #22 override obsolete interaction assumptions.

## Later / expansion

### P1 — Second supported bookmaker path
Owner: Bookmaker Automation Engineer

After the current adapter safety blocker is resolved, complete the second compatible bookmaker adapter required for the first real two-leg pair.

### P2 — BOOK-003+: Additional bookmaker adapters
Owner: Bookmaker Automation Engineer

Add LOTTOMATICA, EPLAY24, ADMIRALBET, then additional bookmakers only after shared contracts and regression suites are stable.

### P2 — INPUT-001: Additional notification transports
Owner: Application Engineer / Notification & Domain Engineer

Add Telegram, HTTP/webhook, clipboard monitoring, or other ingestion adapters without coupling transport code to parsing/domain logic. Every transport should feed the same automatic processing/start path.

## Product constraints applying to every backlog item

- Correctness is more important than completing a click.
- Minimize notification-to-browser-open latency without weakening validation.
- Never require routine pre-execution user review, pair selection, confirmation, or start action for a valid notification.
- Never guess event, market, line, side, outcome, or recommendation identity.
- Never silently substitute a later recommended pair when the primary recommendation is invalid.
- Never automate bookmaker credentials, MFA, CAPTCHA, stakes, or bet submission.
- Do not bypass access controls, anti-bot measures, rate limits, or geo restrictions.
- Keep expected and observed odds distinct and surface changes explicitly.
- Repository docs/specs override stale chat context and superseded closed-issue assumptions.
