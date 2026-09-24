# Product requirements

## 1. Objective

NotifyHandler converts a surebet notification into an automatically started two-leg execution plan and prepares the two requested bookmaker selections. It optimizes for low latency, correctness, and explicit failure—not click completion at any cost.

The normal flow must not ask the user to review parsed content, choose a recommended pair, confirm an execution plan, or press a start button before bookmaker pages are opened. Once a valid notification is received, the application should proceed automatically as soon as required deterministic and safety checks pass.

## 2. Users and primary use case

Primary user: a person who already has a surebet signal containing event/market/bookmaker information, optionally including a quoted price for reference, and wants the repetitive navigation and outcome-selection steps prepared automatically before taking manual control.

Primary flow:
1. receive notification text or structured data;
2. parse and normalize it;
3. deterministically resolve the primary recommended pair;
4. build exactly two validated bookmaker targets;
5. immediately start both legs and open the two bookmaker pages independently;
6. locate and verify the requested event, market, exact line, and outcome;
7. prepare each selection when all required identity checks pass, regardless of whether the current displayed odds equal the notification price;
8. surface mismatches/login requirements/failures without guessing;
9. hand control to the user after the selections are prepared.

## 3. MVP functional requirements

### PR-01 Input
The application shall accept a surebet notification through an input transport. Pasted text remains supported, and the core parser/domain path must remain transport-independent.

The production integration shall also support a **versioned structured notification** from an upstream surebet bot. That structured form may provide the authoritative execution pair directly as exactly two bookmaker legs, each containing bookmaker identity, requested side/outcome, an optional expected/notified price for informational provenance, and a bookmaker deep link intended to open the match page, together with the shared event and market identity.

For the local desktop deployment, the first HTTP/webhook transport shall bind to loopback only by default. Public Internet exposure of the desktop listener is not an MVP requirement; a remote bot requires a separately designed secure relay/outbound connection.

Receiving a new valid notification shall trigger processing automatically. The user shall not need to manually start execution after input receipt.

### PR-02 Deterministic parsing
The application shall normalize at least:
- event participants;
- competition;
- date/time;
- market family;
- line/threshold where applicable;
- side/outcome;
- bookmaker name;
- expected/notified odds when present, as informational metadata only;
- bookmaker deep link when supplied;
- recommended paired options/stakes as informational input.

### PR-03 Automatic validation and startup
Parsing and validation shall happen immediately after notification receipt. Invalid or ambiguous required fields shall block execution and produce an explicit safe failure.

A normalized preview may be displayed for observability, but it must not gate execution and must not require acknowledgement. No browser action may occur until the deterministic input, target, adapter-availability, and navigation-safety checks required by the contracts have passed.

### PR-04 Automatic execution-pair resolution
The application shall not ask the user to choose a pair.

For the legacy textual notification contract, recommended options are ordered by the notification producer and the first recommended option in source order remains the authoritative primary option. The parser/domain layer must preserve this order.

For the versioned structured bot contract, the producer may provide the authoritative pair directly as exactly two explicit legs. That contract must not require a synthetic recommended-options list or silently replace either leg.

Whichever input form is used, the execution pair must resolve deterministically to exactly two distinct supported bookmaker legs. If it cannot, execution fails safely before bookmaker navigation and the application must not ask the user which pair to use.

### PR-05 Immediate execution plan
As soon as PR-03 and PR-04 succeed, the application shall construct the exact two-leg execution plan and start both legs without waiting for user confirmation.

The application may display the normalized notification and exact two targets concurrently with execution status, but this information is informational rather than a pre-execution gate.

Each target includes bookmaker, event, competition/date context, market, line, outcome/side, and deep link if available. Expected/notified odds may be retained separately as informational provenance but are not part of selection identity.

When a deep link is supplied and passes pre-navigation safety validation, it is the preferred initial navigation candidate because the upstream bot is expected to link directly to the match page. The link itself is never sufficient event evidence: after navigation the adapter must still independently verify event identity, competition/time context, market, exact line, and requested side. Displayed odds may be observed for the user but do not authorize or block the selection.

### PR-06 Independent leg execution
Each bookmaker leg shall have independent state and error information. One leg failing must not be represented as failure/success of the other.

Both legs should be started as soon as possible and may execute concurrently when the architecture permits.

### PR-07 Event matching
An adapter shall select an event candidate only when the evidence is sufficient for the configured matching policy. Participant names, competition, and date/time context should be used where available.

### PR-08 Market and line matching
The exact market family and line/threshold must be verified before any outcome click. Similar markets or neighboring lines must not be treated as equivalent.

### PR-09 Outcome matching
The requested side/outcome must be verified independently of the market/line. Ambiguity must fail safely.

### PR-10 Odds observability — non-gating
The adapter may read the currently displayed odds for the target selection when available and expose them to the user as informational state. Expected/notified odds and observed odds must remain distinct metadata when both exist.

A changed, missing, or unreadable price must **not** by itself block selection activation, require acknowledgement, or cause safe failure when the exact bookmaker/event/market/period/line/outcome identity is otherwise deterministically established. NotifyHandler must not calculate surebet validity, ROI, profitability, stake sizing, or whether the current price is acceptable.

### PR-11 Safe selection
An outcome may be selected only when event, market family/context/period, exact line when required, and outcome checks all satisfy the matching policy. Otherwise no candidate is clicked. Odds equality/readability is not part of this authorization predicate.

### PR-12 Login-required behavior
If authentication is required, NotifyHandler shall stop/pause the affected leg and report `manual login required`. It shall not capture or enter credentials or automate MFA/CAPTCHA.

This manual authentication interruption does not change the default automatic-start requirement: no authentication prompt or confirmation is required before initial navigation unless the bookmaker itself requires login.

### PR-13 Manual handoff
After preparation, NotifyHandler shall report `ready for user` and leave stake entry, review, and final bet submission to the user.

### PR-14 Recovery actions
The application shall support clear recovery actions appropriate to state, including retry, reopen, cancel, and restart where technically meaningful. Recovery controls are post-start controls and do not introduce a normal pre-execution confirmation step.

## 4. User-visible states

At minimum the application should be able to represent:
- notification received;
- parsing;
- invalid/ambiguous input;
- opening bookmaker;
- waiting for page;
- manual login required;
- event found;
- market found;
- selection candidate found;
- current odds observed (optional informational data, not an action-required state);
- selection prepared;
- ready for user;
- failed safely;
- cancelled.

The UI may also show normalized parsed data and the automatically selected primary recommendation, but no `ready to execute`, preview-approval, pair-selection, or start-confirmation state is required in the normal path.

State names may be refined by architecture, but the semantic distinctions must remain visible.

## 5. Non-functional requirements

### NFR-01 Safety/correctness
False-positive selection is more severe than a false-negative safe failure. Matching policies should therefore favor precision over recall.

### NFR-02 Determinism
Parsing, normalization, primary recommendation resolution, plan construction, and matching rules should be deterministic and unit-testable wherever possible.

### NFR-03 Latency
The application should minimize notification-to-browser-open latency. User-facing preview/rendering must not block plan construction or browser startup. Independent legs should begin concurrently when safe and technically practical.

### NFR-04 Testability
Core logic and adapter behavior must be testable with sanitized local/mock fixtures. Live bookmaker interaction must not be required for the majority of automated tests.

### NFR-05 Extensibility
Bookmaker-specific behavior must stay behind a common adapter contract. Notification transport must remain separate from parsing/domain logic.

### NFR-06 Observability
Errors and matching evidence should be diagnosable without logging credentials or unnecessary personal/session data.

### NFR-07 Reproducibility
Development, tests, browser/runtime setup, and packaging must be reproducible and automated by CI where appropriate.

## 6. Explicit exclusions from MVP

NotifyHandler will not:
- discover surebets itself;
- calculate/recalculate whether a pair is a surebet, ROI, profitability, or whether a changed price is acceptable;
- ask the user to choose between recommended pairs during the normal automatic flow;
- calculate bankroll strategy or choose stakes automatically;
- enter stakes;
- submit/confirm/place bets;
- make deposits/withdrawals;
- capture/store/enter bookmaker credentials;
- automate MFA/CAPTCHA;
- bypass access controls, anti-bot measures, rate limits, or geo restrictions;
- scrape/automate a bookmaker where the chosen integration method is not permitted.

## 7. MVP acceptance scenario

Given a valid notification whose first recommended option is SISAL OVER 11.5 + BET365 UNDER 11.5 for a specific event and U/O CORNER 11.5 market:

- receipt of the notification automatically starts parsing;
- the first recommended option is resolved without asking the user;
- exactly two valid targets are built;
- the two bookmaker legs start without a preview acknowledgement, pair-selection prompt, or start button;
- both bookmaker pages are opened as soon as validation and navigation-safety checks allow;
- normalized notification/target information may be shown while execution is already in progress;
- event, market family/context/period, exact line and outcome are checked independently;
- a leg is selected only after all required identity checks pass;
- displayed odds may be shown when available, but a changed/missing/unreadable price does not block selection preparation and requires no acknowledgement;
- ambiguity causes an explicit safe failure with no uncertain click;
- any required login step is manual;
- stake entry and final submission are manual;
- final state clearly identifies whether each leg is prepared or failed.

If the first recommended option is malformed, ambiguous, same-bookmaker, or unsupported, NotifyHandler fails safely before bookmaker navigation instead of choosing another pair or asking the user.

## 8. Success metrics for MVP

Initial product quality should be evaluated using deterministic fixture/regression suites rather than click-through volume. Key metrics include:
- zero known wrong-event/market/line/outcome selections in the regression suite;
- 100% explicit failure for defined ambiguous near-match fixtures;
- complete parser coverage for the agreed initial notification schema;
- deterministic automatic selection of the primary recommended option;
- no pre-execution user-confirmation dependency in the normal valid-notification flow;
- explicit user-visible status for every terminal leg state;
- automated tests proving transaction-boundary capabilities are absent/blocked;
- measurable notification-to-browser-open latency suitable for later optimization.

## 9. Product maturity and release interpretation

As of 2026-09-15, the functional MVP described above is implemented and verified for the **local deterministic/unsigned-preview channel**. The application can be built as a Windows x64 desktop preview and the representative SISAL + BET365 flow is exercised end-to-end through synthetic controlled browser fixtures with the required safety, matching, recovery, and transaction-boundary checks.

This status must not be interpreted as a live production support claim. The first passive live-validation phase is exhausted without any bookmaker reaching live `Supported` status for the target pre-match football full-match total-corners scope:

- SISAL — live `Blocked`; fixture-backed `Testable`;
- BET365 — live `Blocked`; fixture-backed `Testable`;
- LOTTOMATICA — `Blocked (feasibility)`;
- EPLAY24 — `Blocked (feasibility)`;
- ADMIRALBET — `Blocked (feasibility)` under passive inspection despite comparatively rich public event/generic-market/line/odds visibility.

The current product decision is to **retain full-match total corners as the Milestone 6 market target** rather than silently substituting an easier market. The representative use case requires exact market-family, numeric-line, and side identity; generic goal U/O, 1X2, live corner statistics, next-corner products, and editorial references do not satisfy that requirement.

The first controlled interactive public-browser strategy is also exhausted: BOOK-013/014/015 completed bounded qualifying runs for ADMIRALBET, SISAL, and BET365 without establishing the complete deterministic target chain.

PRODUCT-015 therefore adopts a **direct-match-link-first** strategy before adding more bookmakers or revising the market scope. The upstream surebet bot will supply exactly two bookmaker legs and a deep link intended to open each match page directly. The project will:
1. use ARCH-004/#103 to define the versioned structured exact-pair contract, loopback webhook, and deep-link trust boundary;
2. use BOOK-016/#104 to revalidate SISAL/BET365 from representative real match-page links rather than generic football/competition hubs;
3. use APP-005/#105 to implement loopback HTTP ingestion after the architecture contract is accepted;
4. use SEC-002/#106 to harden the ingress and deep-link boundary.

For feasibility, the required evidence is the deterministic **selection-identity** chain:
`event → competition/time context → full-match total-corners market → exact line → requested side`.

Displayed odds are not a feasibility or activation requirement. They may be retained as bounded informational evidence when available.

A direct match link is only a preferred navigation candidate. It must pass HTTPS/origin/redirect safety checks and never substitutes for positive page evidence for the event or any later identity dimension.

A `Feasible for implementation` result is not live support. A feasible candidate must then complete a separate restricted adapter/worker live-mapping task with deterministic fixtures, all shared identity/security/cancellation/auth gates, optional current-odds observability, and selected-state verification through the authorized production outcome-selection capability. Exploratory tooling must not activate betting outcomes merely to discover selected-state behavior.

QA #45 certifies only the first two bookmakers that genuinely become narrowly scoped live `Supported`. Windows x64 preview artifacts remain unsigned and must not be presented as production releases. Production release remains blocked on #45 plus the signing/release gates in `docs/release.md`.

If the controlled interactive strategy still cannot yield two feasible candidates, Product Coordination must make an explicit candidate-pool or market-scope decision; the project must not manufacture support by weakening deterministic matching or bypassing access controls.
