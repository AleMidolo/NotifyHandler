# NotifyHandler roadmap

## Milestone status summary

- **Milestones 0–5: complete for the local-preview MVP.** The repository can build, test, package, and smoke-test an unsigned Windows x64 desktop preview with deterministic synthetic browser coverage.
- **Production readiness is not complete.** SISAL and BET365 are still `Testable`, not live `Supported`, and Windows production signing is not yet implemented.
- **Current milestone: Milestone 6 — Initial live bookmaker readiness.**
- **Next release milestone: Milestone 7 — Signed Windows production release readiness.**

## Milestone 0 — Product and safety baseline — COMPLETE

**Goal:** establish the repository as the authoritative source of truth.

Delivered:
- product requirements, workflow, safety boundaries, notification and selection-target specs;
- autonomous-agent coordination rules;
- prioritized backlog and GitHub issues;
- explicit transaction boundary: prepare selections only, never place bets;
- automatic-start requirement: valid notification receipt proceeds directly to deterministic primary-pair resolution and two-leg startup without a user confirmation gate.

## Milestone 1 — Architecture and shared contracts — COMPLETE

**Goal:** choose the deployment/runtime model and define stable shared contracts.

Delivered:
- local-first desktop/Electron-style architecture and ADRs;
- parser/domain/execution-plan interfaces;
- bookmaker adapter and restricted browser capability contracts;
- independent two-leg execution state machine;
- browser/session isolation;
- deterministic matching and odds policy;
- automatic primary-recommendation resolution and immediate-start semantics;
- local/mock test strategy.

## Milestone 2 — Notification/domain foundation — COMPLETE

**Goal:** transform a surebet notification into a deterministic, automatically executable two-leg plan.

Delivered:
- normalized domain types and parser;
- validation/structured errors;
- recommendation-order preservation and deterministic first-recommendation resolution;
- two-bookmaker invariant and exactly two immutable targets;
- sanitized fixtures and unit tests.

## Milestone 3 — Fixture-backed two-bookmaker preparation path — COMPLETE

**Goal:** prove safe selection preparation for the initial SISAL + BET365 pair in a controlled deterministic browser environment.

Delivered:
- SISAL and BET365 adapters behind the shared restricted contract;
- event/market/line/outcome matching with safe failure;
- displayed-odds capture/change handling;
- isolated Playwright Chromium worker;
- deterministic browser fixtures and negative regressions;
- manual-login interruption, cancellation, attempt revocation, and post-selection verification behavior.

**Important:** completion of this milestone establishes `Testable`, not live `Supported`, bookmaker status.

## Milestone 4 — Application orchestration and UX — COMPLETE

**Goal:** provide the automatic user-facing workflow from notification receipt to manual handoff.

Delivered:
- notification intake that starts processing automatically;
- deterministic primary-recommendation resolution;
- whole-plan preflight and automatic concurrent leg dispatch;
- non-blocking normalized/target display;
- independent per-leg status and recovery actions;
- auth-required, odds-changed, retry/reopen/cancel/restart, partial-failure, and ready-for-user states;
- desktop shell with narrow typed IPC;
- notification-to-plan/worker-start latency instrumentation.

## Milestone 5 — Integration, security, and local-preview release readiness — COMPLETE

**Goal:** harden the product for repeatable local-preview use/distribution.

Delivered/verified:
- cross-component parser/application/worker/adapter regression coverage;
- threat model, renderer/browser isolation, navigation hardening, and transaction-boundary tests;
- pinned reproducible development/runtime dependencies and CI;
- deterministic Chromium browser E2E and Electron desktop smoke coverage;
- reproducible **unsigned Windows x64 portable preview** packaging;
- packaged-app verification, sensitive-content checks, CycloneDX SBOM, SHA-256 records, artifact provenance, and rollback policy;
- post-merge `main` CI green on the DEVOPS-002 merge revision.

Exit decision (2026-09-14): **Milestone 5 is complete for the local-preview channel.** It does not authorize a production release. `docs/release.md` remains authoritative: production requires signed Windows artifacts and at least the release's bookmaker/market scopes to be explicitly `Supported`, not merely fixture-backed `Testable`.

## Milestone 6 — Initial live bookmaker readiness — CURRENT

**Goal:** turn the first fixture-backed pair into an evidence-backed narrowly scoped live-supported product path using only permitted normal-browser interaction.

Planned work:
- **#43 BOOK-007:** validate/implement live SISAL mapping for pre-match football total-corners selection preparation;
- **#44 BOOK-008:** validate/implement live BET365 Italy mapping for the same narrow scope;
- **#45 QA-002:** qualify the combined SISAL + BET365 automatic path and certify support status.

Rules:
- no CAPTCHA/login/anti-bot/rate-limit/geo/access-control bypass;
- no protected/private API reverse engineering;
- no credentials/MFA automation, stake entry, or wager submission;
- live validation is controlled and non-CI; deterministic sanitized fixtures remain the automated regression source;
- if sufficient deterministic evidence cannot be obtained safely, mark the affected scope `Blocked` rather than weakening matching.

Exit criteria:
- SISAL and BET365 are each documented either as narrowly scoped `Supported` or explicitly `Blocked` with evidence;
- if both are `Supported`, a representative SISAL + BET365 notification passes the documented automatic preparation smoke path without stake entry or wager submission;
- deterministic regression, browser E2E, security, and transaction-boundary gates remain green;
- support scope and failure behavior are release-documentation ready.

## Milestone 7 — Signed Windows production release readiness — NEXT AFTER MILESTONE 6

**Goal:** produce a traceable signed Windows x64 production release candidate after the initial bookmaker pair is live-supported.

Planned work:
- **#46 DEVOPS-003:** implement controlled Authenticode signing, exact-tag release gating, automated signature verification, production release metadata, and rollback validation.

Exit criteria:
- the release's bookmaker/market scopes are still `Supported`;
- production artifact is signed and publisher identity is automatically verified;
- all exact-tag build/test/audit/browser/security/package/SBOM/checksum/provenance gates pass;
- unsigned preview artifacts remain clearly separate from production artifacts;
- manual authentication, stake entry, review, and final wager submission boundaries remain intact.

## Later expansion

After Milestones 6–7 are stable, prioritize based on product evidence:
- Telegram ingestion;
- HTTP/webhook or clipboard/application ingestion;
- additional bookmaker adapters (LOTTOMATICA, EPLAY24, ADMIRALBET, then others);
- richer notification formats/provenance, including an explicit source-provided primary recommendation marker;
- observability/latency diagnostics that preserve privacy;
- macOS/Linux packaging only after their signing/sandbox distribution models are reviewed.

Transport integrations must remain decoupled from the parser/domain model and feed the same automatic execution path.
