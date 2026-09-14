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
Owns bookmaker-specific adapters, live feasibility probes, and worker-owned live mappings. It validates bookmaker surfaces incrementally before investing in full integrations, uses only permitted normal-browser interaction, requires deterministic evidence for every selection dimension, and marks insufficient live scopes `Blocked` rather than guessing or bypassing controls.

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
- If a requirement changes, update repository docs/specs first.
- When work exposes a new blocker or requirement, create/update an issue rather than leaving it only in chat.

## Current priority order

Milestones 0–5 are complete for the unsigned local-preview MVP. SISAL and BET365 have completed live validation but are `Blocked` for the current pre-match football total-corners live scope. Current sequencing is:

1. #52 — validate LOTTOMATICA live feasibility;
2. #53 — validate EPLAY24 live feasibility if fewer than two viable candidates exist;
3. #54 — validate ADMIRALBET live feasibility if fewer than two viable candidates exist after #53;
4. create and execute restricted implementation issues for the first feasible candidates until two bookmakers are genuinely live `Supported`;
5. #45 — QA-qualify the first evidence-backed live-supported pair;
6. #46 — prepare a signed Windows production release candidate only after #45 passes.

If the remaining candidate list cannot yield two supported bookmakers under deterministic matching and access-control constraints, route back to Product Coordinator for a new product-scope decision. Never weaken safety rules to manufacture support.

## Definition of done

A change is done only when its acceptance criteria are met, relevant tests pass, documentation/specs are synchronized, safety boundaries are preserved, and no known blocker remains hidden from the repository. `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states. Preview/testable status must never be represented as production/supported status without satisfying the documented gates.
