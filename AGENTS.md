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

The ADMIRALBET interactive feasibility track is complete: BOOK-013/#62 was merged via PR #68 and is **Blocked at interactive feasibility** for the narrow full-match total-corners scope. No production mapping was authorized.

The SISAL diagnostic packaging track is also complete: DEVOPS-008/#88 published **`book012-sisal-diagnostic-v1`** from exact `main` commit `f77f99013b6fa4d65b6cab944af34b9d446e73c9`. The ZIP SHA-256 is `03d053426b75711aab730d7eeb01b29db88e0d62b0643c768556dd30c9b89439`.

### Live-readiness track
BOOK-014/#63 is complete and SISAL remains **Blocked at interactive live feasibility** for the narrow full-match total-corners scope.

DEVOPS-011/#97 is complete: a qualifying non-CI Windows workstation produced the sanitized BET365 BOOK-012 result. The result exhausted the fixed 10-action budget, produced 11 snapshots, reached multiple football competition pages, ended at `/hub/it-it/football/football-competitions/bundesliga`, and keeps `authorizesProductionMapping: false`; it is evidence to interpret, not a support decision.

1. **#64 BOOK-015 — immediate P0.** Interpret the actual BET365 explorer result against the deterministic event/competition-time/full-match-total-corners/exact-line/side/odds chain.
2. If BET365 is `Feasible for implementation`, create/execute a restricted live-mapping issue reusing the fixture-backed adapter.
3. If BET365 is also `Blocked`, route to **Product Coordinator / Technical Project Manager** for an explicit Milestone 6 replan. Do not weaken matching, guess selectors, increase the bounded explorer to force support, or silently change scope.
4. **#45 QA-002** remains blocked until two bookmakers are genuinely live `Supported`.
5. **#46 DEVOPS-003** remains blocked until #45 passes.

The Milestone 6 market target remains pre-match football full-match total-corners over/under. Do not silently downgrade to generic goals, 1X2, live corner statistics, next-corner products, or editorial references.

## Definition of done

A change is done only when its acceptance criteria are met, relevant tests pass, documentation/specs are synchronized, safety boundaries are preserved, and no known blocker remains hidden from the repository. `Feasible`, fixture-backed `Testable`, live `Supported`, and `Blocked` are distinct maturity states. Unsigned alpha/preview status and diagnostic validation bundles must never be represented as production/supported status without satisfying the documented gates.
