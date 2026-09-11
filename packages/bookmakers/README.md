# Bookmaker adapters

This workspace contains bookmaker-specific selection-preparation logic behind the accepted restricted page and `SelectionActivationGate` contracts.

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

The adapter consumes semantic element snapshots through `BookmakerPagePort`. The future Playwright worker must map real SISAL DOM state into those semantic fields and must pass the same contract suite before this integration can be labeled live `Supported`. No undocumented/private API access is used.

Notification intermediary URLs such as `bet-up.it/.../sisal` are intentionally rejected by the adapter as direct navigation targets. Redirect resolution, if added, belongs to the worker navigation policy and must explicitly validate every redirect hop and final SISAL origin.

## Safety boundary

This workspace has no capability for credentials, MFA/CAPTCHA, stake entry, bet confirmation/submission, deposit/withdrawal, or access-control/anti-bot bypass. The adapter can prepare one verified outcome selection only; final activation is delegated to `SelectionActivationGate`.
