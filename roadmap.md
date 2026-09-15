# NotifyHandler roadmap

## Milestone status summary

- **Milestones 0–5: complete for the local-preview MVP.** The repository can build, test, package, and smoke-test an unsigned Windows x64 desktop preview with deterministic synthetic browser coverage.
- **Alpha delivery track: complete.** GitHub prerelease **`v0.0.0-alpha.1`** is published from source commit `3327bc29078d0ab036453e1deaff1b7094fd29ee` with the portable Windows x64 ZIP and checksum. It is unsigned, non-production, and does not imply live bookmaker support.
- **Production readiness is not complete.** No bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope, and Windows production signing is not implemented.
- **Current milestone: Milestone 6 — Evidence-backed live bookmaker readiness.** The interactive explorer and local runner are implemented; the immediate blocker is obtaining a real sanitized live-validation result from a qualifying non-CI host.
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

**#75 DEVOPS-006 — COMPLETE:** the existing verified Windows x64 preview pipeline now publishes a durable GitHub prerelease. The first published alpha is **`v0.0.0-alpha.1`**.

The alpha remains explicitly unsigned and non-production, retains repository/audit/browser/package/smoke/SBOM/checksum/provenance gates, states that no bookmaker is currently live `Supported`, and preserves manual authentication, stake entry, review, and final wager submission.

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

The controlled interactive phase is technically enabled:
- **#61 BOOK-012 — COMPLETE:** non-CI headed-browser explorer with default-deny interaction classification, bounded navigation/expansion, sanitized evidence, and no outcome activation/auth/stake/submit capability.
- **#69 DEVOPS-004 — COMPLETE:** repository-level local runner `npm run live:explore:local -- <bookmaker>` with pinned toolchain checks, CI refusal, Chromium setup, DNS diagnostics, and deterministic guard tests.

### Current blocker — qualifying external host execution

**#71 DEVOPS-005 — P0**

The autonomous execution container cannot perform the real ADMIRALBET run because its Node/npm versions do not match repository pins and outbound DNS cannot resolve `www.admiralbet.it`.

DEVOPS-005 must therefore run the existing command from a qualifying normal development/workstation environment with:
- current `main` checkout;
- repository-pinned Node/npm;
- normal outbound DNS/HTTPS;
- headed Chromium support;
- the existing BOOK-012 interaction/capability restrictions unchanged.

Only sanitized `ExplorerSummary` JSON plus minimal non-sensitive prerequisite diagnostics may be retained. Repeating the same task in the known-incompatible autonomous container is not progress and must not change bookmaker status.

**Important product rule:** runner/toolchain/DNS/browser-host failure is not bookmaker feasibility evidence. It must not classify a bookmaker `Blocked` or justify relaxing the market/matching policy.

### Interactive evidence order

1. **#71 DEVOPS-005** — execute ADMIRALBET explorer on a qualifying external host.
2. **#62 BOOK-013** — interpret the actual ADMIRALBET result; PR #68 remains pending until this evidence exists.
3. **#63 BOOK-014** — revalidate SISAL if fewer than two feasible candidates exist.
4. **#64 BOOK-015** — revalidate BET365 if still fewer than two feasible candidates exist.

Interactive feasibility requires:
`event → competition/time context → full-match total-corners market → exact numeric line → requested side → displayed odds`.

Feasibility does not require exploratory outcome activation. Selected-state verification remains a later restricted implementation/support gate.

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
- live validation is controlled, sanitized, and non-CI;
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
- HTTP/webhook or clipboard/application ingestion;
- richer notification provenance and privacy-preserving diagnostics;
- macOS/Linux packaging after platform-specific distribution review.
