# Product requirements

## 1. Objective

NotifyHandler converts a surebet notification into a user-reviewed execution plan and prepares the two requested bookmaker selections. It optimizes for correctness and explicit failure, not click completion.

## 2. Users and primary use case

Primary user: a person who already has a surebet signal containing event/market/bookmaker/odds information and wants the repetitive navigation and outcome-selection steps prepared before taking manual control.

Primary flow:
1. supply notification text or structured data;
2. parse and normalize it;
3. review parsed content;
4. choose one recommended bookmaker pair;
5. review the exact two-leg plan;
6. execute the two legs independently;
7. inspect mismatches/login requirements/failures;
8. take manual control after the selections are prepared.

## 3. MVP functional requirements

### PR-01 Input
The application shall accept pasted surebet notification text. The core parser shall not depend on the transport so future Telegram/webhook/clipboard sources can reuse it.

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

### PR-03 Parsed preview
The application shall display the normalized interpretation before any bookmaker automation begins. Invalid or ambiguous required fields shall block execution.

### PR-04 Recommended pair selection
The application shall display recommended paired options and allow the user to choose one. A chosen pair must resolve to exactly two bookmaker legs.

### PR-05 Execution plan
Before opening bookmaker pages, the application shall show the exact two targets: bookmaker, event, competition/date context, market, line, outcome/side, expected odds, and deep link if available.

### PR-06 Independent leg execution
Each bookmaker leg shall have independent state and error information. One leg failing must not be represented as failure/success of the other.

### PR-07 Event matching
An adapter shall select an event candidate only when the evidence is sufficient for the configured matching policy. Participant names, competition, and date/time context should be used where available.

### PR-08 Market and line matching
The exact market family and line/threshold must be verified before any outcome click. Similar markets or neighboring lines must not be treated as equivalent.

### PR-09 Outcome matching
The requested side/outcome must be verified independently of the market/line. Ambiguity must fail safely.

### PR-10 Odds comparison
The adapter shall read the currently displayed odds for the target selection when possible and compare them to expected odds. Expected odds and observed odds must remain distinct data. Odds changes shall be surfaced explicitly.

### PR-11 Safe selection
An outcome may be selected only when event, market, line, and outcome checks all satisfy the matching policy. Otherwise no candidate is clicked.

### PR-12 Login-required behavior
If authentication is required, NotifyHandler shall stop/pause and report `manual login required`. It shall not capture or enter credentials or automate MFA/CAPTCHA.

### PR-13 Manual handoff
After preparation, NotifyHandler shall report `ready for user` and leave stake entry, review, and final bet submission to the user.

### PR-14 Recovery actions
The application shall support clear recovery actions appropriate to state, including retry, reopen, cancel, and restart where technically meaningful.

## 4. User-visible states

At minimum the application should be able to represent:
- parsed;
- invalid/ambiguous input;
- ready to execute;
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

State names may be refined by architecture, but the semantic distinctions must remain visible.

## 5. Non-functional requirements

### NFR-01 Safety/correctness
False-positive selection is more severe than a false-negative safe failure. Matching policies should therefore favor precision over recall.

### NFR-02 Determinism
Parsing, normalization, plan construction, and matching rules should be deterministic and unit-testable wherever possible.

### NFR-03 Testability
Core logic and adapter behavior must be testable with sanitized local/mock fixtures. Live bookmaker interaction must not be required for the majority of automated tests.

### NFR-04 Extensibility
Bookmaker-specific behavior must stay behind a common adapter contract. Notification transport must remain separate from parsing/domain logic.

### NFR-05 Observability
Errors and matching evidence should be diagnosable without logging credentials or unnecessary personal/session data.

### NFR-06 Reproducibility
Development, tests, browser/runtime setup, and packaging must be reproducible and automated by CI where appropriate.

## 6. Explicit exclusions from MVP

NotifyHandler will not:
- discover surebets itself;
- calculate bankroll strategy or choose stakes automatically;
- enter stakes;
- submit/confirm/place bets;
- make deposits/withdrawals;
- capture/store/enter bookmaker credentials;
- automate MFA/CAPTCHA;
- bypass access controls, anti-bot measures, rate limits, or geo restrictions;
- scrape/automate a bookmaker where the chosen integration method is not permitted.

## 7. MVP acceptance scenario

Given a valid notification containing a recommended pair such as SISAL OVER 11.5 and BET365 UNDER 11.5 for a specific event and U/O CORNER 11.5 market:

- the user sees the correctly normalized notification;
- the user selects that recommended pair;
- the application displays both exact targets before execution;
- each adapter opens or navigates to the target context;
- event, market, line, outcome and displayed odds are checked independently;
- a leg is selected only after all identity checks pass;
- changed odds are reported, not silently substituted;
- ambiguity causes an explicit safe failure with no uncertain click;
- any login step is manual;
- stake entry and final submission are manual;
- final state clearly identifies whether each leg is prepared or failed.

## 8. Success metrics for MVP

Initial product quality should be evaluated using deterministic fixture/regression suites rather than click-through volume. Key metrics include:
- zero known wrong-event/market/line/outcome selections in the regression suite;
- 100% explicit failure for defined ambiguous near-match fixtures;
- complete parser coverage for the agreed initial notification schema;
- explicit user-visible status for every terminal leg state;
- automated tests proving transaction-boundary capabilities are absent/blocked.
