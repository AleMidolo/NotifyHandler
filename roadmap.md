# NotifyHandler roadmap

## Milestone 0 — Product and safety baseline

**Goal:** establish the repository as the authoritative source of truth.

Deliverables:
- product requirements, workflow, safety boundaries, notification and selection-target specs;
- autonomous-agent coordination rules;
- prioritized backlog and initial GitHub issues;
- explicit transaction boundary: prepare selections only, never place bets;
- explicit automatic-start requirement: valid notification receipt proceeds directly to deterministic primary-pair resolution and two-leg startup without a user confirmation gate.

Exit criteria:
- foundational documents exist and agree on scope;
- first architecture task is actionable without further product clarification.

## Milestone 1 — Architecture and shared contracts

**Goal:** choose the deployment/runtime model and define stable contracts before feature implementation fans out.

Deliverables:
- architecture document and ADR for the deployment model;
- parser/domain/execution-plan interfaces;
- bookmaker adapter interface and result/error model;
- independent two-leg execution state machine;
- browser/session isolation approach;
- deterministic matching policy and odds-comparison policy;
- automatic primary-recommendation resolution and immediate-start semantics;
- testability strategy using local/mock fixtures.

Exit criteria:
- downstream engineers can implement against explicit interfaces;
- no architecture contract requires parsed-preview acknowledgement, recommended-pair selection, or a manual start command for a valid notification;
- safety boundary is enforceable by design;
- initial bookmaker integration can be tested without live betting actions.

## Milestone 2 — Notification/domain foundation

**Goal:** transform a surebet notification into a deterministic, automatically executable two-leg plan.

Deliverables:
- normalized domain types;
- parser for the documented notification format;
- validation and explicit parse errors;
- recommendation-order preservation;
- deterministic primary recommendation resolution from the first recommendation in source order;
- sanitized fixture corpus and unit tests;
- conversion to two `SelectionTarget` legs without user pair selection.

Exit criteria:
- representative valid notifications parse deterministically;
- the primary recommendation resolves automatically to exactly two distinct bookmaker legs;
- malformed/ambiguous inputs fail explicitly before navigation;
- no bookmaker DOM knowledge leaks into the parser.

## Milestone 3 — First end-to-end bookmaker preparation path

**Goal:** prove safe outcome preparation for one supported bookmaker pair.

Deliverables:
- first bookmaker adapter implementation;
- second bookmaker adapter implementation;
- event/market/line/outcome matching with safe failure;
- displayed-odds capture and mismatch reporting;
- local/mock browser fixtures covering positive and negative cases;
- manual-login pause/resume behavior where applicable.

Recommended initial pair: SISAL + BET365, subject to the Software Architect confirming technical feasibility and permitted access methods.

Exit criteria:
- both legs can be prepared in a test/sanitized environment;
- uncertain matches never result in a selection;
- the adapters never cross the manual transaction boundary.

## Milestone 4 — Application orchestration and UX

**Goal:** provide the automatic user-facing workflow from notification receipt to manual handoff.

Deliverables:
- notification intake that triggers processing automatically;
- non-blocking parsed/normalized status display;
- automatic primary-recommendation resolution;
- immediate creation/start of the exact two-leg plan without preview acknowledgement or pair selection;
- independent per-leg status display;
- notification-to-browser-open latency instrumentation;
- odds-changed, login-required, retry/reopen/cancel/restart states;
- explicit ready-for-user handoff.

Exit criteria:
- a valid notification starts both legs without asking the user to review, choose a pair, confirm, or press start;
- both browser legs begin as soon as validation and safety checks permit;
- one leg can fail without obscuring the state of the other;
- every terminal state is explicit and actionable.

## Milestone 5 — Integration, security, and release readiness

**Goal:** harden the product for repeatable local use/distribution.

Deliverables:
- cross-component integration and regression suite;
- threat model and security review;
- dependency and browser-runtime hardening;
- reproducible dev environment and CI;
- packaging/distribution matching the chosen architecture;
- release checklist and smoke test.

Exit criteria:
- all release gates pass;
- safety-boundary tests are automated;
- automatic-start behavior is covered by integration tests;
- installation and execution are reproducible.

## Post-MVP

Potential extensions after the MVP is stable:
- additional bookmaker adapters (LOTTOMATICA, EPLAY24, ADMIRALBET and others approved by backlog);
- Telegram ingestion;
- HTTP/webhook ingestion;
- clipboard/application integrations;
- richer notification formats and provenance tracking, including an explicit source-provided primary recommendation marker;
- observability and diagnostics that preserve privacy.

Transport integrations must remain decoupled from the core parser/domain model and should feed the same automatic execution path.
