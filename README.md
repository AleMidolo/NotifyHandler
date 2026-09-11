# NotifyHandler

NotifyHandler prepares the two bookmaker selections described by a surebet notification while keeping authentication, stake entry, review, and final bet submission under manual user control.

## Product goal

Given a structured or textual surebet notification, NotifyHandler should:

1. parse the event, competition, date/time, market, outcomes, bookmaker offers, expected odds, deep links, and recommended paired options;
2. show the normalized interpretation to the user before any browser action;
3. let the user choose one recommended paired option;
4. open the two bookmaker pages independently;
5. locate and verify the requested event, market, line, and outcome for each leg;
6. compare displayed odds with the expected odds from the notification;
7. select the outcome only when matching confidence is sufficient;
8. stop safely and report an explicit mismatch when confidence is insufficient;
9. hand control to the user with the prepared selections.

NotifyHandler must never enter credentials, automate MFA/CAPTCHA, enter stakes, or submit bets.

## MVP scope

The MVP focuses on deterministic notification parsing, a transport-independent domain model, explicit execution planning, two-leg state tracking, bookmaker adapters, safe browser selection, odds-change reporting, and manual-user handoff.

Initial bookmaker candidates are SISAL, BET365, LOTTOMATICA, EPLAY24, and ADMIRALBET. Support is added incrementally through the shared adapter contract.

## Source of truth

Repository documentation and specifications are authoritative. Start with:

- `AGENTS.md` — autonomous team roles and coordination rules;
- `roadmap.md` — milestones and sequencing;
- `backlog.md` — prioritized work;
- `docs/product-requirements.md` — product requirements and acceptance criteria;
- `docs/workflow.md` — end-to-end user/application workflow;
- `docs/safety-boundaries.md` — non-negotiable safety and transaction boundaries;
- `docs/bookmaker-support.md` — bookmaker rollout and support status;
- `specs/notification-format.md` — input/normalization contract;
- `specs/selection-target.md` — deterministic target passed to bookmaker adapters.

## Development principle

Correctness is more important than clicking something. When event, market, line, side, or outcome identity is uncertain, the system must fail safely instead of selecting a candidate.
