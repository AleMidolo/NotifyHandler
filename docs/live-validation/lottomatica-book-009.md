# BOOK-009 — LOTTOMATICA live feasibility record

Date: **2026-09-14**  
Scope: Italian public LOTTOMATICA sports-betting surface, pre-match football, full-match total-corners over/under with an exact numeric line.

## Decision

**Feasibility outcome: Blocked.**

This issue is feasibility-first. No production adapter or worker DOM mapping is introduced because the controlled public validation did not establish selector-level evidence for the complete semantic chain required by NotifyHandler.

The canonical public origin observed for the current Lottomatica product is:

- `https://www.lottomatica.it`

No alternate origin is approved by this record.

## Public evidence collected

Only normal public HTTPS sources were inspected. No login, CAPTCHA, anti-bot, rate-limit, geo, or access-control bypass was attempted.

Current official Lottomatica pages indexed on the approved origin show an active sports-betting product and current football promotions, including prematch football activity. This is sufficient to confirm that football betting remains part of the public product, but it is not sufficient evidence for the requested total-corners market mapping.

A direct fetch of an official Lottomatica page in the controlled validation environment returned HTTP 403 instead of exposing the dynamic sports-betting grid. That response was treated as an access boundary, not something to evade or work around.

The accessible public material did not provide current selector-level evidence proving all of the following on one exact event:

1. participant identities;
2. competition and/or scheduled-time context tied to that event;
3. a market container unambiguously representing **full-match total corners** rather than goals, team corners, half corners, exact/range corners, or another product;
4. the exact numeric line (for example `11.5`) tied to that market;
5. the requested `OVER`/`UNDER` side tied to that exact line;
6. the current displayed decimal odds tied to that outcome;
7. a deterministic selected-state signal suitable for post-activation verification.

No visible promotion, editorial text, generic football price, old selector, third-party code, or unrelated market is accepted as a substitute for those dimensions.

## Non-CI public probe

The automation package provides a deliberately read-only diagnostic probe:

```text
npm run browser:install
npm run live:probe:lottomatica --workspace @notify-handler/automation
```

Optional environment variables:

- `NH_LOTTOMATICA_LIVE_PROBE_URL` — must be credential-free HTTPS on exactly `https://www.lottomatica.it`;
- `NH_LOTTOMATICA_LIVE_PROBE_HEADLESS=1` — diagnostic only; controlled headed validation remains preferred.

The probe:

- uses a fresh ephemeral Chromium context;
- blocks top-level navigation outside the exact approved origin;
- never clicks, fills, types, selects, uploads, authenticates, reads cookies/storage, captures screenshots/traces, enters stakes, or submits/finalizes wagers;
- emits only sanitized structural counts, short public labels, and same-origin paths;
- hard-codes `mappingEvidenceSufficient: false` and exits with code `2` after collection so structural observations cannot accidentally promote production mapping;
- is intentionally excluded from CI.

A probe result is discovery evidence only.

## Why no implementation issue is created

BOOK-009 permits a follow-up restricted adapter/worker implementation issue only when selector-level feasibility is positively established. That bar is not met here.

Creating an adapter from the available evidence would require guessing DOM relationships or weakening the matching policy, which is explicitly prohibited.

## Required evidence to unblock

Before LOTTOMATICA can become `Feasible for implementation`, a controlled permitted normal-browser session must establish and sanitize current selector-level semantics for:

- one event container with both participants;
- required competition/time context;
- full-match total-corners market identity;
- exact numeric line;
- requested side;
- displayed odds;
- post-selection selected-state verification;
- manual-auth boundary behavior if authentication is encountered.

Any learned DOM shapes must be converted into sanitized deterministic fixtures/regressions before a production mapping is accepted.

If access to those semantics requires CAPTCHA solving, unsupported authentication, anti-bot/rate-limit/geo/access-control bypass, protected/private API reverse engineering, or collection of credentials/session data, this scope remains **Blocked**.
