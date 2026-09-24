# BOOK-023 — Direct BET365/SISAL validation runner

Date: **2026-09-24**  
Issue: **#170**  
Scope: bounded non-transactional validation of the authoritative Portogallo - Galles direct bookmaker links.

## Authoritative target

The runner is source-locked to the two direct destinations supplied for BOOK-023:

- BET365: `https://www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/`
  - event: Portogallo - Galles
  - competition: Nations League
  - scheduled: 24/09/2026 20:45
  - market: pre-match football full-match total corners 6.5
  - requested side: OVER
  - expected odds: 1.14
- SISAL: `https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles`
  - event: Portogallo - Galles
  - competition: Nations League
  - scheduled: 24/09/2026 20:45
  - market: pre-match football full-match total corners 6.5
  - requested side: UNDER
  - expected odds: 4.25

The URL is navigation input only. It is never positive evidence for event, competition/time, market period/type, line, side, or displayed odds.

## Runner

On a normal non-CI workstation with the repository-pinned Node/npm/Playwright toolchain:

```text
npm run live:book023:local -- bet365
npm run live:book023:local -- sisal
```

The runner sets the exact source-controlled BOOK-023 URL itself. It accepts no runtime URL argument.

It also forces `NH_LIVE_EXPLORER_REQUIRE_DIRECT=1`, removes relay mode/input, and removes action-budget/delay overrides before delegating to the existing BOOK-012 headed explorer. Missing or unsafe direct input therefore fails before browser/network activity instead of falling back to a generic bookmaker page.

For BET365, the source-controlled URL retains the SPA fragment route exactly. The existing explorer/browser receives the complete URL; no normalization in this runner strips the fragment.

## Safety boundary

The run remains diagnostic-only:

- headed ephemeral Chromium only;
- exact approved bookmaker origin;
- no Betup resolver or fallback;
- no generic homepage fallback;
- default reviewed action budget/delay;
- no login, credentials, MFA, CAPTCHA, consent bypass, stake entry, betslip transaction, payment, or wager submission;
- no outcome activation during feasibility;
- no protected/private API inspection;
- `authorizesProductionMapping: false` remains mandatory.

If the direct URL is stale, wrong, redirected outside the approved origin, or does not expose deterministic evidence, the run must fail safely.

## Evidence decision

Interpret BET365 and SISAL separately.

A candidate may become **Feasible for implementation** only if the bookmaker page independently establishes:

`approved origin -> event -> competition/time -> full-match total corners -> line 6.5 -> requested side -> displayed odds`

The expected notification odds are comparison values, not selectors. An odds change is reportable evidence; it must not cause the explorer to click an outcome.

If deterministic evidence is insufficient, keep the candidate blocked for this live scope. Do not resume generic discovery and do not fall back to Betup.

A separate restricted live-mapping implementation issue is required before any feasible candidate can advance toward live `Supported`.
