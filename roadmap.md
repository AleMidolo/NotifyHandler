# NotifyHandler roadmap

## Milestone status summary

- **Milestones 0–5: complete for the local-preview MVP.** The repository can build, test, package, and smoke-test an unsigned Windows x64 desktop preview with deterministic synthetic browser coverage.
- **Alpha delivery track: complete.** GitHub prerelease **`v0.0.0-alpha.1`** is published from source commit `3327bc29078d0ab036453e1deaff1b7094fd29ee` with the portable Windows x64 ZIP and checksum. It is unsigned, non-production, and does not imply live bookmaker support.
- **ADMIRALBET validation track: complete for feasibility.** BOOK-013/#62 consumed the real BOOK-012 result and is `Blocked at interactive feasibility` for the narrow full-match total-corners scope.
- **SISAL portable live-validation handoff: complete.** DEVOPS-008/#88 published **`book012-sisal-diagnostic-v1`** from exact `main` commit `f77f99013b6fa4d65b6cab944af34b9d446e73c9`.
- **Production readiness is not complete.** No bookmaker currently has live `Supported` status for the target pre-match football full-match total-corners scope, and Windows production signing is not implemented.
- **Current milestone: Milestone 6 — Evidence-backed live bookmaker readiness.** PRODUCT-031/#199 and PRODUCT-032/#202 remove two unnecessary blockers: odds are informational/non-gating, and reviewed public bookmaker WebSockets may be allowed for normal rendering. ARCH-010/#200 + ARCH-011/#203 are the immediate architecture pass; PRODUCT-030/#197 remains external evidence in parallel.
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

### Target-market relay evidence — COMPLETE

**#109 PRODUCT-016 — COMPLETE**

A usable current/future full-match total-corners relay sample is recorded for:
- Portogallo - Galles;
- Nations League;
- 24/09/2026 20:45;
- `U/O CORNERS 6.5`;
- BET365 OVER @ `1.14`;
- SISAL UNDER @ `4.25`.

The corrected recommendation odds are consistent with the authoritative offer odds. The parser already accepts `CORNER(S)` aliases. The sample contains no credentials/session/auth data.

### Relay-aware BOOK-016 preparation — COMPLETE

**PR #142 — COMPLETE**

The controlled BOOK-012 explorer now accepts the reviewed relay-navigation extension, reuses the BOOK-017 resolver, preserves default-deny exploration, redacts relay identifiers, and keeps `authorizesProductionMapping: false`. Post-merge CI on `a9d07e8692a2a00bf4db1c336896bafc654e5e4c` is green.

### Relay diagnostics — COMPLETE

**#163 QA-005 — COMPLETE**

QA approved one replacement BET365 relay-aware run plus the still-unused SISAL run only behind the merged fail-closed relay preflight. Missing/malformed relay input now stops before browser/network activity.

**#161 DEVOPS-014 — COMPLETE**

Both qualified runs used relay mode and returned:
- BET365: `RELAY_INVALID / UNREVIEWED_SAME_ORIGIN_PATH`;
- SISAL: `RELAY_INVALID / UNREVIEWED_SAME_ORIGIN_PATH`;
- actions `0/10`; no bookmaker arrival; `authorizesProductionMapping: false`.

**#166 BOOK-022 — COMPLETE**

The category is precise but intentionally redacted: same `https://www.bet-up.it` origin, HTTPS, no userinfo/query/fragment, but pathname outside `/lnk/<uuid>/<bookmaker-suffix>`. The actual path template is unknown, so no evidence-backed resolver expansion exists.

### Direct bookmaker integration — BOOK-023 COMPLETE / BLOCKED

**#167 PRODUCT-026 — COMPLETE**

The upstream owner/user supplied direct BET365 and SISAL bookmaker-origin destinations for the Portogallo-Galles full-match total-corners 6.5 signal. Existing direct-link architecture accepted both origins, and PR #173 added a source-locked fail-closed BOOK-023 runner with no Betup or generic-page fallback.

**#174 DEVOPS-015 — COMPLETE**

The qualifying non-CI workstation executed both source-locked direct targets from merged source `b169832418bb9eaff348365ca1e6c8ef9b1b0d71`.

**#170 BOOK-023 — COMPLETE / BOTH CANDIDATES BLOCKED**

BET365:
- `BOOKMAKER_DIRECT`, approved origin reached;
- sanitized `/` -> `/`, `COMPLETE`, actions `0/10`;
- only a generic BET365 landing snapshot was retained;
- no Portogallo-Galles, competition/time, full-match total-corners, line 6.5, OVER, or displayed-odds evidence;
- summary SHA-256 `0AB239A1B5308826D730F18EC1FABD43A35422A633414F5ED55CF82866CF064A`.

SISAL:
- `BOOKMAKER_DIRECT` on the exact Portogallo-Galles Nations League path;
- initial event title positively binds Portogallo-Galles / Nations League;
- sampled market-navigation context includes a broad `CORNER` category family;
- no retained scheduled-time, full-match total-corners, line 6.5, UNDER, or bound displayed-odds evidence;
- fixed budget exhausted `10/10` and the run ended at `/totocalcio`;
- summary SHA-256 `8FB9B75BC66D614957CB8453B8C4D1B873C50595099DA62CFC19AFF3F34626FD`.

Neither candidate reaches `Feasible for implementation`. Both remain fixture-backed `Testable` and live `Blocked` for the narrow target scope. No restricted production selector-mapping issue is created.

### Current P0

**#175 PRODUCT-028 — READY NOW**

Replan Milestone 6 around a new evidence-backed current/future direct-link target or bookmaker pair. Preserve pre-match football full-match total-corners O/U and all deterministic identity gates unless Product explicitly changes the requirement.

Do not retry BOOK-023 with a larger budget, weaker matching, Betup fallback, generic homepage discovery, protected/private APIs, or transaction-capable exploration.

### Passive direct-page evidence replan — BOOK-024 COMPLETE / BOOK-025 INTERPRETED

**#175 PRODUCT-028 — COMPLETE**

BOOK-023 remains valid historical evidence. The replan added a target-aware passive diagnostic without broadening interaction.

**#177 BOOK-024 — COMPLETE**

PR #181 merged the source-locked passive direct-page probe. Security/QA certified the bounded retention, exact-route preservation, non-authorizing semantics, and unchanged transaction boundary.

**#182 DEVOPS-016 — COMPLETE**

Exactly one qualified non-CI passive diagnostic was executed for each bookmaker.

BET365:
- exact direct route and SPA fragment preserved;
- `BLOCKED / PRIVATE_OR_INTERNAL_DESTINATION`;
- no target evidence retained;
- SHA-256 `90BDFECF70C0044E67DCFED4563A5A198141A15B0F30745DB75B5AAE4417F3F4`;
- `authorizesProductionMapping: false`.

SISAL:
- exact Portogallo-Galles event route preserved;
- `COMPLETE`;
- every passive target evidence signal false;
- `displayedOddsCandidates: []`;
- `requiredChainObserved: false`;
- SHA-256 `C2B016EAAD34A48B110E0B849A9D1598693B5CFE4B720090FEA1842F7948E494`;
- `authorizesProductionMapping: false`.

**#183 BOOK-025 — COMPLETE**

Interpretation:

- BET365's `PRIVATE_OR_INTERNAL_DESTINATION` is an ambiguous **diagnostic network-boundary category**, not bookmaker matching/support evidence. The current probe uses the same reason for any WebSocket attempt, an HTTPS target failing public-DNS validation, or another disallowed protocol. The retained summary does not identify which fired.
- SISAL route preservation proves navigation only. BOOK-024 samples bounded visible text; zero observed signals mean no target pattern was visible at the fixed measurement point. The summary cannot distinguish absent/unhydrated DOM from hidden/non-visible content or another render state.

Neither candidate reaches `Feasible for implementation`.

### Current P0

**#184 ARCH-008 — COMPLETE via PR #187**

ADR-0006 and `passive-provenance.v1` define the finite redacted transport/render-state provenance contract. Architecture changes observability only and authorizes no live run.

**#188 BOOK-026 — COMPLETE via PR #191**

The source-locked passive probe implements `passive-provenance.v1` with first-trigger-only transport provenance, bounded render-state booleans/readiness/title predicates, fixed DOM population buckets, and explicit retained-summary validation.

**#186 SEC-008 — COMPLETE**

Security approved the finite redacted provenance implementation without changing the fail-closed network or transaction boundary.

**#189 QA-007 — COMPLETE**

QA certified the deterministic/browser/privacy gates and authorized the separately scoped one-shot DEVOPS-017 execution.

**#192 DEVOPS-017 — COMPLETE**

Qualified retained evidence:
- BET365: `BLOCKED / WEBSOCKET_ATTEMPT / SOCKET`, exact fragment route preserved, no render/target evidence, SHA-256 `9C1CDEDB8460B642011928B9D70394F1FE2A176D1F50DEEF9C57522D947B89D4`.
- SISAL: `COMPLETE / CLEAR`, exact event route preserved, DOMContentLoaded confirmed, title participant-pair/competition predicates true, `POPULATED` DOM, required chain false, SHA-256 `B6AE576E657BCAC2417F899F8EE6B2576DD7512C3DA4C65C2BC6FA0583E21455`.

**#193 BOOK-027 — COMPLETE**

Interpretation:
- BET365 provenance proves only that a WebSocket attempt was blocked under the current policy. It supplies no destination, render, matching, feasibility, or support evidence.
- SISAL is not an empty shell, but the reviewed DOM lacks participant/time/corners/full-match/line/side/odds target predicates. The positive competition/date snippets are unrelated content and cannot satisfy target matching.

Neither candidate reaches `Feasible for implementation`.

### Current P0 — odds boundary correction + live-readiness

**#199 PRODUCT-031 — REQUIREMENT ACCEPTED / IMPLEMENTATION OPEN**

NotifyHandler's responsibility is selection preparation only. Odds are informational: a changed, missing or unreadable price does not invalidate an otherwise exact event/market/period/line/side selection and does not require acknowledgement. The application does not calculate surebet validity, ROI, profitability, stakes, or price acceptability.

**#200 ARCH-010 — COMPLETE via PR #205**

Odds are optional informational metadata and no longer participate in selection authorization.

**#196 ARCH-009 — SUPERSEDED / CLOSED**

The product no longer wants unconditional WebSocket denial.

**#203 ARCH-011 — COMPLETE via PR #205**

Bounded bookmaker-scoped public `wss://` page transport is accepted behind version-controlled host policy, public-DNS/private-network checks, payload opacity, and default-deny behavior.

**#206 DOMAIN-003 — COMPLETE via PR #214**

SelectionTarget/structured-v2 price is optional informational metadata and frozen structured-v1 compatibility is preserved.

**#209 BOOK-029 — COMPLETE via PR #219**

The browser gateway now has default-deny bookmaker-scoped WSS policy plus passive-provenance.v2. The live SISAL/BET365 rule registry remains empty, relay WSS remains blocked, and no live bookmaker run or guessed hostname is included.

**#207 APP-008 — COMPLETE via PR #216**

Changed-price state/UI and acknowledgement commands are removed.

**#208 BOOK-028 — COMPLETE via PR #218**

Price gating is removed from adapters/SelectionActivationGate while exact identity and selected-state verification remain mandatory.

**#211 SEC-009 + #212 QA-008 — COMPLETE via PR #220**

The integrated non-gating-odds and bounded-WSS implementation is security-hardened and QA-certified.

**#221 BOOK-031 — IMPLEMENTATION IN PR #225**

Implement the approved source-locked BET365 first-WSS hostname observer without a live bookmaker run.

**#222 SEC-010 -> #223 QA-009 -> #224 DEVOPS-018 — CONTROLLED OBSERVATION GATES**

Review and certify the exact observer head, then permit at most one qualifying non-CI hostname observation.

**#210 BOOK-030 — EVIDENCE/RULE INTERPRETATION**

If DEVOPS-018 yields a valid sanitized artifact, record the canonical hostname and propose the narrowest exact-host rule. A single observation cannot justify suffix expansion, and no BET365 render re-test occurs before separate Security/QA rule approval.

**#197 PRODUCT-030 — PARALLEL EXTERNAL EVIDENCE**

Source a fresh current/future full-match total-corners direct-link target when available. Stable odds are not required; identity + direct URL are the evidence inputs.


### Implementation and qualification

For each candidate marked `Feasible for implementation`:
- create a dedicated live-mapping implementation issue;
- reuse/implement the adapter behind restricted browser/selection contracts;
- add sanitized deterministic fixtures learned from permitted live structure;
- preserve exact origin/event/market/period/line/side/freshness/cancellation/auth gates; optional odds telemetry remains non-gating;
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
