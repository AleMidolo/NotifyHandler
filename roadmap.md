# NotifyHandler roadmap

## Milestone status summary

- **Milestones 0–5: complete for the local-preview MVP.** The repository can build, test, package, and smoke-test an unsigned Windows x64 desktop preview with deterministic synthetic browser coverage.
- **Production readiness is not complete.** No bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope, and Windows production signing is not yet implemented.
- **Current milestone: Milestone 6 — Evidence-backed live bookmaker readiness.** The initial passive live-validation strategy is exhausted; the next phase improves evidence collection through controlled interactive public navigation without weakening safety or transaction boundaries.
- **Next release milestone: Milestone 7 — Signed Windows production release readiness.** It remains blocked until Milestone 6 yields a genuinely live-supported pair.

## Milestone 0 — Product and safety baseline — COMPLETE

Established the repository source of truth, product requirements, automatic-start behavior, safety boundaries, notification/selection specs, backlog, and autonomous-team coordination.

## Milestone 1 — Architecture and shared contracts — COMPLETE

Delivered the local-first desktop/Playwright architecture, shared execution/adapter/matching/error contracts, independent leg state, browser/session isolation, and deterministic test strategy.

## Milestone 2 — Notification/domain foundation — COMPLETE

Delivered deterministic notification parsing, normalized domain types, structured errors, source-order primary recommendation resolution, the two-bookmaker invariant, immutable targets, and sanitized tests.

## Milestone 3 — Fixture-backed two-bookmaker preparation path — COMPLETE

Delivered SISAL and BET365 adapters behind the restricted worker contract, exact event/market/line/outcome/odds verification, isolated Chromium execution, deterministic positive/negative fixtures, authentication interruption, cancellation/attempt revocation, and post-selection verification.

**Important:** this proves fixture-backed `Testable` behavior, not live `Supported` status.

## Milestone 4 — Application orchestration and UX — COMPLETE

Delivered automatic notification processing, whole-plan preflight, automatic two-leg dispatch, independent per-leg status/recovery, non-blocking observability, desktop typed IPC, and latency instrumentation.

## Milestone 5 — Integration, security, and local-preview release readiness — COMPLETE

Delivered cross-component regressions, threat model/security hardening, reproducible CI/runtime, deterministic browser and desktop E2E, and reproducible unsigned Windows x64 preview packaging with sensitive-content checks, SBOM, checksums, provenance, smoke testing, and rollback policy.

Exit decision (2026-09-14): **complete for the unsigned local-preview channel only.** Production still requires live-supported bookmaker scope and signed Windows artifacts.

## Milestone 6 — Evidence-backed live bookmaker readiness — CURRENT

**Goal:** identify and implement the first two bookmakers for which NotifyHandler can safely prepare the documented pre-match football **full-match total-corners over/under** selection through permitted normal-browser interaction and deterministic evidence.

### Evidence from the passive-validation phase

The first live-validation strategy used deliberately passive, sanitized probes. It produced useful blocker evidence but no supported candidate:

- **SISAL / #43:** live `Blocked`; fixture-backed `Testable`.
- **BET365 / #44:** live `Blocked`; fixture-backed `Testable`.
- **LOTTOMATICA / #52:** `Blocked (feasibility)`; controlled public access did not expose the required deterministic chain.
- **EPLAY24 / #53:** `Blocked (feasibility)`; controlled public validation did not expose the required deterministic chain and an access denial was not bypassed.
- **ADMIRALBET / #54:** `Blocked (feasibility)` under the passive probe despite exposing the richest public event/generic-market/line/odds structure.

The common failure mode is now part of the product evidence: passive top-level inspection is insufficient for dynamic bookmaker market UIs. This does **not** justify guessed selectors, private/protected API reverse engineering, access-control bypass, or changing the market merely because a simpler market is visible.

### Product scope decision

Milestone 6 continues to target **pre-match football full-match total corners over/under** because that scope directly covers the representative surebet notification and exercises exact-line/side matching. Generic goal U/O, 1X2, live corner statistics, next-corner products, and editorial references are not substitutes.

### Phase A — controlled interactive evidence tooling

**#61 BOOK-012 — P0 / ready now:** build a non-CI headed-browser live-validation explorer that may use only normal same-origin public navigation and non-transactional UI expansion (event navigation, tabs, accordions, filters, market categories, scrolling/lazy-load waits).

The explorer must default-deny and must not interact with login/auth/CAPTCHA controls, betting outcomes/odds that add a selection, betslip/stake/submit/payment controls, protected/private APIs, or any mechanism that bypasses anti-bot/rate/geo/access restrictions. Evidence remains sanitized and excludes credentials, cookies/storage, authenticated captures, full HTML, and user/session data.

### Phase B — interactive revalidation

After #61:

1. **#62 BOOK-013 — ADMIRALBET interactive revalidation** — first because prior public evidence was richest.
2. **#63 BOOK-014 — SISAL interactive revalidation** — next if fewer than two feasible candidates exist; an existing fixture-backed adapter and public corner-product documentation make it strategically valuable.
3. **#64 BOOK-015 — BET365 interactive revalidation** — next if still fewer than two feasible candidates exist; an existing adapter and visible public event/pricing surface reduce downstream implementation cost if feasibility is established.

Interactive feasibility requires a deterministic **pre-activation** chain:
`event → competition/time context → full-match total-corners market → exact numeric line → requested side → displayed odds`.

Feasibility does not require exploratory outcome activation. Selected-state verification remains a later implementation/support gate and must use the restricted production selection capability only after all matching predicates are satisfied.

### Phase C — implementation and qualification

For every candidate marked `Feasible for implementation`:
- create a dedicated Bookmaker Automation implementation issue;
- implement/reuse the adapter behind existing restricted browser and selection contracts;
- add sanitized deterministic fixtures learned from permitted live structure;
- preserve exact origin, event, market, line, side, odds, freshness, cancellation, and auth gates;
- verify selected state only through the authorized production activation path;
- never add stake or wager-submission capability.

Then **#45 QA-002** certifies the first two bookmakers that actually reach narrowly scoped live `Supported` status.

### Milestone 6 rules

- no CAPTCHA/login/anti-bot/rate-limit/geo/access-control bypass;
- no protected/private API reverse engineering;
- no credential/MFA automation, stake entry, or wager submission;
- exploratory evidence collection may navigate/expand public non-transactional UI but must not activate betting outcomes;
- live validation is controlled, sanitized, and non-CI;
- fixture-backed `Testable`, `Feasible`, live `Supported`, and `Blocked` remain distinct states;
- if evidence is insufficient, mark the scope `Blocked` rather than weakening deterministic matching.

### Milestone 6 exit criteria

- at least two bookmakers are documented as narrowly scoped live `Supported` for the common full-match total-corners notification scope;
- a representative notification for that pair passes the documented automatic preparation smoke path without stake entry or wager submission;
- deterministic regression, browser E2E, security, privacy, and transaction-boundary gates remain green;
- support scope, limitations, and failure behavior are release-documentation ready.

If #61–#64 still fail to yield at least two feasible candidates, route back to Product Coordination for an explicit market-scope or candidate-pool decision rather than silently weakening the evidence gate.

## Milestone 7 — Signed Windows production release readiness — BLOCKED ON MILESTONE 6

**Goal:** produce a traceable signed Windows x64 production release candidate after a live-supported bookmaker pair exists.

**#46 DEVOPS-003** remains blocked until #45 passes for the actual supported pair. Production release work must name the real supported bookmaker/market scope; blocked or fixture-only bookmakers must not be advertised as supported.

Exit criteria:
- at least two release-scope bookmakers remain live `Supported`;
- production artifact is Authenticode-signed and publisher identity is automatically verified;
- all exact-tag build/test/audit/browser/security/package/SBOM/checksum/provenance gates pass;
- unsigned preview artifacts remain clearly separate from production artifacts;
- manual authentication, stake entry, review, and final wager submission boundaries remain intact.

## Later expansion

After Milestones 6–7 are stable, prioritize based on product evidence:
- Telegram ingestion;
- HTTP/webhook or clipboard/application ingestion;
- additional bookmaker adapters beyond the first supported pair;
- richer notification formats/provenance, including an explicit source-provided primary recommendation marker;
- observability/latency diagnostics that preserve privacy;
- macOS/Linux packaging only after their signing/sandbox distribution models are reviewed.

Transport integrations must remain decoupled from the parser/domain model and feed the same automatic execution path.
