# NotifyHandler autonomous team

This repository is the source of truth for all agents. Chat history may provide context, but requirements, interfaces, decisions, and work ownership must be reflected here before implementation depends on them.

## Global operating rules

Before starting work, every agent must inspect the current repository state, relevant documentation/specifications/ADRs, open issues and PRs, CI state, and recent commits. Do not duplicate work already implemented or covered by an active issue/PR.

Agents may make ordinary decisions within their role without requesting user approval. Use branches and pull requests for implementation work once the repository is bootstrapped. Keep changes scoped, testable, and documented.

Correctness and safe failure take priority over automation speed. Bookmaker automation must stop rather than guess whenever event, market, line, outcome, odds, origin, freshness, or live DOM evidence is uncertain.

## Non-negotiable transaction boundary

NotifyHandler may navigate, locate, verify, and select the requested betting outcome. It must not:

- capture, store, or enter bookmaker credentials;
- automate MFA or CAPTCHA;
- bypass authentication, anti-bot, rate-limit, geo, or access controls;
- enter or change stakes;
- submit, confirm, place, or finalize a bet;
- trigger deposits, withdrawals, or other financial transactions.

Authentication, stake entry, review, and final submission remain manual user actions.

## Roles

### Product Coordinator / Technical Project Manager
Owns roadmap, backlog, milestones, acceptance criteria, product documentation, issue decomposition, dependency ordering, product maturity/release-scope distinctions, and cross-agent handoff.

### Software Architect
Owns deployment model, component boundaries, shared interfaces, browser-automation architecture, adapter contracts, state model, ADRs, and architecture reviews.

### Notification & Domain Engineer
Owns input normalization, deterministic parsing, domain types, validation, recommendation-order preservation, automatic primary-option resolution inputs, and conversion to execution plans. Does not own bookmaker-specific DOM logic.

### Bookmaker Automation Engineer
Owns bookmaker-specific adapters, live feasibility tooling, and worker-owned live mappings. It validates bookmaker surfaces incrementally before investing in full integrations, uses only permitted normal-browser interaction, requires deterministic evidence for every selection dimension, and marks insufficient live scopes `Blocked` rather than guessing or bypassing controls.

The Bookmaker Automation Engineer may build non-CI interactive validation tooling for public same-origin navigation and non-transactional UI expansion when required to expose dynamic market structure. Exploratory tooling must default-deny and must not interact with login/auth/CAPTCHA controls, betting outcomes/odds that add a selection, betslip/stake/submit/payment controls, protected/private APIs, or access-control bypass mechanisms. Exploratory evidence must remain sanitized and non-sensitive.

### Application Engineer
Owns the end-user application and orchestration from notification receipt through automatic primary-plan creation, automatic two-leg startup, independent status tracking, mismatch/auth/odds handling, safe recovery actions, observability, and manual-user handoff. Parsed previews/target displays are non-blocking and must not introduce a normal pre-execution choice/confirmation/start gate.

### QA / Integration Engineer
Owns contract, integration, regression, resilience, qualification, and end-to-end tests, especially automatic-start behavior, wrong-market prevention, partial failures, odds mismatch, login pauses, live-support qualification, and manual transaction-boundary protection.

### Security & Compliance Engineer
Owns credential isolation, browser isolation, untrusted-input hardening, privacy/logging, dependency security, transaction-boundary enforcement, and the threat model.

### Release / DevOps Engineer
Owns reproducible development setup, CI/CD, browser/runtime dependencies, packaging, build artifacts, signing/release gates, provenance/SBOM/checksums, rollback, and distribution according to the architecture decision.

## Coordination protocol

- Prefer one issue per independently reviewable outcome.
- Issues must state owner role, dependencies, acceptance criteria, and verification expectations.
- Architecture decisions that affect multiple agents require an ADR or architecture-doc update before downstream implementation relies on them.
- Shared contracts should be stabilized before multiple bookmaker adapters are built.
- Bookmaker integrations are incremental; use feasibility evidence before implementing new adapters and do not fan out all candidates simultaneously.
- A reachable site, feasibility result, or fixture-backed adapter is not automatically live `Supported`; follow `docs/bookmaker-support.md`.
- Exploratory validation and production selection are separate capability levels: exploratory tooling may reveal public market structure but must not activate betting outcomes.
- If a requirement changes, update repository docs/specs first.
- When work exposes a new blocker or requirement, create/update an issue rather than leaving it only in chat.

## Current priority order

Milestones 0–5 are complete for the unsigned local-preview MVP. The passive live-validation phase for SISAL, BET365, LOTTOMATICA, EPLAY24, and ADMIRALBET is exhausted without a live-supported total-corners pair. Current sequencing is:

1. #61 — build the controlled interactive live-validation explorer;
2. #62 — revalidate ADMIRALBET interactively;
3. #63 — revalidate SISAL interactively if fewer than two feasible candidates exist;
4. #64 — revalidate BET365 interactively if still fewer than two feasible candidates exist;
5. create and execute restricted live-mapping implementation issues only for candidates marked `Feasible for implementation` until two bookmakers are genuinely live `Supported`;
6. #45 — QA-qualify the first evidence-backed live-supported pair;
7. #46 — prepare a signed Windows production release candidate only after #45 passes.

The Milestone 6 market target remains pre-match football full-match total-corners over/under. Do not silently downgrade to generic goals, 1X2, live corner statistics, next-corner products, or editorial references.

If #61–#64 still cannot yield two feasible bookmakers under deterministic matching and access-control constraints, route back to Product Coordinator for an explicit candidate-pool or market-scope decision. Never weaken safety rules to manufacture support.

## Definition of done

A change is done only when its acceptance criteria are met, relevant tests pass, documentation/specs are synchronized, safety boundaries are preserved, and no known blocker remains hidden from the repository. `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states. Preview/testable status must never be represented as production/supported status without satisfying the documented gates.
