# BOOK-015 — BET365 interactive revalidation

Date: **2026-09-21**  
Scope: `https://www.bet365.it`, pre-match football, full-match total-corners over/under selection preparation only.

## Decision

**Interactive live-feasibility outcome: Blocked.**

BOOK-015 consumed an actual sanitized BOOK-012 result produced on a qualifying non-CI Windows workstation through DEVOPS-011 / #97. The run reached the approved BET365 football hub and multiple competition pages, and it exposed sanitized participant/time groupings tied to those competition contexts. That is stronger live evidence than BOOK-008.

However, the qualifying run did not expose the remaining deterministic market chain required for a safe live selector mapping before the fixed interaction budget was exhausted:

`full-match total-corners market → exact numeric line → OVER/UNDER side → displayed odds`.

The existing BET365 adapter remains **Testable** against deterministic fixtures and the isolated Playwright worker. This result blocks only the current live pre-match football full-match total-corners scope.

No production BET365 selector mapping or separate live-mapping implementation issue is created from this evidence.

## Qualifying BOOK-012 result

Approved origin:

- `https://www.bet365.it`

Start path:

- `/hub/it-it/football`

Sanitized result:

- bookmaker: `bet365`
- final path: `/hub/it-it/football/football-competitions/bundesliga`
- status: `BUDGET_EXHAUSTED`
- action budget: `10`
- actions taken: `10`
- snapshots: `11`
- `authorizesProductionMapping: false`
- source file SHA-256: `d2c1b7819f812ae7a94a3e4006361cc950c1b5adb839ac762b219cad529b6592`

The explorer stopped at the fixed interaction budget. It was not retried with a larger budget and the interaction boundary was not relaxed.

## Sanitized structural evidence

The football hub exposed participant/time groupings including examples such as:

- `Genoa / Fiorentina / sab 10 ott 15:00`
- `Inter / Parma / sab 10 ott 18:00`
- `Napoli / Frosinone / sab 10 ott 20:45`
- `Como / Roma / dom 11 ott 12:30`
- `Lazio / Monza / dom 11 ott 15:00`

Those sampled event controls navigated through `/dl/sportsbookredirect/`.

The explorer also reached distinct competition pages:

- Coppa del Mondo
- UEFA Champions League
- Serie A
- Serie B
- Bundesliga

Competition snapshots exposed competition identity plus event/time examples, such as:

- Champions League: `Lens / Sporting / mar 13 ott 18:45`
- Serie A: `Genoa / Fiorentina / sab 10 ott 15:00`
- Bundesliga: `Borussia Dortmund / Werder Brema / ven 09 ott 20:30`

The sampled surface also preserved denials for irrelevant or unapproved links, including news/features, promotions, Bet Builder references, and other unrelated navigation.

Recorded actions:

1. Coppa del Mondo: football hub → `/hub/it-it/football/football-competitions/world-cup`
2. CALCIO → football hub
3. Campionati Europei → football hub
4. UEFA Champions League → `/hub/it-it/football/football-competitions/champions-league`
5. CALCIO → football hub
6. Serie A → `/hub/it-it/football/football-competitions/serie-a`
7. CALCIO → football hub
8. Serie B → `/hub/it-it/football/football-competitions/serie-b`
9. CALCIO → football hub
10. Bundesliga → `/hub/it-it/football/football-competitions/bundesliga`

The run therefore establishes that normal permitted navigation can expose competition, participant, and scheduled-time evidence. It does **not** establish the downstream total-corners market chain.

## Required chain assessment

Target:

`event → competition/time → full-match total-corners market → exact numeric line → OVER/UNDER side → displayed odds`

Result after the qualifying run:

1. **Event participants — established at sanitized public-structure level.** Participant pairs were visible in sampled football event groupings.
2. **Scheduled time — established at sanitized public-structure level.** Event samples included specific scheduled times.
3. **Competition context — established at sanitized public-structure level.** The explorer reached named competition pages containing participant/time groupings.
4. **Deterministic event-to-market navigation — not established.** Sampled event controls used `/dl/sportsbookredirect/`, but the explorer did not establish a safe selector-level route from one exact event into its target market surface.
5. **Full-match total-corners market — not established.** No qualifying sampled evidence distinguished full-match total corners from 1X2, total goals, team corners, half-specific corners, live corner products/statistics, Bet Builder, or another football market.
6. **Exact numeric corner line — not established.**
7. **Requested OVER/UNDER side — not established.**
8. **Displayed decimal odds bound to that exact side/line — not established.**
9. **Selected state — intentionally out of scope for feasibility.** BOOK-015 never activates a betting outcome.

Top-level match odds, generic football prices, Bet Builder references, news/features, or unrelated markets are not accepted as substitutes for the missing corner-market dimensions.

## Why the live scope remains Blocked

BOOK-015 requires BET365 to remain live `Blocked` when deterministic evidence remains insufficient after the approved interactive run. That condition is met.

The qualifying run does establish meaningful live event context, but not the selector-level market path required to activate safely. Creating live selectors now would require guessing how `/dl/sportsbookredirect/` resolves into event/market state, assuming market semantics, widening the explorer budget/capabilities, or weakening deterministic matching. None is acceptable.

The existing fixture-backed BET365 adapter remains `Testable`; only live promotion for this narrow scope is blocked.

## Safety boundary

The qualifying run used normal public same-origin browser interaction only. It did not use or add:

- credential entry or login automation;
- MFA/CAPTCHA handling;
- cookies/storage/session capture;
- screenshots, traces, HAR, video, or raw HTML dumps;
- protected/private API inspection;
- outcome/odd activation;
- stake, payment, betslip, or wager submission;
- anti-bot, rate-limit, geo, or access-control bypass.

## Queue consequence

BOOK-015 produces no feasible live implementation candidate. PRODUCT-005's interactive revalidation queue is now exhausted:

- ADMIRALBET / BOOK-013 — Blocked
- SISAL / BOOK-014 — Blocked
- BET365 / BOOK-015 — Blocked

After independent QA accepts and merges this result, Product Coordination must explicitly re-plan Milestone 6 rather than weakening the full-match total-corners target or deterministic safety contract implicitly.

QA-002/#45 and production release #46 remain blocked.
