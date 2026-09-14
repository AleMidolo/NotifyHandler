# BOOK-008 — BET365 live validation record

Date: **2026-09-14**  
Scope: `https://www.bet365.it`, pre-match football, full-match total-corners over/under selection preparation only.

## Decision

**Live MVP scope status: Blocked.**

The existing BET365 adapter remains **Testable** against deterministic synthetic fixtures and the isolated Playwright worker. This record does not downgrade that fixture-backed maturity. It records that the **live** scope cannot yet be promoted to `Supported` because current selector-level evidence for the requested total-corners path has not been established under the accepted deterministic matching policy.

No production BET365 selector was invented or promoted from indexed/editorial text, old examples, third-party code, guessed CSS classes, or protected/private APIs.

## Public evidence collected

Only normal public HTTPS material on the approved Italian origin was inspected; no login, CAPTCHA, anti-bot, rate-limit, geo, or access-control bypass was attempted.

Observed public endpoints include:

- `https://www.bet365.it/hub/it-it/football`
  - reachable on the approved `www.bet365.it` origin;
  - exposes current football fixtures in public indexed content, including participant names, scheduled times, and displayed top-level match odds;
  - advertises additional football markets through the public football surface.
- `https://www.bet365.it/hub/it-it/football/football-competitions`
  - exposes public competition-level football content and displayed outright/top-level football odds.

This is useful evidence that public event and odds data remains available on the Italian football surface. It is **not** sufficient evidence for the target NotifyHandler scope, because displayed 1X2 or outright prices cannot stand in for a full-match total-corners line and outcome.

## Blocking evidence

The controlled public browsing/indexing surface available for this validation did not establish a current DOM mapping that ties all mandatory identity dimensions together for the requested corner market.

Specifically, this run could not establish all of the following from current selector-level live evidence:

1. one stable event container carrying both participants;
2. competition and/or scheduled-time context tied to that same event;
3. a market container unambiguously representing **full-match total corners**, rather than total goals, team corners, first-half corners, alternate/range corners, or another product;
4. the exact decimal line (for example `11.5`) tied to that market;
5. the requested `OVER`/`UNDER` outcome control tied to that exact line;
6. the current displayed decimal odds tied to that outcome;
7. a deterministic selected-state signal for post-activation verification.

Publicly visible top-level football prices do not satisfy these requirements. Without every required dimension, the shared matching policy does not allow activation. BOOK-008 therefore fails closed rather than introducing fuzzy text matching or selectors that have not been proven against the current live page.

## Non-CI public probe

The automation package now provides a deliberately read-only headed-browser diagnostic probe:

```text
npm run browser:install
npm run live:probe:bet365 --workspace @notify-handler/automation
```

Optional environment variables:

- `NH_BET365_LIVE_PROBE_URL` — must remain credential-free HTTPS on exactly `https://www.bet365.it`;
- `NH_BET365_LIVE_PROBE_HEADLESS=1` — useful only for diagnostics; controlled headed validation remains preferred.

The probe:

- uses a fresh ephemeral Chromium context;
- rejects top-level navigation outside the exact approved BET365 Italy origin;
- never clicks, fills, types, selects, uploads, authenticates, reads cookies/storage, takes screenshots/traces, or touches stake/submit controls;
- emits only sanitized structural counts, short public labels, and approved-origin paths;
- can report public football-link, corner-text, and decimal-odds control candidates;
- deliberately reports `mappingEvidenceSufficient: false` because structural candidates alone cannot prove the semantic event → market → exact line → outcome → odds relationship or selected state;
- is intentionally **not** part of CI.

A probe result is discovery evidence only. It does not itself make selectors production-ready.

## Required evidence to unblock

Before BET365 can move from live `Blocked` to narrowly scoped `Supported`, a controlled permitted headed-browser session must establish and sanitize the current DOM mapping for:

- event participants plus required competition/time context;
- full-match total-corners market identity;
- exact numeric line;
- outcome side;
- displayed odds;
- selected-state verification;
- manual-auth boundary behavior if authentication is encountered.

Any learned DOM shape must be converted into sanitized deterministic fixtures/regressions before production mapping is accepted. No authenticated HTML, cookies, tokens, credentials, account identifiers, or personal data may be stored.

If the live site requires CAPTCHA, unsupported authentication, anti-bot bypass, geo/rate-limit evasion, protected/private APIs, or cannot expose deterministic evidence for all required dimensions, this scope remains `Blocked`.
