# NotifyHandler roadmap

## Milestone 0 — Product and safety baseline

**Goal:** establish the repository as the authoritative source of truth.

Deliverables:
- product requirements, workflow, safety boundaries, notification and selection-target specs;
- autonomous-agent coordination rules;
- prioritized backlog and initial GitHub issues;
- explicit transaction boundary: prepare selections only, never place bets.

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
- deterministic confidence/matching policy and odds-comparison policy;
- testability strategy using local/mock fixtures.

Exit criteria:
- downstream engineers can implement against explicit interfaces;
- safety boundary is enforceable by design;
- initial bookmaker integration can be tested without live betting actions.

## Milestone 2 — Notification/domain foundation

**Goal:** transform a surebet notification into a deterministic, validated execution plan.

Deliverables:
- normalized domain types;
- parser for the documented notification format;
- validation and explicit parse errors;
- recommended paired-option extraction;
- sanitized fixture corpus and unit tests;
- conversion to two `SelectionTarget` legs.

Exit criteria:
- representative valid notifications parse deterministically;
- malformed/ambiguous inputs fail explicitly;
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

**Goal:** provide the user-facing workflow from pasted notification to manual handoff.

Deliverables:
- notification input and parsed preview;
- recommended-option selector;
- execution summary before browser actions;
- independent per-leg status display;
- odds-changed, login-required, retry/reopen/cancel/restart states;
- explicit ready-for-user handoff.

Exit criteria:
- the user can understand exactly what will be prepared before execution;
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
- installation and execution are reproducible.

## Post-MVP

Potential extensions after the MVP is stable:
- additional bookmaker adapters (LOTTOMATICA, EPLAY24, ADMIRALBET and others approved by backlog);
- Telegram ingestion;
- HTTP/webhook ingestion;
- clipboard/application integrations;
- richer notification formats and provenance tracking;
- observability and diagnostics that preserve privacy.

Transport integrations must remain decoupled from the core parser/domain model.
