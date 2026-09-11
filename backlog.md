# NotifyHandler backlog

Priority levels: **P0** blocks multiple downstream agents or protects correctness/safety; **P1** is required for the MVP; **P2** is post-MVP or incremental expansion.

## Ready now

### P0 — ARCH-001: Decide deployment/runtime architecture
Owner: Software Architect

Define whether NotifyHandler is a desktop application, browser extension, local service, or another local architecture. Document the decision as an ADR, including browser automation/runtime, process boundaries, persistent state, and packaging implications.

Acceptance criteria:
- one deployment model is selected with rationale and rejected alternatives;
- component boundaries and data flow are documented;
- the design keeps authentication and final transaction actions manual;
- testability without live betting transactions is addressed.

### P0 — ARCH-002: Define execution and bookmaker-adapter contracts
Owner: Software Architect
Depends on: ARCH-001

Define normalized execution plan, two-leg state model, adapter interface, matching evidence/confidence, odds comparison, result/error model, cancellation, login-required behavior, and safe-failure semantics.

Acceptance criteria:
- downstream engineers can implement without bookmaker-specific coupling in the core;
- wrong event/market/line/outcome uncertainty cannot be represented as success;
- transaction-boundary capabilities are excluded from the adapter contract.

### P0 — DOMAIN-001: Implement normalized surebet domain model and parser
Owner: Notification & Domain Engineer
Depends on: ARCH-002 contracts or an explicitly stable parser contract

Implement deterministic parsing and validation for the initial notification specification and produce two `SelectionTarget` legs from a chosen recommended pair.

Acceptance criteria:
- representative notifications parse into normalized data;
- recommended pair references resolve to exactly two legs;
- malformed/ambiguous values produce explicit errors;
- sanitized fixtures and unit tests cover valid and invalid cases.

## Next after architecture/contracts

### P1 — BOOK-001: Implement first bookmaker adapter
Owner: Bookmaker Automation Engineer
Depends on: ARCH-002

Implement the highest-priority technically feasible bookmaker adapter, initially targeting SISAL unless architecture/feasibility work identifies a better first candidate.

Acceptance criteria:
- event, market, line, and side/outcome are independently verified;
- displayed odds are captured and compared with expected odds;
- uncertainty fails safely without selecting;
- login-required state is returned rather than credentials being automated;
- deterministic local/mock tests cover success and near-match failures.

### P1 — BOOK-002: Implement second bookmaker adapter
Owner: Bookmaker Automation Engineer
Depends on: ARCH-002, lessons from BOOK-001

Implement the second adapter, initially targeting BET365 if technically feasible and permitted.

Acceptance criteria: same safety/matching contract as BOOK-001 plus shared contract tests demonstrating interchangeable adapter behavior.

### P1 — APP-001: Build parsed-preview and option-selection workflow
Owner: Application Engineer
Depends on: DOMAIN-001, ARCH-002

Acceptance criteria:
- user can supply notification text;
- normalized interpretation is shown before execution;
- user can choose a recommended pair;
- exact two-leg execution summary is shown before browser actions;
- invalid input cannot start execution.

### P1 — APP-002: Implement two-leg orchestration and manual handoff
Owner: Application Engineer
Depends on: APP-001, at least one adapter test double, ARCH-002

Acceptance criteria:
- two legs have independent states;
- partial failure is explicit;
- login-required, odds-changed, retry/reopen/cancel/restart and ready-for-user states are represented;
- orchestration never enters stakes or submits bets.

### P1 — QA-001: Establish contract/integration safety suite
Owner: QA / Integration Engineer
Depends on: ARCH-002, DOMAIN-001 and test doubles

Cover parser-to-plan integration, adapter contract behavior, wrong-event/market/line/outcome regressions, odds mismatch, login pause, partial failures, cancellation, and transaction-boundary enforcement.

### P1 — SEC-001: Threat model and browser/security hardening
Owner: Security & Compliance Engineer
Depends on: ARCH-001

Document threats and controls for credentials, sessions, untrusted notification data, navigation targets, browser isolation, logging/privacy, dependencies, and transaction-boundary enforcement.

### P1 — DEVOPS-001: Reproducible development and CI baseline
Owner: Release / DevOps Engineer
Depends on: ARCH-001 and initial project scaffold

Establish dependency installation, build, lint/test workflow, browser runtime dependencies if required, and CI checks appropriate to the selected architecture.

## Later / expansion

### P2 — BOOK-003+: Additional bookmaker adapters
Owner: Bookmaker Automation Engineer

Add LOTTOMATICA, EPLAY24, ADMIRALBET, then additional bookmakers only after shared contracts and regression suites are stable.

### P2 — INPUT-001: Additional notification transports
Owner: Application Engineer / Notification & Domain Engineer

Add Telegram, HTTP/webhook, clipboard monitoring, or other ingestion adapters without coupling transport code to parsing/domain logic.

## Product constraints applying to every backlog item

- Correctness is more important than completing a click.
- Never guess event, market, line, side, or outcome identity.
- Never automate bookmaker credentials, MFA, CAPTCHA, stakes, or bet submission.
- Do not bypass access controls, anti-bot measures, rate limits, or geo restrictions.
- Keep expected and observed odds distinct and surface changes explicitly.
- Repository docs/specs override stale chat context.
