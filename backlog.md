# NotifyHandler backlog

Priority levels: **P0** blocks the current product milestone or protects correctness/safety; **P1** is required for the next planned release milestone; **P2** is later expansion.

## Current product status

The automatic local desktop MVP is complete for the **unsigned Windows x64 preview/alpha channel**. Deterministic parsing, automatic first-recommendation resolution, automatic two-leg orchestration, independent leg state/recovery, isolated Playwright/Chromium execution, fixture-backed SISAL/BET365 adapters, security regressions, reproducible CI, and preview packaging are implemented.

The first downloadable user alpha is published as GitHub prerelease **`v0.0.0-alpha.1`** from source commit `3327bc29078d0ab036453e1deaff1b7094fd29ee`. It is unsigned, non-production, and does not imply live bookmaker support.

The product is **not production-ready**. No bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope.

The controlled interactive explorer (**#61**), reproducible local runner (**#69**), and portable Windows ADMIRALBET validation bundle (**#81**) are complete. The durable diagnostic prerelease is **`book012-admiralbet-diagnostic-v1`**, built from exact `main` commit `d16e34dec26086497c6b581a77ba26038b34b836`.

BOOK-013/#62 is complete and merged through PR #68. ADMIRALBET is **Blocked at interactive feasibility** for the narrow pre-match football full-match total-corners scope because the qualifying bounded explorer run did not establish the full deterministic target chain. This does not imply a generic ADMIRALBET blocker outside that scope.

DEVOPS-008/#88 is also complete. It published SISAL diagnostic prerelease **`book012-sisal-diagnostic-v1`** from exact `main` commit `f77f99013b6fa4d65b6cab944af34b9d446e73c9`, with ZIP SHA-256 `03d053426b75711aab730d7eeb01b29db88e0d62b0643c768556dd30c9b89439`.

**Product rule:** runner, DNS, browser-host, or toolchain failure is environment evidence, not bookmaker feasibility evidence. It must not classify a bookmaker `Blocked` or relax deterministic matching.

## Ready now

### P0 — APP-008 / #207: COMPLETE via PR #216
Application state/UI no longer contains changed-price acknowledgement or a price-driven action-required path.

### P0 — BOOK-028 / #208: COMPLETE via PR #218
Adapter/activation authorization no longer depends on price; deterministic identity and selected-state verification remain mandatory.

### P0 — BOOK-030 / #210: evidence-backed BET365 exact WSS host rule
Owner: Bookmaker Automation Engineer
Depends on: BOOK-031/#221, SEC-010/#222, QA-009/#223, DEVOPS-018/#224 — complete

DEVOPS-018 retained exactly one validated canonical candidate hostname, `premws-pt1.it.365lpodds.com`, under the approved no-connect observer procedure. PR #226 proposes that hostname as an **exact host only**. BET365 `reviewedHostSuffixes` stays empty; no sibling, child, parent, wildcard, or inferred numbered host is authorized.

### P0 review gates — SEC-011 / #227 -> QA-010 / #228
Security must approve the exact source rule before QA independently certifies the exact-host, suffix-confusion, DNS/public-target, cancellation/stale-attempt, relay-WSS, privacy, matching-isolation, and transaction-boundary regressions.

Neither review performs a live bookmaker run. A BET365 render re-test remains prohibited until both gates approve the merged rule.

### P0 external evidence — PRODUCT-030 / #197
Owner: Product Coordinator / upstream surebet integration

Fresh direct-link targets may be supplied when available. Stable odds are not required; identity + direct URL are the relevant inputs.

## Next in Milestone 6

### Implementation issues for feasible candidates
Owner: Bookmaker Automation Engineer

A candidate marked `Feasible for implementation` still requires a separately reviewable restricted adapter/worker live-mapping change with deterministic fixtures, exact event/competition/time/market/line/side gates, origin/redirect/auth/cancellation/freshness protections, optional odds observability, and selected-state verification. Feasibility alone never changes status to `Supported`.

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
- #62 / BOOK-013 — ADMIRALBET interactive feasibility: `Blocked` for the narrow full-match total-corners scope; PR #68 merged.
- #88 / DEVOPS-008 — SISAL-specific portable BOOK-012 diagnostic bundle and prerelease: complete.
- #89 / DEVOPS-009 — qualifying non-CI Windows SISAL explorer execution and sanitized result handoff: complete.
- #63 / BOOK-014 — SISAL interactive live feasibility: `Blocked` for the narrow full-match total-corners scope; PR #95 merged.
- #96 / DEVOPS-010 — BET365-specific portable BOOK-012 diagnostic bundle and prerelease: complete.
- #97 / DEVOPS-011 — qualifying non-CI Windows BET365 explorer execution and sanitized result handoff: complete.
- #64 / BOOK-015 — BET365 interactive live feasibility: `Blocked` for the narrow full-match total-corners scope; PR #101 merged.
- #103 / ARCH-004 — structured direct-pair ingestion and direct-link trust boundary: complete via PR #108.
- #119 / ARCH-005 — trusted bet-up relay architecture / direct-pair v2: complete via PR #122.
- #128 / ARCH-006 — explicit market-period selection identity: complete.
- #123 / APP-006 — typed relay-aware direct-pair v2 ingestion: complete via PR #126.
- #131 / BOOK-018 — full-match period enforcement in SISAL/BET365 matching: complete.
- #124 / BOOK-017 — restricted bet-up relay resolver: complete via PR #134.
- #125 / SEC-004 — relay network/redirect security review and hardening: complete via PR #137; relay suite 40/40 green.
- #109 / PRODUCT-016 — target-market BET365/SISAL relay evidence handoff: complete; Portogallo - Galles, full-match U/O corners 6.5.
- #163 / QA-005 — fail-closed relay preflight and one-shot replacement authorization: complete.
- #161 / DEVOPS-014 — qualified BET365/SISAL relay-invalid category capture: complete; both `UNREVIEWED_SAME_ORIGIN_PATH`.
- #166 / BOOK-022 — interpretation complete; bookmaker feasibility remained unobserved under Betup.
- #167 / PRODUCT-026 — completed via alternative direct bookmaker-origin integration contract; Betup removed from active critical path.
- #173 / BOOK-023 tooling PR — source-locked fail-closed direct validation runner: merged.
- #174 / DEVOPS-015 — qualifying non-CI BET365/SISAL direct-link execution and sanitized evidence handoff: complete.
- #170 / BOOK-023 — direct-link feasibility interpretation: complete; BET365 and SISAL remain live `Blocked` for the narrow full-match total-corners scope and fixture-backed `Testable`.
- #177 / BOOK-024 — target-aware passive direct-page evidence probe: complete via PR #181.
- #178 / SEC-007 — BOOK-024 privacy/network/transaction-boundary security review: complete.
- #179 / QA-006 — BOOK-024 deterministic certification and one-shot live authorization: complete.
- #182 / DEVOPS-016 — one qualified passive BET365 and SISAL execution: complete.
- #183 / BOOK-025 — passive diagnostic interpretation: complete; neither bookmaker reaches `Feasible for implementation`.
- #184 / ARCH-008 — finite redacted passive transport/render-state diagnostic provenance: complete via PR #187.
- #200 / ARCH-010 — odds made informational/non-gating: complete via PR #205.
- #203 / ARCH-011 — bounded bookmaker WSS page-transport policy: complete via PR #205.
- #206 / DOMAIN-003 — optional informational expected-odds domain migration: complete via PR #214.
- #105 / APP-005 — authenticated loopback structured direct-pair ingress: complete via PR #112.
- #106 / SEC-002 — loopback ingress and direct-link DNS/token hardening: complete via PR #114.
- #113 / SEC-003 — restart-safe structured-ingress idempotency: complete via PR #115.

All Milestones 0–5 implementation work remains complete for the unsigned local-preview/alpha channel.

## Later expansion

After a live-supported pair and production-release path are stable:
- additional evidence-backed bookmakers;
- Telegram ingestion and non-local relay integrations;
- clipboard/application ingestion;
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
