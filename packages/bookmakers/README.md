# Bookmaker adapters

This workspace contains bookmaker-specific selection-preparation logic behind the accepted restricted page and `SelectionActivationGate` contracts.

The shared `BookmakerPagePort` exposes bookmaker-neutral semantic read queries. A future Playwright worker is responsible for mapping each permitted live bookmaker DOM into those semantic candidates; raw `Page`, locator, credential, stake, and transaction capabilities never cross into adapters.

## SISAL scope

`SisalAdapter` is the first deterministic adapter implementation for BOOK-001. Its current support level is **Testable**, not production/live **Supported**.

Validated scope:

- bookmaker id `sisal`;
- approved top-level origin `https://www.sisal.it`;
- pre-match football selection targets represented by the shared domain contract;
- full-match total-corners markets with an exact decimal line;
- `over` / `under` outcomes;
- event participant, competition/time context, market/context, line, side, and displayed-odds verification;
- `AUTH_REQUIRED`, `ODDS_CHANGED`, safe-failure, cancellation, selection activation-gate, and post-activation selected-state behavior;
- deterministic in-memory sanitized fixture tests only.

The future Playwright worker must map real SISAL DOM state into the semantic port and pass the same contract suite before this integration can be labeled live `Supported`. No undocumented/private API access is used.

Notification intermediary URLs such as `bet-up.it/.../sisal` are intentionally rejected by the adapter as direct navigation targets. Redirect resolution, if added, belongs to the worker navigation policy and must explicitly validate every redirect hop and final SISAL origin.

## BET365 scope

`Bet365Adapter` is the second deterministic adapter implementation tracked by BOOK-003 / #28. Its current support level is **Testable**, not production/live **Supported**.

Validated scope:

- bookmaker id `bet365`;
- approved top-level origin `https://www.bet365.it`;
- pre-match football selection targets represented by the shared domain contract;
- full-match total-corners markets with an exact decimal line;
- `over` / `under` outcomes;
- deterministic event participant plus available competition/time-context matching;
- independent market/context, exact-line, side, and displayed-odds verification;
- `AUTH_REQUIRED`, `ODDS_CHANGED`, safe-failure, cancellation, activation-gate, and post-activation selected-state behavior;
- cancellation racing an already-started final activation preserves `ATTEMPTED_NOT_VERIFIED`/manual-review semantics;
- deterministic in-memory sanitized fixture tests only.

The adapter accepts only direct HTTPS navigation candidates whose top-level origin is exactly `https://www.bet365.it`; credential-bearing URLs, notification intermediary domains, and unrelated redirect origins fail before matching/activation. The future worker must independently validate a permitted real DOM mapping before promotion to live `Supported`.

## Safety boundary

This workspace has no capability for credentials, MFA/CAPTCHA, stake entry, bet confirmation/submission, deposit/withdrawal, or access-control/anti-bot bypass. An adapter can prepare one verified outcome selection only; final activation is delegated to `SelectionActivationGate`.
