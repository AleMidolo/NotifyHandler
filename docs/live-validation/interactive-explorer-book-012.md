# BOOK-012 — Controlled interactive live-validation explorer

Date: **2026-09-15**  
Scope: non-CI evidence collection for Milestone 6 revalidation of ADMIRALBET, SISAL, and BET365.

## Purpose

The earlier bookmaker probes were intentionally passive: they opened one public page and collected sanitized structure without interacting with public event cards, market tabs, accordions, filters, or expanders. BOOK-012 adds a separate headed-browser evidence tool that can perform a small number of normal public **navigation or expansion** actions when those controls are positively classified as non-transactional.

The explorer is not production automation and cannot promote a bookmaker to `Supported` by itself. It exists only to gather stronger sanitized evidence for BOOK-013/014/015.

## Supported targets

The explorer is hard-scoped to these exact credential-free HTTPS origins:

- `https://www.admiralbet.it`
- `https://www.sisal.it`
- `https://www.bet365.it`

A target on another origin, HTTP, URL userinfo, localhost/private/internal destination, or a top-level redirect outside the selected bookmaker origin is rejected or blocked. Adding another origin requires a reviewed source change; runtime configuration cannot broaden the allowlist.

## Run

Install the pinned Chromium runtime first, then run the explorer outside CI:

```text
npm run browser:install
NH_LIVE_EXPLORER_BOOKMAKER=admiralbet npm run live:explore --workspace @notify-handler/automation
```

Required environment variable:

- `NH_LIVE_EXPLORER_BOOKMAKER` — `admiralbet`, `sisal`, or `bet365`.

Optional variables:

- `NH_LIVE_EXPLORER_URL` — must remain on the exact approved origin for the selected bookmaker;
- `NH_LIVE_EXPLORER_RELAY_URL` — BOOK-016 relay input for SISAL/BET365 only; must exactly match `https://www.bet-up.it/lnk/<canonical-uuid>/<selected-bookmaker>` with no userinfo, query, or fragment;
- `NH_LIVE_EXPLORER_MAX_ACTIONS` — integer `1..12`, default `10`;
- `NH_LIVE_EXPLORER_DELAY_MS` — integer `750..5000`, default `1000`.

`NH_LIVE_EXPLORER_URL` and `NH_LIVE_EXPLORER_RELAY_URL` are mutually exclusive.

For relay-aware BOOK-016 evidence, for example:

```text
NH_LIVE_EXPLORER_BOOKMAKER=bet365 \
NH_LIVE_EXPLORER_RELAY_URL=<credential-free-bet-up-relay> \
npm run live:explore --workspace @notify-handler/automation
```

The explorer always launches **headed Chromium** with a fresh ephemeral context, downloads disabled, and service workers blocked. There is no headless runtime switch for live evidence collection.

## Default-deny interaction policy

Every candidate control is classified before interaction and revalidated immediately before the action. Unknown or ambiguous controls are denied.

Allowed classes are limited to:

- same-origin links whose label/path positively identifies public sports, competition, event, match, or pre-match navigation;
- non-transactional market/navigation tabs whose visible label is itself explicitly market/navigation relevant;
- public accordions, summaries, expanders, market-category controls, and similar disclosure controls only when both structural evidence and an explicitly relevant visible label are present.

A structural role alone is never enough: a generic `role="tab"`, `<summary>`, `aria-expanded`, or `aria-controls` element is denied unless its label also positively identifies an allowed market/navigation concept. This prevents outcome-like labels, participant names, and other ambiguous structural controls from being clicked merely because they use a tab/disclosure role.

Controls are denied when they look like:

- login, registration, account, profile, MFA/OTP/CAPTCHA, or authentication actions;
- an outcome/odds selection such as an OVER/UNDER line or standalone decimal price;
- betslip/schedina, stake/amount, deposit, withdrawal, cash-out, confirmation, submission, or wager actions;
- cookie/privacy/consent actions;
- irrelevant or ambiguous controls;
- navigation outside the exact approved origin.

The classifier does not use fuzzy scoring to turn an ambiguous control into an allowed one.

## Navigation versus expansion execution

Validated public navigation and expansion are intentionally executed differently.

For `NAVIGATION`, the explorer does **not** click the bookmaker-controlled anchor. After immediate revalidation it resolves the fresh href, verifies the exact approved origin again, and performs direct browser navigation with `page.goto()`. This avoids executing page-defined anchor click handlers that could mutate betslip or selection state before navigation.

For `EXPANSION`, the explorer may click only the narrowly qualified disclosure/tab/market-expansion control that passed the default-deny classifier and immediate revalidation. Outcome/odds controls remain forbidden even when visually or structurally similar to expansion controls.

## Browser/network boundary

For direct-bookmaker exploration, the browser context independently enforces the selected origin for every top-level navigation, including redirects and popup navigation. HTTP(S) requests containing URL credentials or targeting internal/private hostnames are aborted. Additional pages/popups are closed rather than used as a new interaction surface.

For relay-aware exploration, the diagnostic reuses the shared worker page-runtime resolver. Before evidence collection it permits the exact validated `https://www.bet-up.it/lnk/<signal>/<bookmaker>` relay, then either direct expected-bookmaker arrival or exactly one additional visit to that same canonical relay URL. After that revisit, the selected bookmaker's registered origin is the only accepted cross-origin destination. A different same-origin path/UUID/suffix, a second extra relay visit, third-party intermediary, different registered bookmaker, private/uncertain DNS target, unresolved relay, or relay-origin challenge fails safely. After expected-bookmaker arrival the resolver revokes relay-origin permission and the existing bookmaker-only navigation policy remains authoritative.

The explorer does not inspect protected/private API responses or use arbitrary page evaluation to bypass the visible UI.

## Bounded execution

One run has a fixed interaction budget of at most **12** actions. The delay between actions cannot be configured below **750 ms**. The explorer does not increase its budget, retry blocked interactions, rotate origins, or loop in order to defeat anti-bot/rate/access restrictions.

When the budget is reached, the run terminates with `BUDGET_EXHAUSTED`.

## Safe-stop conditions

The explorer stops with sanitized `BLOCKED` output when it detects or encounters:

- a visible password/authentication wall;
- CAPTCHA/anti-bot UI;
- explicit access/geo/rate restriction text;
- a visible consent dialog that is not part of the allowed market-navigation surface;
- unapproved top-level navigation;
- private/internal destination attempts;
- page closure.

It does not attempt to solve, dismiss, bypass, or work around those conditions.

## Sanitized evidence schema

The JSON output contains only bounded engineering evidence:

- selected bookmaker and approved origin;
- navigation kind; relay-aware runs may expose only the constant relay origin `https://www.bet-up.it`;
- start/final **bookmaker path** (not query strings or fragments); relay-aware failure before bookmaker arrival uses a constant placeholder rather than the relay path;
- run status and sanitized block reason;
- for relay-aware `RELAY_INVALID`, a required finite `relayInvalidCategory` such as `TOP_LEVEL_METHOD` or `UNREVIEWED_SAME_ORIGIN_PATH`; the field is forbidden for other failure codes/navigation kinds and contains no URL, UUID, path, query, fragment, request body, headers, or resolver message; portable validators enforce an explicit top-level field allowlist and reject contradictory status/block-reason combinations;
- fixed action budget and action count;
- page snapshots with title, control counts, and a bounded sample of relevant controls;
- for sampled controls: short label, tag/role, allow/deny result, reason code, same-origin path, selected stable attributes (`aria-expanded`, `aria-controls`, `data-testid`), short parent context, and child-interactive count;
- action records with sequence number, navigation/expansion class, short label, and before/after same-origin paths.

The tool does **not** persist full HTML, cookies/storage, credentials, account data, screenshots, traces, form values, authenticated page captures, stake values, wager data, the full relay URL, the relay signal UUID, raw rejected redirect targets, request bodies, or internal resolver messages.

Every output hard-codes:

```text
authorizesProductionMapping: false
```

BOOK-013/014/015 must independently interpret the sanitized evidence and still create a separate restricted implementation issue before any bookmaker can move toward live `Supported` status.

## Selected-state limitation

BOOK-012 deliberately does not click betting outcomes merely to discover selected-state behavior. Feasibility revalidation may prove the deterministic **pre-activation** chain:

`event → competition/time → full-match total-corners market → exact line → side → displayed odds`

Selected-state verification remains a later restricted implementation/support gate through the production selection-activation boundary.

## Verification

Repository tests cover:

- same-origin relevant navigation allowed;
- cross-origin, HTTP, and credential-bearing navigation denied;
- relevant market expansion allowed;
- structurally clickable but semantically ambiguous tabs/summaries denied;
- outcome/odds controls denied, including clickable/tabpanel-shaped examples;
- auth/transaction/consent controls denied;
- ambiguous controls denied by default;
- safe navigation executed directly with `page.goto()` rather than a page-controlled anchor click;
- unsafe direct and relay configuration rejected before Chromium launch;
- relay-aware source path forced through the shared BOOK-017 resolver without exposing the relay UUID in summary output;
- source-level absence of credential/form/storage/screenshot/trace/arbitrary-evaluation capabilities;
- headed mode, fixed interaction budget, minimum delay, navigation policy, internal-host blocking, and non-authorizing output.

Existing deterministic SISAL/BET365 worker, cancellation, stale-attempt, security, and desktop tests remain authoritative for production behavior.


### ARCH-007 relay-hop rule

The diagnostic must not expose a flag for increasing the relay hop budget. The allowed additional same-origin count is exactly one and is independent of `NH_LIVE_EXPLORER_MAX_ACTIONS`.

A relay failure after the one allowed canonical revisit is retained as shared navigation-contract evidence. The live explorer must not auto-retry it, broaden the path grammar, or classify bookmaker market feasibility before expected-bookmaker arrival.
