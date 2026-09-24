# BOOK-023 — Direct-link evidence conclusion

Date: **2026-09-24**  
Issue: **#170**  
Execution dependency: **#174 DEVOPS-015**  
Qualifying source commit: `b169832418bb9eaff348365ca1e6c8ef9b1b0d71`

## Scope

BOOK-023 revalidated the authoritative Portogallo - Galles signal using the exact direct bookmaker-origin URLs:

- BET365: `https://www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/`
- SISAL: `https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles`

Target identity remained:

- competition: Nations League;
- scheduled: 24/09/2026 20:45;
- pre-match football full-match total corners 6.5;
- BET365: OVER, expected odds 1.14;
- SISAL: UNDER, expected odds 4.25.

Direct URLs are navigation inputs only. They do not authorize event, market, line, side, or odds matching by themselves.

## BET365 evidence

Sanitized summary SHA-256:

`0AB239A1B5308826D730F18EC1FABD43A35422A633414F5ED55CF82866CF064A`

The qualifying direct-mode summary records:

- approved origin `https://www.bet365.it`;
- `navigationKind: BOOKMAKER_DIRECT`;
- sanitized start/final path `/` -> `/`;
- `status: COMPLETE`;
- actions `0/10`;
- one snapshot titled `bet365 - Scommesse sportive online`;
- three controls, zero allowed controls, and no retained samples;
- `authorizesProductionMapping: false`.

The sanitized path intentionally does not preserve the SPA fragment as evidence. More importantly, the retained bookmaker-page evidence does not establish Portogallo - Galles, Nations League/time context, total corners, full-match period, line 6.5, OVER, or displayed odds.

### BET365 conclusion

**Blocked at direct-link interactive feasibility** for the current pre-match football full-match total-corners scope.

The fixture-backed adapter remains **Testable**. No restricted live selector/mapping implementation issue is created.

This conclusion does not claim that BET365 generally lacks the event or market; it states only that the qualifying retained evidence is insufficient for NotifyHandler's deterministic production mapping.

## SISAL evidence

Sanitized summary SHA-256:

`8FB9B75BC66D614957CB8453B8C4D1B873C50595099DA62CFC19AFF3F34626FD`

The qualifying direct-mode summary records:

- approved origin `https://www.sisal.it`;
- exact start path `/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles`;
- initial title `Quote Portogallo Galles | Scommesse Calcio Nations League | Sisal Matchpoint`;
- `status: BUDGET_EXHAUSTED`;
- actions `10/10`;
- `authorizesProductionMapping: false`.

The retained event-page evidence therefore positively establishes the direct Portogallo-Galles / Nations League page.

The sampled market-navigation context also includes the visible category family containing `CORNER`, but the retained controls do not bind that category to a full-match total-corners market or the requested selection identity. The retained summary contains no positive evidence for:

- scheduled time 20:45;
- exact line 6.5;
- UNDER side;
- bound displayed odds 4.25 (or any replacement current price);
- deterministic full-match total-corners identity.

The fixed action budget was consumed by allowed navigation controls and the run eventually left the event page for `/totocalcio`. The explorer was not retried with a larger budget and no safety boundary was weakened.

### SISAL conclusion

**Blocked at direct-link interactive feasibility** for the current pre-match football full-match total-corners scope.

The fixture-backed adapter remains **Testable**. The direct URL materially improves event/competition binding compared with the previous generic exploration, but the mandatory market/line/side/odds chain is still incomplete. No restricted live selector/mapping implementation issue is created.

## BOOK-023 outcome

Neither BET365 nor SISAL reaches `Feasible for implementation` from this evidence.

Therefore:

- BOOK-023 is complete as a feasibility interpretation task;
- no production selector mapping is authorized;
- no outcome activation or selected-state live test is justified yet;
- no Betup fallback or generic homepage discovery is resumed;
- QA-002/#45 remains blocked because there is still no live-supported pair;
- DEVOPS-003/#46 remains blocked on QA-002;
- PRODUCT-028/#175 owns the next Milestone-6 replan.

The next validation should use a new current/future target with exact bookmaker-origin URLs and the same deterministic evidence requirements unless Product explicitly changes the scope.
