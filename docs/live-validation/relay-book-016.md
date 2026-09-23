# BOOK-016 — Relay-aware live target revalidation

Date: **2026-09-23**  
Scope: SISAL and BET365 revalidation from the real upstream `bet-up.it` relay flow for pre-match football full-match total-corners O/U.

## Target sample

The qualifying upstream sample used by DEVOPS-012/#143 was:

- event: `Portogallo - Galles`;
- competition: `Nations League`;
- scheduled: `24/09/2026 - 20:45`;
- source market label: `U/O CORNERS 6.5`;
- normalized market: pre-match football `full_match` total corners O/U;
- line: `6.5`;
- BET365 requested side: OVER, expected odds `1.14`;
- SISAL requested side: UNDER, expected odds `4.25`.

The exact credential-free relay URLs are retained only in the authoritative product/BOOK-016 issue history. Routine diagnostics intentionally omit the relay UUID and full relay URL.

## Execution

PR #142 merged the relay-aware BOOK-012 evidence path. It validates the typed `BETUP_RELAY` input and delegates relay resolution to the shared BOOK-017 page-runtime resolver before any bookmaker evidence collection.

DEVOPS-012/#143 then performed exactly one qualifying non-CI workstation run per bookmaker. No retry, action-budget increase, credential use, authentication automation, persistent browser profile, screenshot/trace/HAR/video capture, protected/private API inspection, or transaction action was used.

## Sanitized results

### BET365

- navigation kind: `BETUP_RELAY`;
- relay origin: `https://www.bet-up.it`;
- status: `BLOCKED`;
- block reason: `RELAY_REDIRECT_LIMIT`;
- final path: `[relay-unresolved]`;
- actions: `0/10`;
- snapshots: `0`;
- `authorizesProductionMapping: false`;
- summary SHA-256: `E8E1F44A9D7D46C61B332C1EFA756F1E464943621C3F3A8C1C9D724D6D61E9F5`.

### SISAL

- navigation kind: `BETUP_RELAY`;
- relay origin: `https://www.bet-up.it`;
- status: `BLOCKED`;
- block reason: `RELAY_REDIRECT_LIMIT`;
- final path: `[relay-unresolved]`;
- actions: `0/10`;
- snapshots: `0`;
- `authorizesProductionMapping: false`;
- summary SHA-256: `3D17327A357FDE4FE43CCD88C3211E7F57346B7B429392833A89A35D17056100`.

## Interpretation

The current BOOK-017 resolver emits `RELAY_REDIRECT_LIMIT` when, after entering the exact validated relay URL, a candidate top-level navigation remains on the `https://www.bet-up.it` origin before expected-bookmaker arrival.

Both qualifying runs therefore stopped at the shared relay-navigation boundary **before either bookmaker page was reached**.

This means:

- BOOK-016 is **Blocked for the current relay-aware production path**;
- SISAL and BET365 remain **Testable through deterministic fixtures**;
- these runs do **not** establish that either bookmaker lacks the requested full-match total-corners market;
- no event, competition/time, full-match market, exact line, requested side, displayed odds, selector mapping, or selected-state evidence was collected from either live bookmaker in this experiment;
- no restricted live mapping/activation implementation issue is justified from this evidence.

The observed blocker is a mismatch between the reviewed relay state machine and the real upstream relay behavior, not a bookmaker-specific DOM/matching result.

## Next decision

ARCH-007/#147 owns the P0 decision on whether a narrowly finite, grammar-bound, DNS-validated same-origin `bet-up.it` transition can be modeled safely without turning NotifyHandler into a generic redirect follower.

Do not repeat BOOK-016 live runs until that architectural/security decision and any resulting resolver implementation are merged.

If ARCH-007 approves a narrow extension, route back to Bookmaker Automation Engineering for deterministic resolver implementation and QA/Security review before one new bounded live evidence run.

If ARCH-007 rejects the real relay shape as unsupported, route to Product Coordination for a source-flow/candidate replan.

## Safety conclusion

The current resolver failed closed as designed. No bookmaker outcome was activated, no stake/betslip/payment/wager action occurred, and the retained evidence contains no credentials, account/session state, relay UUID, or full relay URL.


## DEVOPS-013 bounded-revisit revalidation

After ARCH-007/ADR-0005, BOOK-019, SEC-005 and QA-003 were merged/certified, QA authorized exactly one new non-CI relay-aware run for BET365 and one for SISAL using the same Portogallo-Galles target and the exact upstream relay inputs already retained in repository issue history.

The execution source was merged commit `4290058cb385005930ee18e39924135de92c2b38`.

The stored relay inputs are exact lowercase canonical URLs of the approved form:

`https://www.bet-up.it/lnk/<canonical-lowercase-uuid>/<bookmaker-suffix>`.

### BET365 DEVOPS-013 result

- navigation kind: `BETUP_RELAY`;
- relay origin: `https://www.bet-up.it`;
- status: `BLOCKED`;
- block reason: `RELAY_INVALID`;
- final path: `[relay-unresolved]`;
- actions: `0/10`;
- snapshots: `0`;
- `authorizesProductionMapping: false`;
- summary SHA-256: `834EEDF5B3885F21CBBBA6BB235265F71FDE8EAF6DE36E72EFF36BE045554865`.

### SISAL DEVOPS-013 result

- navigation kind: `BETUP_RELAY`;
- relay origin: `https://www.bet-up.it`;
- status: `BLOCKED`;
- block reason: `RELAY_INVALID`;
- final path: `[relay-unresolved]`;
- actions: `0/10`;
- snapshots: `0`;
- `authorizesProductionMapping: false`;
- summary SHA-256: `CA0E5DC39C406C388CE9BC215088AB080BD4D6BEA382842E6CC236BF6311A83F`.

Exactly one qualifying run was executed per bookmaker. No retry, action-budget increase, delay/hop tuning, proxy/bypass behavior, or sensitive/session/transaction artifact retention occurred.

### BOOK-020 interpretation

The new results still stop **inside the shared relay resolver before bookmaker arrival**. They therefore do not establish anything about the live SISAL/BET365 DOM, event, competition/time, full-match total-corners market, exact line, side, displayed odds, or selected state.

The initial upstream relay inputs themselves are not obviously malformed or stale in format: they are exact lowercase canonical relay URLs, were previously accepted into the relay phase, and had produced `RELAY_REDIRECT_LIMIT` under the older one-hop resolver.

Under the current BOOK-019/SEC-005 implementation, `RELAY_INVALID` is intentionally coarse and can represent multiple distinct safe-failure categories, including:

- a non-GET top-level relay-phase navigation;
- malformed top-level navigation;
- query/fragment/userinfo canonical-boundary violation;
- an unreviewed same-origin path;
- malformed relay signal syntax;
- canonical identity mismatch;
- start-URL mismatch or resolver-entry contract failure.

The retained BOOK-012 summary does not include the internal resolver message or any raw redirect target, so the actual DEVOPS-013 subtype cannot be determined from the authorized evidence without guessing.

Therefore:

- the current relay-aware live path remains **Blocked**;
- SISAL and BET365 remain **Testable** through deterministic fixtures;
- bookmaker-specific live feasibility remains **unobserved** in these runs;
- no live selector mapping or support promotion is justified;
- ADR-0005 must not be widened from these results;
- another live run is not justified until the relay invalid subtype can be recorded safely.

BOOK-021/#156 has now added the fixed redacted `relayInvalidCategory` diagnostic allowed by ADR-0005, with no change to accepted relay grammar/state. SEC-006/#159 and QA-004/#160 approved that diagnostic boundary. DEVOPS-014/#161 is authorized to execute exactly one new non-CI diagnostic run per target bookmaker using merged commit `d343fc2ff9c519aa216c0d4b339d9ec2074002bc`; no retry, resolver widening, hop/action-budget/delay tuning, credentials, private APIs, or transaction action is authorized.

