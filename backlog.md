# NotifyHandler backlog

Priority levels: **P0** blocks the current product milestone or protects correctness/safety; **P1** is required for the next planned release milestone; **P2** is later expansion.

## Current product status

The automatic local desktop MVP is **complete for the unsigned Windows x64 preview channel** as of 2026-09-14:

- deterministic notification parsing and automatic first-recommendation resolution are implemented;
- both legs start automatically after shared preflight, with no review/choice/start gate;
- SISAL and BET365 adapters run through the isolated Playwright worker and deterministic Chromium fixtures;
- the desktop shell exposes independent leg status/recovery and preserves the manual transaction boundary;
- CI, browser E2E, security regressions, packaging verification, SBOM/checksums/provenance, and packaged-app smoke are green;
- an unsigned portable Windows x64 preview artifact can be produced reproducibly.

This does **not** mean the product is production-release ready. SISAL and BET365 remain fixture-backed `Testable`, not live `Supported`, and Windows production distribution still requires signing. See `docs/bookmaker-support.md` and `docs/release.md`.

## Ready now

### P0 — BOOK-007 / #43: Validate live SISAL mapping for the MVP scope
Owner: Bookmaker Automation Engineer
Milestone: 6 — Initial live bookmaker readiness

Validate and implement the permitted normal-browser SISAL mapping for the narrow pre-match football total-corners scope already covered by the domain/adapter contracts.

Acceptance summary:
- preserve exact event/market/line/outcome/odds gates and approved-origin policy;
- use only normal permitted browser interaction; never bypass authentication/CAPTCHA/anti-bot/rate/geo/access controls or protected APIs;
- add sanitized deterministic regressions for live-DOM structures learned during mapping;
- document a controlled non-CI live smoke procedure with no stake entry or wager submission;
- promote the documented narrow scope to `Supported` only if every support gate passes; otherwise mark/document the blocker.

## Next in Milestone 6

### P1 — BOOK-008 / #44: Validate live BET365 mapping for the MVP scope
Owner: Bookmaker Automation Engineer
Depends on: #43 patterns/infrastructure where reusable

Apply the same permitted live-mapping and support gates to BET365 Italy. The final result must be an evidence-backed narrow `Supported` scope or an explicit `Blocked` result; matching/safety rules must not be weakened to force success.

### P1 — QA-002 / #45: Certify the initial SISAL + BET365 live-supported pair
Owner: QA / Integration Engineer
Depends on: #43 and #44 completing as `Supported`

Qualify the real two-bookmaker path end-to-end while preserving automatic startup, deterministic matching, independent leg state, auth/odds/cancellation behavior, privacy, and the manual stake/submission boundary.

## After Milestone 6

### P1 — DEVOPS-003 / #46: Prepare signed Windows production release candidate
Owner: Release / DevOps Engineer
Milestone: 7 — Production release readiness
Depends on: #45 passing and the initial pair remaining `Supported`

Extend the proven unsigned preview pipeline with a controlled Authenticode signing path, exact-tag production gates, signature verification, production release metadata, and rollback validation. Lack of an approved signing identity remains a release blocker rather than a reason to publish unsigned production artifacts.

## Completed through local-preview MVP

The following work is complete/merged and must not be treated as ready backlog work:

- ARCH-001 / #1 — local desktop/Playwright deployment architecture;
- ARCH-002 / #2 — shared execution, matching, adapter, error, and test contracts;
- ARCH-003 / #22 — automatic primary-option startup contract;
- DOMAIN-001 / #3 and DOMAIN-002 / #11 — deterministic parser/domain model and two-bookmaker invariant;
- BOOK-001 / #4 and BOOK-002 / #17 — SISAL testable adapter and cancellation-race safety;
- BOOK-003 / #28 plus follow-up hardening — BET365 testable adapter;
- BOOK-005 / #33 plus BOOK-006 / #35 — isolated Playwright worker and attempt revocation;
- APP-001 / #5 — legacy/non-blocking preview helper;
- APP-002 / #21, APP-003 / #36, APP-004 / #38 — automatic orchestration, real worker composition, desktop shell and recovery UI;
- QA-001 / #6 — deterministic integration/transaction-boundary regression coverage;
- SEC-001 / #7 — threat model and security hardening;
- DEVOPS-001 / #8 — reproducible workspace/CI baseline;
- DEVOPS-002 / #40 — reproducible unsigned Windows x64 preview packaging.

Closed issues/PRs are historical evidence. Current product docs, support status, and open milestone issues are authoritative.

## Later expansion

After the initial live-supported pair and production-release path are stable:

### P2 — Additional bookmaker adapters
Owner: Bookmaker Automation Engineer

Evaluate LOTTOMATICA, EPLAY24, ADMIRALBET, then other approved bookmakers incrementally. Do not fan out before the first pair's live-support maintenance model is understood.

### P2 — Additional notification transports
Owner: Application Engineer / Notification & Domain Engineer

Add Telegram, HTTP/webhook, clipboard monitoring, or other ingestion adapters without coupling transport code to parsing/domain logic. Every transport must feed the existing deterministic automatic-start path.

## Product constraints applying to every backlog item

- Correctness is more important than completing a click.
- Minimize notification-to-browser-open latency without weakening validation.
- Never require routine pre-execution user review, pair selection, confirmation, or start action for a valid notification.
- Never guess event, market, line, side, outcome, or recommendation identity.
- Never silently substitute a later recommended pair when the primary recommendation is invalid.
- Never automate bookmaker credentials, MFA, CAPTCHA, stakes, or bet submission.
- Do not bypass authentication, anti-bot measures, access controls, rate limits, or geo restrictions.
- Do not rely on protected/private bookmaker APIs.
- Keep expected and observed odds distinct and surface changes explicitly.
- Unsigned Windows preview artifacts are not production releases.
- Repository docs/specs override stale chat context and superseded closed-issue assumptions.
