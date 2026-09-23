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
Owns bookmaker-specific adapters, live feasibility tooling, and worker-owned live mappings. Uses only permitted normal-browser interaction, requires deterministic evidence for every selection dimension, and marks genuinely insufficient live scopes `Blocked` rather than guessing or bypassing controls.

It may build/use non-CI interactive validation tooling for public same-origin navigation and non-transactional UI expansion. Exploratory tooling must default-deny and must not interact with login/auth/CAPTCHA controls, betting outcomes/odds that add a selection, betslip/stake/submit/payment controls, protected/private APIs, or access-control bypass mechanisms. Exploratory evidence must remain sanitized and non-sensitive.

### Application Engineer
Owns the end-user application and orchestration from notification receipt through automatic primary-plan creation, automatic two-leg startup, independent status tracking, mismatch/auth/odds handling, safe recovery actions, observability, and manual-user handoff. Parsed previews/target displays are non-blocking and must not introduce a normal pre-execution choice/confirmation/start gate.

### QA / Integration Engineer
Owns contract, integration, regression, resilience, qualification, and end-to-end tests, especially automatic-start behavior, wrong-market prevention, partial failures, odds mismatch, login pauses, live-support qualification, and manual transaction-boundary protection.

### Security & Compliance Engineer
Owns credential isolation, browser isolation, untrusted-input hardening, privacy/logging, dependency security, transaction-boundary enforcement, and the threat model.

### Release / DevOps Engineer
Owns reproducible development setup, CI/CD, browser/runtime dependencies, packaging, build artifacts, signing/release gates, provenance/SBOM/checksums, rollback, distribution, and operational execution environments required by documented release/live-validation workflows.

## Coordination protocol

- Prefer one issue per independently reviewable outcome.
- Issues must state owner role, dependencies, acceptance criteria, and verification expectations.
- Architecture decisions that affect multiple agents require an ADR or architecture-doc update before downstream implementation relies on them.
- Shared contracts should be stabilized before multiple bookmaker adapters are built.
- Bookmaker integrations are incremental; use feasibility evidence before implementing new adapters and do not fan out all candidates simultaneously.
- A reachable site, feasibility result, or fixture-backed adapter is not automatically live `Supported`; follow `docs/bookmaker-support.md`.
- Exploratory validation and production selection are separate capability levels.
- Runner/toolchain/DNS/browser-host failures are **environment evidence**, not bookmaker evidence. They must not classify a bookmaker `Blocked` or justify weakening scope/matching.
- An unsigned alpha prerelease may be published for user application testing only when it is explicitly non-production and does not imply live bookmaker support.
- If a task is known to require an external workstation/host capability unavailable to the current autonomous container, repeated execution in the same container is not progress; preserve the blocker and do not fabricate evidence.
- Diagnostic live-validation bundles may be built/tested in CI only against synthetic/local fixtures. CI must never contact a bookmaker or perform live feasibility validation.
- If a requirement changes, update repository docs/specs first.
- When work exposes a new blocker or requirement, create/update an issue rather than leaving it only in chat.

## Current priority order

Milestones 0–5 are complete for the unsigned local-preview MVP, and downloadable alpha **`v0.0.0-alpha.1`** is published. The alpha track is complete; it is unsigned/non-production and does not imply live bookmaker support.

The generic interactive feasibility queue is now exhausted: ADMIRALBET/BOOK-013, SISAL/BOOK-014, and BET365/BOOK-015 are all **Blocked** for the narrow live full-match total-corners scope after qualifying bounded runs. SISAL and BET365 remain fixture-backed Testable.

PRODUCT-015 changes the evidence and ingestion strategy because the real surebet source supplies the exact two bookmaker legs plus direct match-page links. Keep the market target unchanged and do not resume generic homepage exploration.

### Live-readiness / ingestion track
The relay-aware v2 implementation, full-match identity propagation, and SEC-004 hardening are complete. PRODUCT-016/#109 is also complete with a target-market BET365/SISAL relay sample.

1. **#104 BOOK-016 — immediate P0.** Validate Portogallo - Galles, full-match `U/O CORNERS 6.5`, BET365 OVER @1.14 and SISAL UNDER @4.25 through the recorded `bet-up.it` relay URLs.
2. Base `Feasible for implementation` vs `Blocked` only on post-resolution bookmaker evidence: expected origin, event, competition/time, full-match total-corners, exact line, side, displayed odds.
3. If feasible, create a separate restricted live-mapping implementation issue. If the required pair remains Blocked, route to Product Coordination for candidate/scope replan.
4. **#45 QA-002** remains blocked until two bookmakers are genuinely live Supported.
5. **#46 DEVOPS-003** remains blocked until #45 passes.

Relay resolution and upstream notification content never satisfy matching predicates by themselves.

The Milestone 6 market target remains pre-match football full-match total-corners over/under. Do not silently downgrade to generic goals, 1X2, live corner statistics, next-corner products, or editorial references.

## Definition of done

A change is done only when its acceptance criteria are met, relevant tests pass, documentation/specs are synchronized, safety boundaries are preserved, and no known blocker remains hidden from the repository. `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states. Unsigned alpha/preview status and diagnostic validation bundles must never be represented as production/supported status without satisfying the documented gates.
