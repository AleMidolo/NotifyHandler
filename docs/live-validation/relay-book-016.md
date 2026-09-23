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
