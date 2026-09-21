# BOOK-014 — SISAL interactive revalidation

Date: **2026-09-21**  
Scope: `https://www.sisal.it`, pre-match football, full-match total-corners over/under selection preparation only.

## Decision

**Interactive live-feasibility outcome: Blocked.**

BOOK-014 consumed an actual sanitized BOOK-012 result produced on a qualifying non-CI Windows workstation through DEVOPS-009 / #89. The run reached the approved SISAL football surface and exercised only BOOK-012 classifier-approved public interaction under the fixed action budget. It did not expose the deterministic pre-activation chain required for a safe live selector mapping before the budget was exhausted.

The existing SISAL adapter remains **Testable** against deterministic fixtures and the isolated Playwright worker. This result blocks only the current live pre-match football full-match total-corners scope; it does not remove fixture-backed maturity and does not claim SISAL is generally inaccessible.

No production SISAL selector mapping or separate live-mapping implementation issue is created from this evidence.

## Qualifying BOOK-012 result

Approved origin:

- `https://www.sisal.it`

Start path:

- `/scommesse-matchpoint/sport/calcio`

Sanitized result:

- bookmaker: `sisal`
- final path: `/totocalcio`
- status: `BUDGET_EXHAUSTED`
- action budget: `10`
- actions taken: `10`
- snapshots: `11`
- `authorizesProductionMapping: false`
- source file SHA-256: `6ff2c74db83b41f7cbc51a9218e28e721b6a32af247ee55a847ffc959b7ff314`

The explorer stopped at the fixed interaction budget. It was not retried with a larger budget and the interaction boundary was not relaxed.

## Sanitized structural evidence

Snapshots S1-S6 remained on the approved football path. They exposed hundreds of controls, but the sampled eligible labels were dominated by global/top-level navigation and generic filters such as:

- Scommesse
- Lotterie
- Casinò e Poker
- Giochi
- Community
- Sport
- Live
- Ippica
- Totocalcio
- Tipster
- Scommesse On Demand
- Blog
- Tutti
- Quote Favorite
- Oggi

`Accedi alla sezione Totocalcio` was explicitly denied as `FORBIDDEN_CONTROL`.

At action 6, the explorer navigated to `/totocalcio`. Snapshots S7-S11 remained there and exposed only generic/top-level navigation plus Totocalcio informational controls such as `Scopri`, `Come si gioca`, and `Bacheca dei Sistemi`.

Recorded actions:

1. Scommesse: football path → football path
2. Lotterie: football path → football path
3. Casinò e Poker: football path → football path
4. Giochi: football path → football path
5. Community: football path → football path
6. Totocalcio: football path → `/totocalcio`
7. Scommesse: `/totocalcio` → `/totocalcio`
8. Lotterie: `/totocalcio` → `/totocalcio`
9. Casinò e Poker: `/totocalcio` → `/totocalcio`
10. Giochi: `/totocalcio` → `/totocalcio`

The qualifying run therefore did not produce a sampled eligible event row, event-detail navigation, or non-transactional market-expansion control leading to the target corner market.

## Required chain assessment

Target:

`event → competition/time → full-match total-corners market → exact numeric line → OVER/UNDER side → displayed odds`

Result after the qualifying run:

1. **Selector-level event binding — not established.** No stable sampled event container or event-detail path tied both participants to later market evidence.
2. **Competition/time binding — not established.** The sanitized explorer evidence did not structurally bind competition/scheduled time to a target event.
3. **Full-match total-corners market — not established.** Public SISAL documentation confirms corner products exist, but the qualifying interactive run did not expose a deterministic live market container for full-match total corners.
4. **Exact numeric corner line — not established.**
5. **Requested OVER/UNDER side — not established.**
6. **Displayed decimal odds bound to that exact side/line — not established.**
7. **Selected state — intentionally out of scope for feasibility.** BOOK-014 never activates a betting outcome.

Generic football navigation, generic filters, Totocalcio, editorial/help material, goal markets, live corner products/statistics, or old/third-party selectors are not substitutes for the missing dimensions.

## Why the live scope remains Blocked

BOOK-014 requires SISAL to remain live `Blocked` when deterministic evidence remains insufficient after the approved interactive run. That condition is met.

The run consumed the fixed evidence-gathering budget without revealing a safe selector-level path from one exact event to the requested full-match total-corners market, exact line, side, and displayed price. Creating live selectors now would require guessing DOM structure, assuming semantics, widening the explorer budget/capabilities, or weakening deterministic matching. None is acceptable.

The existing fixture-backed SISAL adapter remains `Testable`; only live promotion for this narrow scope is blocked.

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

BOOK-014 produces no feasible live implementation candidate. Per PRODUCT-005 sequencing, BOOK-015 / #64 (BET365 interactive revalidation) becomes the next bookmaker task after independent QA accepts and merges this result.

The matching, authentication, and transaction-safety contracts remain unchanged.
