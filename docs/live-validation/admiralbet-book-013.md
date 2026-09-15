# BOOK-013 — ADMIRALBET interactive revalidation

Date: **2026-09-15**  
Scope: Italian public ADMIRALBET sports-betting surface, pre-match football, full-match total-corners over/under with an exact numeric line.

## Decision

**Interactive revalidation outcome: Blocked.**

BOOK-013 revisited ADMIRALBET after BOOK-012 introduced the controlled, non-authorizing public-navigation explorer. The current public surface provides stronger semantic evidence than BOOK-011: a pre-match football competition page exposes exact event rows and an explicit `Calci D Angolo` market-family control. That is meaningful progress, but it still does not establish the complete deterministic pre-activation chain required before a production adapter can be implemented safely.

No production ADMIRALBET adapter, worker DOM mapping, or implementation issue is created from this partial evidence.

## Validation boundary

The approved public origin remains:

- `https://www.admiralbet.it`

Only normal public same-origin navigation/evidence was used. No login, CAPTCHA, anti-bot, rate-limit, geo, access-control, protected/private API, credential/session, stake, outcome-activation, or wager-submission capability was used.

The repository's BOOK-012 explorer remains the authoritative non-CI tool for future local headed validation. In this agent execution environment, a network-capable local Chromium/`agent-browser` executable was not available, so this run does **not** claim that the BOOK-012 CLI itself was executed against ADMIRALBET. Instead, the available controlled browser/search surface was used to follow and inspect current public same-origin ADMIRALBET pages under the same non-transactional evidence rules. This limitation is recorded explicitly rather than inventing a headed-browser transcript.

## Stronger public evidence obtained

A current public pre-match Premier League page under the approved origin exposes all of the following together:

- competition context: `Calcio - Inghilterra - Premier League`;
- scheduled pre-match event rows with participant names and times;
- exact ordinary market rows and displayed decimal prices for markets such as final result and goal under/over;
- a visible market-family navigation entry named **`Calci D Angolo`** alongside other distinct families such as `Cartellini`, `Tiri`, `Fuorigioco`, `U/O Asiatici`, `Tempi`, and `Squadre`.

That last point is important: unlike BOOK-011, current public evidence now positively shows that ADMIRALBET presents a distinct pre-match corner-market family rather than only editorial/live corner references.

The public live surface was also checked as a negative-control distinction. It exposes live goal under/over rows and match statistics including current corner counts. Those live statistics and goal totals remain semantically separate from the target pre-match full-match total-corners market and are not accepted as substitutes.

## Required chain assessment

Target chain:

`event → competition/time context → full-match total-corners market → exact numeric line → OVER/UNDER side → displayed odds`

Current evidence assessment:

1. **Event identity — evidenced.** Public competition pages expose participant pairs in discrete scheduled event rows.
2. **Competition/time context — evidenced.** The page carries league context and scheduled date/time text for the same rows.
3. **Corner market family — partially evidenced.** `Calci D Angolo` is explicitly exposed as a distinct pre-match market-family control.
4. **Full-match total-corners semantics — not yet evidenced.** The available controlled surface does not expose the expanded contents of `Calci D Angolo` strongly enough to distinguish full-match total corners from team corners, half corners, exact/range corner products, handicaps, or other corner submarkets.
5. **Exact numeric corner line — not evidenced.** No selector-level line value tied to the required full-match total-corners market was obtained.
6. **Requested OVER/UNDER side — not evidenced.** No selector-level side identity tied to an exact corner line was obtained.
7. **Displayed odds for that side — not evidenced.** Ordinary football odds are visible publicly, but no current decimal price was deterministically tied to the required corner side/line.
8. **Selected state — intentionally not part of feasibility.** BOOK-013 does not activate outcomes. Selected-state verification remains a later restricted implementation/support gate.

Targeted public queries for current ADMIRALBET corner totals did not expose a deterministic exact-line/side/price tuple. Absence of indexed evidence is not treated as proof that the product does not exist; it only means the required mapping is still unproven under the available permitted validation surface.

## Why the result remains Blocked

The presence of a `Calci D Angolo` category is not sufficient to authorize a production mapping. NotifyHandler must know exactly which nested market represents **full-match total corners**, the exact decimal/integer line, which control is `OVER` versus `UNDER`, and which displayed odd belongs to that exact side and line.

Creating an implementation issue now would require one or more assumptions about the corner submarket hierarchy or outcome binding. That would violate `specs/matching-policy.md` and the fail-safe product contract.

Therefore ADMIRALBET remains **Blocked at feasibility**, despite the stronger evidence that a distinct pre-match corner market family exists.

## Required evidence to unblock

A future permitted headed-browser run should use BOOK-012 and capture sanitized structural evidence after expanding `Calci D Angolo` for one exact pre-match event. It must establish:

- event container with both participants;
- competition and scheduled time context;
- full-match total-corners market title/context;
- exact numeric line;
- `OVER` and `UNDER` controls bound to that exact line;
- displayed decimal odds bound to each side;
- stable, non-sensitive structural attributes sufficient to create deterministic fixtures.

The explorer must continue to avoid outcome activation. Selected-state verification belongs to the later restricted production activation path if feasibility is eventually proven.

If obtaining the missing evidence requires authentication automation, CAPTCHA solving, anti-bot/rate-limit/geo/access-control bypass, protected/private API reverse engineering, or collection of credentials/session data, the scope remains **Blocked**.

## Queue consequence

BOOK-013 does not produce a feasible live candidate. Per PRODUCT-005 sequencing, BOOK-014 / #63 (SISAL interactive revalidation) becomes the next bookmaker task because fewer than two feasible candidates exist.
