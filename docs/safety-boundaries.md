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

Notification content and direct match links are untrusted input.

Before any notification-derived bookmaker navigation:

- URL must parse successfully and use exactly `https:`;
- URL username/password components must be empty;
- origin must exactly match an adapter-approved bookmaker origin;
- literal or resolved loopback/link-local/private/internal targets are rejected;
- unsafe/browser-internal/local-file/custom executable schemes are rejected;
- redirects and final origins are revalidated;
- navigation/redirect invalidates matching evidence that may have become stale.

A direct match link is never evidence that the page contains the requested event/market/line/outcome.

For `notifyhandler.direct-pair.v1`, each direct link is required and authoritative as the navigation candidate. Unsafe, stale, wrong-event, or insufficient links fail safely; the system must not silently switch to homepage/competition discovery.

## 7.1 Structured local-ingress safety

The local machine-to-machine endpoint is a privileged control surface even though it binds loopback.

Required controls:

- loopback-only binding by default;
- unguessable local bearer capability, never in URL/body/renderer/logs;
- strict JSON media type and 64 KiB request ceiling;
- Host validation and rejection of unexpected browser Origin requests/no permissive CORS;
- bounded freshness, idempotency, request concurrency, and rate;
- rejected ingress produces zero bookmaker navigation;
- duplicate ingress cannot create duplicate execution;
- no endpoint exposes arbitrary navigation, JavaScript evaluation, filesystem/shell access, credentials, stake entry, or wager submission.

Remote/public exposure requires a separate reviewed architecture.

## 8. Browser/session isolation

The architecture should minimize exposure of personal/session data and avoid sharing unrelated browser context. Bookmaker sessions should be isolated as needed so one adapter cannot accidentally operate on another bookmaker's page/state.

## 9. Logging/privacy

Logs should contain only data necessary for diagnosis. Do not log credentials, MFA values, bookmaker authentication tokens, the local-ingress bearer token/Authorization header, full session cookies, raw structured notification bodies by default, or unnecessary personal information.

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
- expose the structured ingress on non-loopback interfaces by default or accept it without required local authentication/request bounds;
- expose sensitive authentication/session data in logs or artifacts.

QA and Security should maintain automated tests/checklists covering these gates.
