# BOOK-013 — ADMIRALBET interactive revalidation

Date: **2026-09-21**  
Scope: Italian public ADMIRALBET sports-betting surface, pre-match football, full-match total-corners over/under with an exact numeric line.

## Decision

**Interactive revalidation outcome: Blocked.**

BOOK-013 consumed an actual sanitized BOOK-012 result produced on a qualifying non-CI Windows workstation through DEVOPS-005 / #71. The run reached the approved ADMIRALBET origin and exercised only BOOK-012's classifier-approved same-origin public navigation under the fixed action budget. It did not expose the deterministic pre-activation chain required for a safe production mapping before the budget was exhausted.

No production ADMIRALBET adapter, worker DOM mapping, selector mapping, or implementation issue is created from this result.

## Qualifying BOOK-012 result

Approved origin:

- `https://www.admiralbet.it`

Sanitized result:

- bookmaker: `admiralbet`
- start path: `/scommesse`
- final path: `/scommesse/ippica`
- status: `BUDGET_EXHAUSTED`
- action budget: `10`
- actions taken: `10`
- snapshots: `11`
- `authorizesProductionMapping: false`
- source file SHA-256: `46649302b29faba6c08729fffc1bb108916b756c24eff04ce67cc9932e5d0e52`

The recorded safe-navigation sequence was:

`/scommesse` → Totocalcio → repeated safe navigation → Sport → `CALCIO` → repeated safe navigation → Virtual → Totocalcio → Ippica.

The explorer stopped at the fixed interaction budget. It was not retried with a larger budget and no capability boundary was relaxed.

## Sanitized structural evidence

Across the eleven snapshots, allowed sampled controls were top-level same-origin navigation such as Sport, Virtual, Ippica, Totocalcio, CALCIO, TENNIS, and PALLACANESTRO. The sampled denial was irrelevant Governance navigation.

The run did reach `/scommesse/calcio`, but the sanitized snapshots still did not expose selector-level event rows or an eligible non-transactional market-expansion path leading to the target corner market. The explorer then continued through other approved navigation until the fixed budget was exhausted.

Separate current public evidence collected during BOOK-013 shows that ADMIRALBET presents a distinct pre-match `Calci D Angolo` market-family label. That supplementary evidence is useful context, but the qualifying BOOK-012 run did not produce the structural bindings needed to turn that label into a deterministic production mapping.

## Required chain assessment

Target:

`event → competition/time context → full-match total-corners market → exact numeric line → OVER/UNDER side → displayed odds`

Result after the qualifying run:

1. **Selector-level event binding — not established.** The BOOK-012 snapshots did not expose a stable sampled event container tying both participants to the later market evidence.
2. **Competition/time binding — not established in the explorer evidence.** Current public pages may display such context, but the qualifying sanitized run did not bind it structurally to one target event.
3. **Corner market family — supplementary evidence only.** `Calci D Angolo` is visible in current public material, but the qualifying run did not reach or expand it.
4. **Full-match total-corners semantics — not established.** No eligible evidence distinguished the required full-match total from team, half, exact/range, handicap, next-corner, or statistical corner products.
5. **Exact numeric corner line — not established.**
6. **Requested OVER/UNDER side — not established.**
7. **Displayed decimal odds bound to that exact side/line — not established.**
8. **Selected state — intentionally out of scope for feasibility.** BOOK-013 never activates an outcome.

Generic goal U/O, live corner statistics, editorial text, top-level football odds, and unrelated navigation are not accepted as substitutes for the missing dimensions.

## Why the scope is Blocked

Issue #62 explicitly requires a `Blocked` result when required deterministic evidence remains unavailable after a qualifying BOOK-012 run. That condition is now met.

The run completed its allowed evidence-gathering budget without exposing the target selector-level chain. Promoting ADMIRALBET to implementation would therefore require guessed navigation, assumed market semantics, fuzzy matching, a larger exploratory capability than BOOK-012 authorizes, or some other weakening of the current matching/safety contract. None is acceptable.

This result is scoped narrowly to the current NotifyHandler target: **pre-match football full-match total-corners over/under**. It does not claim ADMIRALBET is generally inaccessible or unsuitable for all market types.

## Safety boundary

The qualifying run used normal public same-origin browser interaction only. No credential entry, login automation, MFA/CAPTCHA handling, cookie/storage capture, screenshots/traces/HAR/video, protected/private API inspection, stake entry, outcome activation, wager submission, proxy-based access-control bypass, rate-limit bypass, geo bypass, or anti-bot bypass was used.

## Queue consequence

BOOK-013 produces no feasible implementation candidate. Per PRODUCT-005 sequencing, BOOK-014 / #63 (SISAL interactive revalidation) is the next bookmaker task after independent QA accepts and merges this result.

The matching and transaction-safety policies remain unchanged.
