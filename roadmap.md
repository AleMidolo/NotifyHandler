# NotifyHandler roadmap

## Milestone status summary

- **Milestones 0–5: complete for the local-preview MVP.** The repository can build, test, package, and smoke-test an unsigned Windows x64 desktop preview with deterministic synthetic browser coverage.
- **Alpha delivery track: complete.** GitHub prerelease **`v0.0.0-alpha.1`** is published from source commit `3327bc29078d0ab036453e1deaff1b7094fd29ee` with the portable Windows x64 ZIP and checksum. It is unsigned, non-production, and does not imply live bookmaker support.
- **ADMIRALBET validation track: complete for feasibility.** BOOK-013/#62 consumed the real BOOK-012 result and is `Blocked at interactive feasibility` for the narrow full-match total-corners scope.
- **SISAL portable live-validation handoff: complete.** DEVOPS-008/#88 published **`book012-sisal-diagnostic-v1`** from exact `main` commit `f77f99013b6fa4d65b6cab944af34b9d446e73c9`.
- **Production readiness is not complete.** No bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope, and Windows production signing is not implemented.
- **Current milestone: Milestone 6 — Evidence-backed live bookmaker readiness.** The relay-aware v2 stack and SEC-004 hardening are complete. PRODUCT-016/#109 is now the sole immediate blocker; BOOK-016/#104 is ready as soon as target-market evidence arrives.
- **Next production milestone: Milestone 7 — Signed Windows production release readiness.** It remains blocked until Milestone 6 yields a genuinely live-supported pair.

## Milestones 0–5 — COMPLETE FOR UNSIGNED LOCAL PREVIEW/ALPHA

Delivered:
- product/safety baseline and automatic-start behavior;
- local-first desktop + Playwright architecture and shared contracts;
- deterministic parser/domain/execution plan;
- fixture-backed SISAL/BET365 adapters and isolated Chromium worker;
- automatic two-leg desktop orchestration, recovery, and manual handoff;
- integration/security coverage and reproducible unsigned Windows x64 preview packaging with SBOM/checksums/provenance;
- durable unsigned Windows x64 alpha prerelease `v0.0.0-alpha.1` for user application testing.

This maturity is `Testable`/alpha, not a live bookmaker support claim.

## Alpha preview delivery — COMPLETE

**#75 DEVOPS-006 — COMPLETE:** the verified Windows x64 preview pipeline publishes a durable GitHub prerelease. The first published alpha is **`v0.0.0-alpha.1`**.

The alpha remains explicitly unsigned and non-production, states that no bookmaker is currently live `Supported`, and preserves manual authentication, stake entry, review, and final wager submission.

Alpha publication does not satisfy Milestone 6 or Milestone 7.

## Milestone 6 — Evidence-backed live bookmaker readiness — CURRENT

**Goal:** identify and implement the first two bookmakers for which NotifyHandler can safely prepare the documented pre-match football **full-match total-corners over/under** selection through permitted normal-browser interaction and deterministic evidence.

### Completed evidence/tooling work

The initial passive phase produced useful blocker evidence but no supported candidate:
- SISAL / #43 — live `Blocked`, fixture-backed `Testable`;
- BET365 / #44 — live `Blocked`, fixture-backed `Testable`;
- LOTTOMATICA / #52 — `Blocked (feasibility)`;
- EPLAY24 / #53 — `Blocked (feasibility)`;
- ADMIRALBET / #54 — `Blocked (feasibility)` under the passive probe.

The controlled interactive phase is technically ready:
- **#61 BOOK-012 — COMPLETE:** non-CI headed-browser explorer with default-deny interaction classification, bounded navigation/expansion, sanitized evidence, and no outcome activation/auth/stake/submit capability.
- **#69 DEVOPS-004 — COMPLETE:** repository-level local runner with pinned toolchain checks, CI refusal, Chromium setup, DNS diagnostics, and deterministic guard tests.
- **#81 DEVOPS-007 — COMPLETE:** portable Windows x64 diagnostic bundle with pinned Node/Playwright/Chromium inputs, fail-closed CI guards, checksum/provenance, synthetic-only packaged smoke, and durable prerelease publication.

Published diagnostic handoff:
- prerelease/tag: **`book012-admiralbet-diagnostic-v1`**;
- exact source commit: `d16e34dec26086497c6b581a77ba26038b34b836`;
- ZIP: `notifyhandler-book012-admiralbet-d16e34dec260-win32-x64.zip`;
- expected ZIP SHA-256: `ee7bc881b6823fb80f64c51e9bf43732329a5eb1ca3a0987915c0eacabc033de`;
- launcher: `run-admiralbet-validation.cmd`.

### ADMIRALBET interactive feasibility — COMPLETE / BLOCKED

**#62 BOOK-013 — COMPLETE**

The qualifying ADMIRALBET BOOK-012 result was interpreted and merged via PR #68. For the narrow pre-match football full-match total-corners scope, ADMIRALBET is **Blocked at interactive feasibility**. The bounded explorer reached the football surface but did not establish the required selector-level event, competition/time, full-match total-corners, exact-line, side, and bound-odds chain. No production mapping was authorized.

### SISAL diagnostic packaging — COMPLETE

**#88 DEVOPS-008 — COMPLETE**

Published:
- prerelease/tag: **`book012-sisal-diagnostic-v1`**;
- exact source: `f77f99013b6fa4d65b6cab944af34b9d446e73c9`;
- ZIP: `notifyhandler-book012-sisal-f77f99013b6f-win32-x64.zip`;
- expected SHA-256: `03d053426b75711aab730d7eeb01b29db88e0d62b0643c768556dd30c9b89439`;
- launcher: `run-sisal-validation.cmd`.

### SISAL interactive feasibility — COMPLETE / BLOCKED

**#63 BOOK-014 — COMPLETE**

The qualifying SISAL BOOK-012 result was interpreted and merged via PR #95. For the narrow pre-match football full-match total-corners scope, SISAL remains **Blocked at interactive live feasibility**. The existing fixture-backed adapter remains Testable; no production live selector mapping was authorized.

### BET365 diagnostic packaging and workstation execution — COMPLETE

**#96 DEVOPS-010 — COMPLETE**
Published **`book012-bet365-diagnostic-v1`** from exact `main` commit `dee0a2c50ce64c195df424c8c4938e0726f70127`.

**#97 DEVOPS-011 — COMPLETE**
A real non-CI Windows workstation executed the approved BET365 diagnostic. The sanitized BOOK-012 result reports `status: BUDGET_EXHAUSTED`, fixed 10/10 actions, 11 snapshots, final path `/hub/it-it/football/football-competitions/bundesliga`, and `authorizesProductionMapping: false`.

This completes execution/handoff only. It does not itself classify BET365 or authorize production mapping.

### PRODUCT-015 replan — DIRECT-MATCH-LINK-FIRST

BOOK-015/#64 is complete via PR #101 and BET365 remains Blocked at interactive live feasibility for the narrow full-match total-corners scope. Together with BOOK-013 and BOOK-014, this exhausts PRODUCT-005's generic football/competition-navigation validation queue without a feasible live candidate.

The product target **does not change**. Milestone 6 still targets pre-match football full-match total-corners over/under with deterministic event/context/market/line/side/odds evidence.

The strategy changes because the real surebet source supplies the exact two bookmaker legs and a deep link intended to open each match page directly. Generic event discovery is therefore not the production-critical path.

**#103 ARCH-004 — COMPLETE**

PR #108 defines `notifyhandler.direct-pair.v1`, the conceptual loopback-only `POST /api/v1/notifications/direct-pair` endpoint, local bearer authentication, bounded JSON, freshness/idempotency semantics, direct-link validation, and no generic-discovery fallback for structured v1.

### Structured ingress and hardening — COMPLETE

**#105 APP-005 — COMPLETE**

Merged via PR #112. The desktop now exposes the accepted loopback-only structured direct-pair ingress and converges valid requests into the existing immutable two-leg execution path.

**#106 SEC-002 — COMPLETE**

Merged via PR #114. Direct-link preflight/live navigation now fail closed on forbidden DNS/private targets; local bearer storage/rotation, Host/Origin behavior, privacy, and zero-navigation security regressions are hardened.

**#113 SEC-003 — COMPLETE**

Merged via PR #115. Structured-ingress idempotency is restart-safe through bounded user-only tombstones that persist only id/hash/execution-id/timestamp/state metadata. Raw request bodies, deep links, bearer tokens, cookies/session data, credentials, and transaction data are not persisted.

### Relay-aware stack — IMPLEMENTED

The real upstream relay format is now fully represented in the runtime while preserving direct-link v1 safety.

Completed:
- **#119 ARCH-005 / PR #122** — `direct-pair.v2`, typed relay/direct navigation, trusted relay semantics;
- **#128 ARCH-006** — explicit immutable market period identity;
- shared domain propagation of `full_match` period;
- **#123 APP-006 / PR #126** — typed v2 ingestion;
- **#131 BOOK-018** — SISAL/BET365 period enforcement with first-half/unknown-period safe rejection;
- **#124 BOOK-017 / PR #134** — restricted worker/browser-gateway `bet-up.it` resolver.

Relay resolution itself remains non-authorizing navigation metadata. Matching starts only after arrival at the expected bookmaker origin in a fresh evidence epoch.

### Relay security — COMPLETE

**#125 SEC-004 / PR #137 — COMPLETE**

Security review found and closed two concrete gaps:
- relay-page subresources now fail closed on private/internal network targets;
- HTTP redirects are terminated and their `Location` validated before any destination request.

The comprehensive pinned-Chromium relay suite passes **40/40**, including valid SISAL/BET365 resolution, intermediary/wrong-bookmaker rejection, loop/challenge handling, private DNS/subresources, retry, auth-resume, capability revocation, cancellation, and relay-evidence isolation. No additional live-support blocker was found.

### Current blocker

**#109 PRODUCT-016 — SOLE IMMEDIATE P0 BLOCKER**

Still required: one current/still-reachable upstream `bet-up.it` signal for pre-match football **full-match total-corners O/U**, with exact event/context/line/side/expected odds for the bookmaker(s) BOOK-016 will validate.

Recorded double-chance and team-corners examples remain useful fixtures but are not substitutes for the target market.

**#104 BOOK-016 — READY WHEN #109 IS SATISFIED**

All technical prerequisites are now complete. Run relay-aware live validation through the merged v2/resolver/security stack and independently prove:
`relay -> expected bookmaker -> event -> competition/time context -> full-match total-corners -> exact numeric line -> requested side -> displayed odds`.

If feasible, create a separate restricted live-mapping implementation issue. If the required pair remains blocked, return to Product Coordination for candidate-pool or explicit market-scope reconsideration.

### Implementation and qualification

For each candidate marked `Feasible for implementation`:
- create a dedicated live-mapping implementation issue;
- reuse/implement the adapter behind restricted browser/selection contracts;
- add sanitized deterministic fixtures learned from permitted live structure;
- preserve exact origin/event/market/line/side/odds/freshness/cancellation/auth gates;
- verify selected state only through the authorized production activation path;
- never add stake or wager-submission capability.

Then **#45 QA-002** certifies the first two bookmakers that actually reach narrowly scoped live `Supported` status.

### Milestone 6 rules

- no CAPTCHA/login/anti-bot/rate-limit/geo/access-control bypass;
- no protected/private API reverse engineering;
- no credential/MFA automation, stake entry, or wager submission;
- exploratory evidence collection may navigate/expand public non-transactional UI but must not activate betting outcomes;
- live bookmaker validation is controlled, sanitized, and non-CI;
- CI may package/test the diagnostic runner only against synthetic/local targets;
- environment failure is not bookmaker evidence;
- fixture-backed `Testable`, `Feasible`, live `Supported`, and `Blocked` are distinct states.

### Milestone 6 exit criteria

- at least two bookmakers are documented as narrowly scoped live `Supported` for the common full-match total-corners notification scope;
- a representative notification for that pair passes the automatic preparation smoke path without stake entry or wager submission;
- deterministic regression, browser E2E, security, privacy, and transaction-boundary gates remain green;
- support scope, limitations, and failure behavior are release-documentation ready.

## Milestone 7 — Signed Windows production release readiness — BLOCKED ON MILESTONE 6

**#46 DEVOPS-003** remains blocked until #45 passes for the actual supported pair.

Exit criteria include:
- at least two release-scope bookmakers remain live `Supported`;
- production artifact is Authenticode-signed and publisher identity is verified;
- exact-tag build/test/audit/browser/security/package/SBOM/checksum/provenance gates pass;
- unsigned preview/alpha artifacts remain clearly separate from production artifacts;
- manual authentication, stake entry, review, and final wager submission boundaries remain intact.

## Later expansion

After Milestones 6–7 are stable:
- additional bookmakers;
- Telegram ingestion;
- clipboard/application ingestion;
- richer notification provenance and privacy-preserving diagnostics;
- macOS/Linux packaging after platform-specific distribution review.
