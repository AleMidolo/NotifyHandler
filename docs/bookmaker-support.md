# Bookmaker support

Bookmaker support is incremental and must conform to the shared adapter contract. A bookmaker is not considered supported merely because a page can be opened or a DOM selector can be clicked.

## Support states

- **Candidate** — desired product target; feasibility not yet validated.
- **Designing** — adapter behavior/matching strategy under investigation.
- **Implementing** — active implementation issue/PR exists.
- **Testable** — deterministic local/mock contract and regression tests exist.
- **Supported** — adapter satisfies contract, safety tests, and release criteria for the documented scope.
- **Blocked** — integration cannot currently meet technical, safety, or permitted-access requirements.

## Initial candidates

| Bookmaker | Priority | Status | Notes |
| --- | --- | --- | --- |
| SISAL | 1 | Blocked (relay-aware live path); Testable (fixtures) | After the bounded ADR-0005 resolver was merged and Security/QA certified, DEVOPS-013 executed one new qualifying upstream relay run. It stopped with `RELAY_INVALID` before SISAL origin arrival, actions 0, snapshots 0, and no live bookmaker evidence. The initial relay input is canonical; the retained summary does not distinguish the invalid subtype. BOOK-021/#156 adds a redacted subtype diagnostic without widening the resolver. Fixture-backed behavior remains Testable. See `docs/live-validation/relay-book-016.md`. |
| BET365 | 2 | Blocked (relay-aware live path); Testable (fixtures) | After the bounded ADR-0005 resolver was merged and Security/QA certified, DEVOPS-013 executed one new qualifying upstream relay run. It stopped with `RELAY_INVALID` before BET365 origin arrival, actions 0, snapshots 0, and no live bookmaker evidence. The initial relay input is canonical; the retained summary does not distinguish the invalid subtype. BOOK-021/#156 adds a redacted subtype diagnostic without widening the resolver. Fixture-backed behavior remains Testable. See `docs/live-validation/relay-book-016.md`. |
| LOTTOMATICA | 3 | Blocked (feasibility) | BOOK-009 confirms the current official `www.lottomatica.it` product exposes active sports/football material, but controlled public validation did not establish the exact event → full-match total-corners → line → side → odds → selected-state selector chain. A direct official-page fetch in the validation environment returned HTTP 403 and was not bypassed. No adapter is created from insufficient evidence. See `docs/live-validation/lottomatica-book-009.md`. |
| EPLAY24 | 4 | Blocked (feasibility) | BOOK-010 confirms current ADM concession `16004` maps E-play 24 Ita Limited to `www.eplay24.it`, and public EPLAY24 material confirms football/prematch betting. The accessible betting application is JavaScript-only in the crawl surface and the controlled validation did not establish the exact event → total-corners → line → side → odds → selected-state chain. No adapter is created from insufficient evidence. See `docs/live-validation/eplay24-book-010.md`. |
| ADMIRALBET | 5 | Blocked (interactive feasibility) | BOOK-013 consumed a qualifying non-CI BOOK-012 run on `www.admiralbet.it`. The explorer reached the approved origin and `/scommesse/calcio`, but exhausted its fixed 10-action budget without exposing selector-level event binding, the full-match total-corners market, exact line, requested side, or bound displayed odds. `authorizesProductionMapping` remained false. See `docs/live-validation/admiralbet-book-013.md`. |

The passive PRODUCT-004 queue and PRODUCT-005 generic interactive queue are both exhausted. ADMIRALBET, SISAL, and BET365 remain Blocked for the narrow live scope.

PRODUCT-015/PRODUCT-016 established that the real upstream source supplies typed `bet-up.it` relay links rather than direct bookmaker URLs. ARCH-007/ADR-0005 then approved one bounded canonical same-origin revisit, implemented by BOOK-019 and certified by SEC-005/QA-003. DEVOPS-013 re-ran exactly once per target bookmaker and both runs stopped safely with coarse `RELAY_INVALID` before bookmaker arrival. The bookmaker-specific deterministic chain therefore remains unobserved. BOOK-021/#156 is the immediate diagnostic blocker; do not widen the relay contract or repeat live evidence until its redacted subtype path is Security/QA approved.

Priorities may change when technical feasibility, permitted access, notification prevalence, or regression complexity provides evidence for a better order.

## Browser worker testable scope

BOOK-005 adds the first concrete Playwright-backed worker implementation of the restricted `BookmakerPagePort` and `SelectionActivationGate` runtime boundary.

The worker:

- owns Playwright and does not expose raw `Browser`, `BrowserContext`, `Page`, locators, cookies, storage, or arbitrary evaluation to application/core/bookmaker adapter code;
- launches a dedicated Chromium process and ephemeral context for each bookmaker leg, with production launch defaulting to a visible headed browser;
- keeps the approved production origins fixed to `https://www.sisal.it` and `https://www.bet365.it`;
- rejects malformed, non-HTTPS, credential-bearing, unapproved, loopback/private/internal navigation and revalidates top-level navigation/redirects independently of adapter checks;
- maps bookmaker-neutral semantic read queries to worker-owned selectors;
- invalidates element references after navigation/DOM replacement and checks that elements remain connected before interaction;
- exposes final outcome activation only through the evidence/odds-bound selection gate;
- provides an explicit test-only fixture launcher that intercepts exact approved HTTPS bookmaker URLs in memory and blocks every unconfigured request, so CI does not contact live bookmaker infrastructure;
- carries cancellation into navigation/wait operations and closes an in-flight page when necessary to stop the operation;
- has no credential/MFA/CAPTCHA, stake, funding, cash-out, wager confirmation/submission, anti-bot, geo, rate-limit, or access-control bypass operation.

CI installs the pinned Chromium runtime and executes the Playwright fixture suite. The synthetic `data-nh-*` role attributes used by those fixtures are worker test harness conventions only; they are **not** statements about the live SISAL or BET365 DOM.

## SISAL fixture-backed scope and live blocker

The current SISAL adapter:

- accepts only HTTPS top-level navigation on `https://www.sisal.it`;
- rejects credential-bearing URLs and notification redirect/intermediary domains such as `bet-up.it` as direct trusted targets;
- requires deterministic participant identity and the shared competition/time context policy;
- independently matches market family/context, exact decimal line, and outcome side;
- captures displayed decimal odds and interrupts on any valid price change;
- delegates the final outcome activation to `SelectionActivationGate` and verifies selected state afterwards;
- reports a visible authentication wall as `AUTH_REQUIRED` without reading or entering credentials;
- fails safely on ambiguity, neighboring lines, wrong event/market/outcome, unavailable odds, blocked redirects, cancellation, and failed post-activation verification.

The adapter remains **Testable** through the real Playwright worker against controlled local/in-memory browser fixtures.

BOOK-007 attempted the live promotion using only normal public SISAL pages. The approved football origin and Sisal's public documentation for corner products are reachable, but the controlled validation surface did not expose enough current dynamic DOM evidence to establish deterministic live selectors for the event, required competition/time context, full-match total-corners market identity, exact line, side, displayed odds, and post-selection selected state. Approximate text matching, old/third-party selectors, protected/private APIs, or access-control bypass are not acceptable substitutes.

BOOK-014 consumed the stronger interactive evidence through DEVOPS-009/#89. The qualifying BOOK-012 run started at `/scommesse-matchpoint/sport/calcio`, produced 11 sanitized snapshots, and exhausted its fixed 10-action budget. The sampled eligible controls remained generic/top-level navigation; no deterministic event row, competition/time binding, event-detail path, full-match total-corners market, exact line, requested side, or displayed price bound to that side/line was established before the run ended at `/totocalcio`. `authorizesProductionMapping` remained false.

Therefore the existing deterministic fixture-backed adapter remains **Testable**, while live support remains **Blocked**. The later bounded relay-aware revalidation stopped at coarse `RELAY_INVALID` before SISAL origin arrival; no SISAL live bookmaker evidence was collected. The initial relay input is canonical, but the retained summary cannot identify whether the invalid subtype was the GET-only boundary, an unreviewed same-origin path, URL-boundary mutation, or another finite invalid category. BOOK-021/#156 addresses only that diagnostic gap. No live selector mapping or implementation issue is created. See `docs/live-validation/sisal-book-014.md` and `docs/live-validation/relay-book-016.md`.

## BET365 fixture-backed scope and live blocker

The current BET365 adapter:

- accepts only HTTPS top-level navigation on `https://www.bet365.it`;
- rejects credential-bearing URLs, notification intermediary domains, and unrelated redirect origins before matching or activation;
- requires deterministic participant identity and the same shared competition/time context policy used by SISAL;
- independently matches market family/context, exact decimal line, and outcome side;
- captures displayed decimal odds and interrupts on any valid price change;
- delegates final outcome activation to `SelectionActivationGate` and requires deterministic selected-state verification afterwards;
- reports visible authentication requirements as `AUTH_REQUIRED` without reading or entering credentials;
- preserves `ATTEMPTED_NOT_VERIFIED`/manual-review semantics when cancellation races an activation already in flight;
- fails safely on ambiguous/wrong event, market, line, or outcome, unavailable/invalid odds, blocked redirects, cancellation, and failed post-activation verification.

The adapter remains **Testable** through the real Playwright worker against controlled browser fixtures. The semantic fixture attributes are internal test-harness data and are **not** assertions about the live BET365 DOM.

BOOK-008 validated the current public Italian football surface using only normal public access. Public BET365 Italy pages expose fixtures, timestamps, competitions, and displayed football odds, which confirms that useful public data is visible. However, the controlled validation surface did not establish a safe selector-level relationship from one exact event to the requested **full-match total-corners** market, exact numeric line, requested side, displayed odds, and post-selection selected state. Top-level 1X2 odds are not a substitute for the requested corner-market evidence, and no protected/private API or access-control bypass is acceptable.

BOOK-015 consumed the stronger interactive evidence through DEVOPS-011/#97. The qualifying BOOK-012 run started at `/hub/it-it/football`, reached World Cup, Champions League, Serie A, Serie B, and Bundesliga competition pages, and exposed sanitized participant/time groupings inside competition context. It therefore positively establishes useful event, scheduled-time, and competition structure on the public BET365 Italy surface.

The run still did not establish deterministic event-to-market navigation or expose the requested **full-match total-corners** market, exact numeric line, requested OVER/UNDER side, or displayed decimal odds bound to that side/line before exhausting the fixed 10-action budget. `authorizesProductionMapping` remained false.

Therefore the existing deterministic fixture-backed adapter remains **Testable**, while live support remains **Blocked**. The later bounded relay-aware revalidation stopped at coarse `RELAY_INVALID` before BET365 origin arrival; no BET365 live bookmaker evidence was collected. The initial relay input is canonical, but the retained summary cannot identify whether the invalid subtype was the GET-only boundary, an unreviewed same-origin path, URL-boundary mutation, or another finite invalid category. BOOK-021/#156 addresses only that diagnostic gap. No live selector mapping or implementation issue is created. See `docs/live-validation/bet365-book-015.md` and `docs/live-validation/relay-book-016.md`.

No protected/private API reverse engineering is part of this integration.

## LOTTOMATICA feasibility blocker

BOOK-009 evaluated LOTTOMATICA before any production adapter investment. The current official `https://www.lottomatica.it` origin exposes active sports/football material, confirming that football betting remains part of the product. That fact alone is not sufficient for NotifyHandler's deterministic preparation contract.

The controlled public validation did not establish selector-level evidence tying one event to a full-match total-corners market, exact numeric line, requested side, displayed decimal odds, and a deterministic post-selection state. A direct official-page fetch in this validation environment returned HTTP 403; that boundary was not bypassed. No generic football price, promotion text, approximate selector, protected/private API, or third-party DOM sample is accepted as a substitute.

Therefore LOTTOMATICA is **Blocked at feasibility** for the narrow MVP scope, and no adapter/worker mapping is created. `packages/automation` includes a non-CI read-only `live:probe:lottomatica` command restricted to credential-free `https://www.lottomatica.it` URLs. It emits only sanitized structural summaries and deliberately hard-codes `mappingEvidenceSufficient: false`, so a diagnostic run cannot promote the bookmaker into implementation by itself. See `docs/live-validation/lottomatica-book-009.md`.

## EPLAY24 feasibility blocker

BOOK-010 evaluated EPLAY24 before any production adapter investment. The current ADM concession register maps E-play 24 Ita Limited, concession `16004`, to `www.eplay24.it`, and current public EPLAY24 material confirms a sports/football and prematch product. That is enough to establish the operator and product family, but not the deterministic mapping required by NotifyHandler.

The indexed betting application is JavaScript-only in the controlled crawl surface. A public redirect record for a prematch Serie A route points toward the bare `eplay24.it` host, while a direct controlled fetch of that bare host returned HTTP 403. Those boundaries were not bypassed. The controlled public evidence therefore did not establish selector-level event identity, competition/time context, full-match total-corners market identity, exact numeric line, requested side, displayed decimal odds, or deterministic post-selection state.

Therefore EPLAY24 is **Blocked at feasibility** for the narrow MVP scope, and no adapter/worker mapping is created. `packages/automation` includes a non-CI read-only `live:probe:eplay24` command restricted to credential-free `https://www.eplay24.it` URLs. It emits only sanitized structural summaries and deliberately hard-codes `mappingEvidenceSufficient: false`, so a diagnostic run cannot promote the bookmaker into implementation by itself. See `docs/live-validation/eplay24-book-010.md`.

## ADMIRALBET interactive feasibility blocker

BOOK-011 established useful passive public structure for ADMIRALBET. BOOK-013 then consumed an actual BOOK-012 explorer result from a qualifying non-CI Windows workstation against the exact approved origin `https://www.admiralbet.it`.

The sanitized run returned `BUDGET_EXHAUSTED` after the fixed 10-action budget and 11 snapshots. It reached `/scommesse/calcio`, but sampled allowed controls remained top-level same-origin navigation; no selector-level target event, competition/time binding, eligible corner-market expansion, full-match total-corners identity, exact line, requested side, or displayed odd bound to that side/line was established. The explorer ended at `/scommesse/ippica` and reported `authorizesProductionMapping: false`.

Separate public evidence shows a distinct pre-match `Calci D Angolo` market-family label, but the qualifying BOOK-012 run did not reach or structurally bind that family to the exact target chain. Generic goal totals, live corner statistics, next-corner products, editorial text, and unrelated football odds remain unacceptable substitutes.

Therefore ADMIRALBET is **Blocked at interactive feasibility** for the narrow pre-match football full-match total-corners scope. No production adapter, worker mapping, selector mapping, or implementation issue is created. The result does not claim that ADMIRALBET is generally inaccessible or unsupported for every possible market. See `docs/live-validation/admiralbet-book-013.md`.

PRODUCT-005's generic interactive queue is exhausted. The structured-ingestion path now supports the bounded ADR-0005 relay state machine, but the latest QA-authorized DEVOPS-013 SISAL/BET365 runs still stopped before bookmaker arrival with coarse `RELAY_INVALID`. BOOK-021/#156 must first identify the redacted invalid subtype without changing relay acceptance. The matching/security contract remains unchanged, and QA-002/#45 plus production release #46 remain blocked.

## Minimum adapter capabilities

A supported adapter must implement the shared architecture contract and be able to:
- validate/open supported bookmaker URLs or entry points;
- report manual-login requirement without handling credentials;
- locate event candidates;
- verify event identity using available context;
- locate the requested market family;
- verify the exact line/threshold;
- locate/verify the requested side or outcome;
- read current displayed odds where technically available;
- compare expected and observed odds using shared policy;
- select only after all required identity checks pass;
- return structured evidence, states, and failure reasons;
- support cancellation/retry semantics defined by architecture.

## Required tests before `Supported`

At minimum, each adapter needs deterministic tests/fixtures for:
- exact successful match;
- wrong event with similar participant names;
- wrong competition/date context where relevant;
- same market family but wrong neighboring line;
- correct line but wrong side/outcome;
- missing market/outcome;
- changed odds;
- page/load timeout or changed page structure;
- login-required state;
- duplicate/ambiguous candidate match;
- transaction-boundary protection: no stake or submit action exists.

## Live-site interaction policy

Testing should favor local/sanitized fixtures and permitted normal browser interaction. Do not add code that bypasses CAPTCHA, authentication controls, rate limits, geo restrictions, anti-bot measures, or protected APIs.

If normal permitted interaction cannot support safe deterministic selection, mark the bookmaker or affected flow `Blocked` rather than weakening the matching or security model.

## Scope granularity

Support may be scoped by sport, market type, page flow, or pre-match/live mode. Do not label an adapter generically `Supported` if only a narrower scope has been validated. Document limitations explicitly in this file and adapter documentation.
