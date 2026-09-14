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
| SISAL | 1 | Blocked (live); Testable (fixtures) | BOOK-007 confirms the public SISAL football/corner product remains reachable, but current live event/market/line/outcome/odds DOM evidence was not available at selector level in the controlled validation surface. No unverified selector was promoted. The deterministic BOOK-001/BOOK-005 fixture-backed path remains Testable. See `docs/live-validation/sisal-book-007.md`. |
| BET365 | 2 | Testable | BOOK-003 implements the restricted adapter logic. BOOK-005 adds a real isolated Playwright/Chromium worker exercised against controlled synthetic BET365 fixture pages. Live `www.bet365.it` DOM mapping/smoke validation remains required before `Supported`. |
| LOTTOMATICA | 3 | Candidate | Add after first pair stabilizes. |
| EPLAY24 | 4 | Candidate | Add after first pair stabilizes. |
| ADMIRALBET | 5 | Candidate | Add after first pair stabilizes. |

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

Therefore the **live pre-match football total-corners scope is Blocked** until a controlled permitted headed-browser run can produce sanitized selector-level evidence for every required identity dimension. `packages/automation` includes a non-CI read-only `live:probe:sisal` command to collect public structural candidates without clicks, authentication, cookies/storage reads, screenshots/traces, stake entry, or wager submission. See `docs/live-validation/sisal-book-007.md`.

## BET365 testable scope and limitations

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

The BET365 adapter is also exercised through the real Playwright worker against controlled browser fixtures. The semantic fixture attributes are internal test-harness data and are **not** assertions about the live BET365 DOM. Promotion from **Testable** to **Supported** still requires a permitted normal-browser mapping for the Italian public site plus the shared adapter contract/security/release gates. No protected/private API reverse engineering is part of this integration.

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
