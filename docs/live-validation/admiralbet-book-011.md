# BOOK-011 — ADMIRALBET live feasibility record

Date: **2026-09-15**  
Scope: Italian public ADMIRALBET sports-betting surface, pre-match football, full-match total-corners over/under with an exact numeric line.

## Decision

**Feasibility outcome: Blocked.**

ADMIRALBET exposes substantially more public sports structure than the preceding feasibility candidates, but this validation still did not establish the complete selector-level semantic chain required by NotifyHandler for the requested market. No production adapter or worker DOM mapping is introduced from partial evidence.

The canonical public origin is:

- `https://www.admiralbet.it`

ADM's current distance-gaming concession register maps Admiral Bet S.r.l., concession `16048`, to `www.admiralbet.it`. AdmiralBet's public site reports the same concession number.

## Public evidence collected

Only normal public HTTPS material was inspected. No login, CAPTCHA, anti-bot, rate-limit, geo, or access-control bypass was attempted.

The current public `/scommesse` surface exposes useful sports-betting content without requiring account credentials, including:

- football competitions and event rows;
- participant names and scheduled date/time text;
- generic market families such as final result, double chance, and goal under/over;
- numeric lines and displayed decimal odds for those generic markets;
- live-event detail containing richer market lists and match statistics.

Public material also mentions corner-related live products/statistics. That evidence is useful, but it is not evidence for the required **pre-match full-match total-corners over/under** market.

The validation could not positively establish all of the following for one exact pre-match event:

1. a stable selector-level event container carrying both participants and competition/time context;
2. a market container unambiguously representing **full-match total corners**, rather than goal totals, team corners, half corners, live next-corner products, or statistics;
3. the exact numeric corner line tied to that market;
4. the requested `OVER`/`UNDER` side tied to that exact line;
5. the current displayed decimal odds tied to that side;
6. a deterministic selected-state signal suitable for post-activation verification.

Generic goal `U/O` rows, editorial references to corners, live corner statistics, or live next-corner products are explicitly not substitutes for the required market identity.

## Non-CI public probe

The automation package provides a deliberately read-only diagnostic probe:

```text
npm run browser:install
npm run live:probe:admiralbet --workspace @notify-handler/automation
```

Optional environment variables:

- `NH_ADMIRALBET_LIVE_PROBE_URL` — must be credential-free HTTPS on exactly `https://www.admiralbet.it`;
- `NH_ADMIRALBET_LIVE_PROBE_HEADLESS=1` — diagnostic only; controlled headed validation remains preferred.

The probe:

- uses a fresh ephemeral Chromium context;
- blocks top-level navigation outside the exact approved origin;
- never clicks, fills, types, selects, uploads, authenticates, reads cookies/storage, captures screenshots/traces, enters stakes, or submits/finalizes wagers;
- emits only sanitized counts/short labels/same-origin paths for football, generic over/under, corner-text, and event-link candidates;
- hard-codes `mappingEvidenceSufficient: false` and exits with code `2`, so structural observations cannot promote production mapping;
- is intentionally excluded from CI.

A probe result is discovery evidence only.

## Why no implementation issue is created

BOOK-011 allows a restricted implementation issue only after selector-level feasibility is positively established. ADMIRALBET comes closer than the other queued candidates because public event/market/odds structure is visible, but the exact total-corners identity and selected-state requirements remain unproven.

Creating an adapter now would require assuming that generic U/O controls represent corner totals or guessing how selected state is represented. Both violate the shared matching policy.

## Required evidence to unblock

Before ADMIRALBET can become `Feasible for implementation`, a controlled permitted normal-browser session must establish and sanitize current selector-level semantics for:

- one exact pre-match football event with participants plus competition/time context;
- full-match total-corners market identity;
- exact numeric corner line;
- requested side;
- displayed odds;
- post-selection selected-state verification;
- manual-auth boundary behavior if authentication is encountered.

Any learned DOM shape must be converted into sanitized deterministic fixtures/regressions before a production mapping is accepted.

If obtaining that evidence requires CAPTCHA solving, unsupported authentication, anti-bot/rate-limit/geo/access-control bypass, protected/private API reverse engineering, or collection of credentials/session data, the scope remains **Blocked**.

## Queue consequence

BOOK-011 exhausts the feasibility queue created by PRODUCT-004: SISAL and BET365 are live-blocked while fixture-Testable, and LOTTOMATICA, EPLAY24, and ADMIRALBET are blocked at feasibility for the narrow full-match total-corners scope. After independent QA review, Product Coordination should re-plan Milestone 6 rather than silently widening the market or weakening matching requirements.
