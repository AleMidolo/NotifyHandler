# NotifyHandler

NotifyHandler prepares the two bookmaker selections described by a surebet notification while keeping authentication, stake entry, review, and final bet submission under manual user control.

## Product goal

Given a structured or textual surebet notification, NotifyHandler should:

1. parse the event, competition, date/time, market, outcomes, bookmaker offers, expected odds, deep links, and recommended paired options;
2. show the normalized interpretation to the user before any browser action;
3. let the user choose one recommended paired option;
4. open the two bookmaker pages independently;
5. locate and verify the requested event, market, exact line, and outcome for each leg;
6. compare displayed odds with the expected odds from the notification;
7. activate the requested selection only when every required identity dimension is positively matched under the shared deterministic policy;
8. stop safely rather than guess when evidence is mismatched, ambiguous, unavailable, or stale;
9. hand control to the user with the prepared selections.

NotifyHandler must never enter credentials, automate MFA/CAPTCHA, enter stakes, or submit bets.

## MVP scope

The MVP focuses on deterministic notification parsing, a transport-independent domain model, explicit execution planning, two-leg state tracking, bookmaker adapters, safe browser selection, odds-change reporting, and manual-user handoff.

Initial bookmaker candidates are SISAL, BET365, LOTTOMATICA, EPLAY24, and ADMIRALBET. Support is added incrementally through the shared adapter contract.

## Architecture baseline

The accepted MVP runtime is a local-first desktop application with a TypeScript/Node.js core and a browser-automation worker using Playwright-controlled headed Chromium. Bookmaker sessions are isolated from the application UI and from the user's everyday browser profile; manual login and final transaction actions remain user-controlled.

Selection authorization is predicate-based, not a fuzzy confidence score. Event, market/context, exact numeric line, outcome, current origin, odds state, attempt freshness, and cancellation state are independently gated.

See `docs/architecture.md` and `docs/adr/0001-local-desktop-playwright-runtime.md` for the accepted runtime decision and tradeoffs.

## Source of truth

Repository documentation and specifications are authoritative. Start with:

- `AGENTS.md` — autonomous team roles and coordination rules;
- `roadmap.md` — milestones and sequencing;
- `backlog.md` — prioritized work;
- `docs/product-requirements.md` — product requirements and acceptance criteria;
- `docs/architecture.md` — accepted runtime, component boundaries, trust boundaries, and normative contract map;
- `docs/adr/0001-local-desktop-playwright-runtime.md` — deployment/runtime architecture decision record;
- `docs/workflow.md` — end-to-end user/application workflow;
- `docs/safety-boundaries.md` — non-negotiable authentication, access, and transaction boundaries;
- `docs/error-model.md` — interruptions, safe failures, activation disposition, and recovery semantics;
- `docs/test-strategy.md` — shared unit/contract/browser/security/release test strategy;
- `docs/bookmaker-support.md` — bookmaker rollout and support status;
- `specs/notification-format.md` — input/normalization contract;
- `specs/selection-target.md` — immutable target for one bookmaker leg;
- `specs/execution-contract.md` — exact two-leg state machine, attempts, evidence epochs, and commands;
- `specs/bookmaker-adapter-contract.md` — worker/adapter interface and restricted browser/selection capability boundary;
- `specs/matching-policy.md` — deterministic matching evidence, exact-line rules, and odds-change policy.

## Development principle

Correctness is more important than clicking something. When event, market, line, side, origin, odds state, or freshness requirements are not satisfied, the system must fail or pause safely instead of selecting a candidate.
