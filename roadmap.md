# NotifyHandler roadmap

## Milestone status summary

- **Milestones 0–5: complete for the local-preview MVP.** The repository can build, test, package, and smoke-test an unsigned Windows x64 desktop preview with deterministic synthetic browser coverage.
- **Production readiness is not complete.** SISAL and BET365 are fixture-backed `Testable` but their live pre-match football total-corners scopes are `Blocked`; Windows production signing is also not implemented.
- **Current milestone: Milestone 6 — Evidence-backed live bookmaker readiness.** The milestone is now in feasibility triage for alternative bookmakers.
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

**Goal:** identify and implement the first two bookmakers for which NotifyHandler can safely prepare the documented pre-match football total-corners selection through permitted normal-browser interaction and deterministic selector-level evidence.

### Evidence from the original pair

- **SISAL / #43:** live scope `Blocked`; fixture-backed path remains `Testable`.
- **BET365 / #44:** live scope `Blocked`; fixture-backed path remains `Testable`.

The blocker is not basic site reachability. The controlled public validation surface did not establish the complete selector-level event → total-corners market → exact line → requested side → displayed odds → selected-state chain required by the matching contract. The project will not substitute guessed selectors, unrelated prices, private/protected APIs, or access-control bypasses.

### Phase A — feasibility triage

Evaluate the remaining user-prioritized candidates incrementally before investing in complete adapters:

1. **#52 BOOK-009 — LOTTOMATICA feasibility** — P0 / ready now.
2. **#53 BOOK-010 — EPLAY24 feasibility** — next if fewer than two viable live candidates exist.
3. **#54 BOOK-011 — ADMIRALBET feasibility** — next if fewer than two viable live candidates exist after #53.

For each candidate, use only permitted normal public-browser interaction and record one of:

- **Feasible for implementation** — selector-level evidence appears sufficient to justify a separately reviewable adapter/worker implementation task; or
- **Blocked** — the evidence required by the deterministic matching contract cannot currently be established safely.

Feasibility is not `Supported` status. A feasible candidate still needs its restricted adapter/worker mapping, sanitized deterministic regressions, security/transaction-boundary checks, and controlled live validation before promotion to `Supported`.

Stop the feasibility sweep once at least two viable candidates have been identified, unless evidence suggests the next candidate should still be assessed for resilience/backup value. If the candidate list is exhausted with fewer than two viable candidates, route back to Product Coordinator for a new scope decision rather than weakening matching rules.

### Phase B — implementation and qualification

For every feasible candidate selected for the first pair:
- create a dedicated Bookmaker Automation implementation issue;
- implement behind the existing restricted contracts and origin policy;
- add deterministic sanitized fixtures learned from permitted live structure;
- satisfy the same wrong-event/market/line/outcome, odds-change, auth, cancellation, stale-attempt, post-selection, and transaction-boundary gates used by the current adapters.

Then **#45 QA-002** certifies the first two bookmakers that actually reach narrowly scoped live `Supported` status. The original hard-coded SISAL + BET365 dependency is superseded.

### Milestone 6 rules

- no CAPTCHA/login/anti-bot/rate-limit/geo/access-control bypass;
- no protected/private API reverse engineering;
- no credential/MFA automation, stake entry, or wager submission;
- live validation is controlled, sanitized, and non-CI;
- fixture-backed `Testable` is not live `Supported`;
- if evidence is insufficient, mark the scope `Blocked` rather than weakening deterministic matching.

### Milestone 6 exit criteria

- at least two bookmakers are documented as narrowly scoped live `Supported` for a common notification/market scope;
- a representative notification for that pair passes the documented automatic preparation smoke path without stake entry or wager submission;
- deterministic regression, browser E2E, security, privacy, and transaction-boundary gates remain green;
- support scope, limitations, and failure behavior are release-documentation ready.

## Milestone 7 — Signed Windows production release readiness — BLOCKED ON MILESTONE 6

**Goal:** produce a traceable signed Windows x64 production release candidate after a live-supported bookmaker pair exists.

**#46 DEVOPS-003** remains blocked until #45 passes for the actual supported pair. Production release work must name the real supported bookmaker/market scope; SISAL/BET365 must not be advertised as supported while their live scopes remain blocked.

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
