# BOOK-007 — SISAL live validation record

Date: **2026-09-14**  
Scope: `https://www.sisal.it`, pre-match football, full-match total-corners over/under selection preparation only.

## Decision

**Live MVP scope status: Blocked.**

The existing SISAL adapter remains **Testable** against deterministic synthetic fixtures and the isolated Playwright worker. This record does not downgrade that fixture-backed maturity. It records that the **live** scope cannot yet be promoted to `Supported` because current selector-level event/market/line/outcome/odds evidence has not been established in a controlled headed-browser validation.

No production SISAL selector was invented or promoted from editorial copy, search-engine extraction, old examples, third-party code, or protected/private APIs.

## Public evidence collected

Only normal public HTTPS pages were inspected; no login, CAPTCHA, anti-bot, rate-limit, geo, or access-control bypass was attempted.

Observed public endpoints:

- `https://www.sisal.it/scommesse-matchpoint/sport/calcio`
  - reachable on the approved `www.sisal.it` origin;
  - current public content describes the football palinsesto, event cards, market filters, and per-event statistics;
  - login/registration links are presented separately through Sisal's account area, which remains outside NotifyHandler automation.
- `https://www.sisal.it/scommesse-matchpoint/guida/calcio`
  - public football guide remains available.
- `https://www.sisal.it/content/dam/new-dam/italy/canali/sisal-it/doc-pdf/scommesse/info-scommesse/calcio.pdf`
  - public Sisal football rules document explicitly includes corner products, including under/over corner markets and full-match corner totals.

These observations are enough to confirm that the target product family still exists publicly, but they are **not** enough to authorize live DOM selectors.

## Blocking evidence

The controlled public browsing surface available for this validation exposed page/editorial content but did not expose the current dynamically rendered betting-grid DOM at the level required by the deterministic adapter contract.

Specifically, this run could not establish all of the following from the live page with current selector-level evidence:

1. one stable event container carrying both participants;
2. competition and/or scheduled-time context tied to that same event;
3. a market container unambiguously representing full-match total corners rather than goals, team corners, first-half corners, exact/range corners, or another corner product;
4. the exact decimal line (for example `11.5`) tied to that market;
5. the requested `OVER`/`UNDER` outcome control tied to that exact line;
6. the current displayed decimal odds tied to that outcome;
7. a deterministic selected-state signal for post-activation verification.

Without all required dimensions, the shared matching policy does not allow activation. Therefore BOOK-007 fails closed rather than introducing approximate text matching or unverified CSS classes.

## Non-CI public probe

The automation package now provides a deliberately read-only headed-browser probe:

```text
npm run browser:install
npm run live:probe:sisal --workspace @notify-handler/automation
```

Optional environment variables:

- `NH_SISAL_LIVE_PROBE_URL` — must remain credential-free HTTPS on exactly `https://www.sisal.it`;
- `NH_SISAL_LIVE_PROBE_HEADLESS=1` — useful only for diagnostics; controlled headed validation remains preferred.

The probe:

- uses a fresh ephemeral Chromium context;
- rejects top-level navigation outside the approved SISAL origin;
- never clicks, fills, types, selects, uploads, authenticates, reads cookies/storage, takes screenshots/traces, or touches stake/submit controls;
- emits only sanitized structural counts plus short public labels and approved-origin paths;
- exits with code `2` when it cannot observe both public event-link and corner-control candidates;
- is intentionally **not** part of CI.

A probe result is discovery evidence only. It does not itself make selectors production-ready.

## Required evidence to unblock

Before SISAL can move from live `Blocked` to narrowly scoped `Supported`, a controlled permitted headed-browser session must establish and sanitize the current DOM mapping for:

- event participants plus required competition/time context;
- full-match total-corners market identity;
- exact numeric line;
- outcome side;
- displayed odds;
- selected-state verification;
- manual-auth boundary behavior if authentication is encountered.

Any learned DOM shape must be converted into sanitized deterministic fixtures/regressions before production mapping is accepted. No authenticated HTML, cookies, tokens, credentials, account identifiers, or personal data may be stored.

If the live site requires CAPTCHA, unsupported authentication, anti-bot bypass, geo/rate-limit evasion, protected/private APIs, or cannot expose deterministic evidence for all required dimensions, this scope remains `Blocked`.
