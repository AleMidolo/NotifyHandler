# Product requirements

## 1. Objective

NotifyHandler converts a surebet notification into an automatically started two-leg execution plan and prepares the two requested bookmaker selections. It optimizes for low latency, correctness, and explicit failure—not click completion at any cost.

The normal flow must not ask the user to review parsed content, choose a recommended pair, confirm an execution plan, or press a start button before bookmaker pages are opened. Once a valid notification is received, the application should proceed automatically as soon as required deterministic and safety checks pass.

## 2. Users and primary use case

Primary user: a person who already has a surebet signal containing event/market/bookmaker/odds information and wants the repetitive navigation and outcome-selection steps prepared automatically before taking manual control.

Primary flow:
1. receive notification text or structured data;
2. parse and normalize it;
3. deterministically resolve the primary recommended pair;
4. build exactly two validated bookmaker targets;
5. immediately start both legs and open the two bookmaker pages independently;
6. locate and verify the requested event, market, exact line, outcome, and current odds;
7. prepare each selection when all required identity checks pass;
8. surface mismatches/login requirements/failures without guessing;
9. hand control to the user after the selections are prepared.

## 3. MVP functional requirements

### PR-01 Input
The application shall accept a surebet notification through an input transport. Pasted text may be supported initially, but the core parser shall not depend on the transport so Telegram/webhook/clipboard/application sources can reuse it.

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
- expected odds;
- bookmaker deep link when supplied;
- recommended paired options/stakes as informational input.

### PR-03 Automatic validation and startup
Parsing and validation shall happen immediately after notification receipt. Invalid or ambiguous required fields shall block execution and produce an explicit safe failure.

A normalized preview may be displayed for observability, but it must not gate execution and must not require acknowledgement. No browser action may occur until the deterministic input, target, adapter-availability, and navigation-safety checks required by the contracts have passed.

### PR-04 Automatic recommended-pair resolution
The application shall not ask the user to choose a recommended option.

For the initial notification contract, recommended options are ordered by the notification producer and the first recommended option in source order is the authoritative primary option. The parser/domain layer must preserve this order.

The primary recommended option must deterministically resolve to exactly two distinct bookmaker legs. If it cannot, execution fails safely before bookmaker navigation. The application must not silently choose a later recommendation as a substitute and must not ask the user which pair to use.

### PR-05 Immediate execution plan
As soon as PR-03 and PR-04 succeed, the application shall construct the exact two-leg execution plan and start both legs without waiting for user confirmation.

The application may display the normalized notification and exact two targets concurrently with execution status, but this information is informational rather than a pre-execution gate.

Each target includes bookmaker, event, competition/date context, market, line, outcome/side, expected odds, and deep link if available.

### PR-06 Independent leg execution
Each bookmaker leg shall have independent state and error information. One leg failing must not be represented as failure/success of the other.

Both legs should be started as soon as possible and may execute concurrently when the architecture permits.

### PR-07 Event matching
An adapter shall select an event candidate only when the evidence is sufficient for the configured matching policy. Participant names, competition, and date/time context should be used where available.

### PR-08 Market and line matching
The exact market family and line/threshold must be verified before any outcome click. Similar markets or neighboring lines must not be treated as equivalent.

### PR-09 Outcome matching
The requested side/outcome must be verified independently of the market/line. Ambiguity must fail safely.

### PR-10 Odds comparison
The adapter shall read the currently displayed odds for the target selection when possible and compare them to expected odds. Expected odds and observed odds must remain distinct data. Odds changes shall be surfaced explicitly according to the shared odds policy.

### PR-11 Safe selection
An outcome may be selected only when event, market, line, and outcome checks all satisfy the matching policy. Otherwise no candidate is clicked.

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
- odds changed;
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
- event, market, line, outcome and displayed odds are checked independently;
- a leg is selected only after all required identity checks pass;
- changed odds are reported according to the shared odds policy rather than silently substituted;
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

As of 2026-09-14, the functional MVP described above is implemented and verified for the **local deterministic/unsigned-preview channel**. This means the application can be built as a Windows x64 desktop preview and the representative SISAL + BET365 flow is exercised end-to-end through synthetic controlled browser fixtures with the required safety, matching, recovery, and transaction-boundary checks.

This status must not be interpreted as a live production support claim:

- SISAL and BET365 are currently `Testable`, not live `Supported`;
- their real public-site DOM/mapping has not yet passed the project's narrow support gates;
- the Windows x64 preview is unsigned and must not be presented as a production release;
- production release requires explicit supported bookmaker/market scope plus the signing/release gates in `docs/release.md`.

The next product milestone is to validate the initial SISAL + BET365 pair through permitted normal-browser interaction for the narrow pre-match football total-corners scope. If a bookmaker cannot be mapped reliably without bypassing access controls or weakening deterministic matching, that scope must be marked `Blocked` rather than treated as supported.

After the initial pair is qualified as live `Supported`, the next release milestone is a signed Windows production candidate. Additional bookmakers and automatic notification transports remain later expansion work unless new product evidence reprioritizes them.
