# Safety boundaries

NotifyHandler automates navigation and selection preparation only. This document defines non-negotiable product boundaries that apply to architecture, implementation, tests, and releases.

## 1. Allowed automation

NotifyHandler may:
- accept and parse a surebet notification;
- normalize event/market/outcome/bookmaker information;
- open permitted bookmaker pages or supplied deep links;
- navigate within a bookmaker site using permitted browser interaction;
- locate and verify an event, market, line, and outcome;
- read displayed odds and compare them with expected odds;
- select/click the requested outcome when identity checks pass;
- report login-required, mismatch, changed-odds, or failure states;
- leave the prepared browser/session state for the user.

## 2. Prohibited transaction automation

NotifyHandler must not:
- enter, change, calculate, or confirm stakes in bookmaker bet slips;
- click submit/place/confirm/finalize bet controls;
- accept terms on behalf of the user where acceptance authorizes a transaction;
- initiate deposits, withdrawals, transfers, cash-outs, or other financial actions;
- automatically recover from a failed target by choosing a different betting selection.

The final transaction decision and action are always manual.

## 3. Authentication boundary

NotifyHandler must not:
- request or capture bookmaker passwords;
- read password-manager secrets;
- store or transmit credentials;
- automate credential entry;
- automate MFA/OTP/security-question flows;
- solve or bypass CAPTCHA;
- circumvent login restrictions.

If authentication is required, the system pauses for manual user action and resumes only after re-validation of page context.

## 4. Access-control and anti-bot boundary

Adapters must use permitted access methods and normal browser interactions. They must not bypass or defeat:
- authentication/access controls;
- CAPTCHA or bot challenges;
- rate limits;
- geo restrictions;
- paywalls or protected APIs;
- technical measures intended to prevent automated access.

If a bookmaker does not permit or technically support the intended interaction safely, mark the integration unsupported/blocked rather than adding bypass behavior.

## 5. Matching boundary

No selection may be clicked unless required identity checks have passed.

At minimum, adapters must separately reason about:
- event identity;
- market family;
- exact line/threshold where applicable;
- side/outcome identity.

A nearby event, similarly named market, neighboring line, translated alias, or visually adjacent outcome is not sufficient by itself.

If evidence is ambiguous or contradictory, return `failed safely` with structured reason/evidence and do not click.

## 6. Odds boundary

Expected odds from the source notification are immutable input evidence. Observed odds are live page evidence. Keep both values.

An odds change must never cause the system to select a different event/market/line/outcome. Odds policy may determine whether an otherwise verified target is still prepared, but the change must remain visible to the user.

## 7. Navigation and URL safety

Notification content is untrusted input. Deep links must be validated before navigation.

The architecture/security design should:
- allow only supported bookmaker origins/schemes;
- reject javascript/data/file or other unsafe schemes unless explicitly justified;
- avoid arbitrary local-file or internal-network navigation;
- treat redirects and cross-origin changes as evidence requiring re-validation.

## 8. Browser/session isolation

The architecture should minimize exposure of personal/session data and avoid sharing unrelated browser context. Bookmaker sessions should be isolated as needed so one adapter cannot accidentally operate on another bookmaker's page/state.

## 9. Logging/privacy

Logs should contain only data necessary for diagnosis. Do not log credentials, MFA values, authentication tokens, full session cookies, or unnecessary personal information.

Prefer normalized matching evidence, state transitions, error codes, sanitized URLs/origins, and redacted diagnostics.

## 10. Failure and recovery

Safe failure is a successful product outcome when identity cannot be established.

Retries must re-run relevant validation. A stale prior match must not authorize a later click after page navigation, login, redirect, refresh, or meaningful DOM/state change.

## 11. Release gates

A release is blocked if any known path can:
- click a candidate after an ambiguous event/market/line/outcome match;
- automate credential/MFA/CAPTCHA handling;
- enter stakes or submit/confirm a bet;
- bypass access controls or anti-bot/geo/rate-limit restrictions;
- navigate untrusted input to unsafe/unapproved origins;
- expose sensitive authentication/session data in logs or artifacts.

QA and Security should maintain automated tests/checklists covering these gates.
