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

Notification content, direct links, relay links, redirects, and resolved destinations are untrusted.

### Direct bookmaker navigation

Direct candidates require:

- HTTPS;
- empty URL userinfo;
- exact adapter-approved bookmaker origin;
- fail-closed DNS/private/internal target validation;
- redirect/final-origin revalidation.

### Bet-up relay navigation

V2 relay support is limited to the reviewed upstream shape:

```text
https://www.bet-up.it/lnk/<signal-uuid>/<bookmaker-suffix>
```

Required controls:

- exact `https://www.bet-up.it` origin;
- no userinfo, query, or fragment;
- exact UUID/suffix path grammar;
- suffix must map exactly to and agree with the target leg bookmaker;
- when both legs are relays, signal UUIDs must agree;
- relay and expected-bookmaker targets must pass fail-closed DNS/private/internal checks;
- HTTP redirect responses from the relay must not be auto-followed by the browser: the gateway obtains the first response with redirects disabled, validates its `Location` before any destination request, and only then initiates a fresh controlled browser navigation;
- while relay resolution is active, non-top-level browser requests are intercepted too: only public HTTPS targets without URL credentials and without private/internal DNS answers are permitted; an unsafe relay subresource fails the relay attempt;
- the only approved cross-origin relay transition is directly to an origin registered for the expected bookmaker;
- before that cross-origin transition, at most one additional top-level visit to the exact same canonical `/lnk/<same-uuid>/<same-suffix>` relay URL is allowed;
- a different same-origin relay path/UUID/suffix/query/fragment, a second extra relay visit, unexpected intermediary, or wrong-bookmaker destination fails safely;
- relay revisits are bounded by a fixed non-configurable additional-hop budget of exactly one; retries reset to a fresh attempt rather than increasing that budget;
- relay-origin auth/CAPTCHA/consent challenges fail safely rather than being automated or handed off as bookmaker login;
- successful relay resolution contributes zero event/market/line/outcome/odds evidence.

After expected-bookmaker arrival, normal bookmaker origin/evidence policies resume in a fresh evidence epoch.

A previously resolved final URL is not cached as trusted input for retry/reopen.

### Structured local-ingress safety

The local machine-to-machine endpoint remains a privileged control surface even though it binds loopback.

ARCH-004/SEC hardening controls remain mandatory: loopback-only binding by default, local bearer capability, strict JSON/body bounds, Host/Origin checks, bounded freshness/idempotency/rate/concurrency, restart-safe replay protection, and zero navigation on rejected ingress.

Remote/public exposure requires a separate reviewed architecture.

## 8. Browser/session isolation

The architecture should minimize exposure of personal/session data and avoid sharing unrelated browser context. Bookmaker sessions should be isolated as needed so one adapter cannot accidentally operate on another bookmaker's page/state.

## 9. Logging/privacy

Logs should contain only data necessary for diagnosis. Do not log credentials, MFA values, bookmaker authentication tokens, the local-ingress bearer token/Authorization header, full session cookies, raw structured notification bodies by default, or unnecessary personal information.

Prefer normalized matching evidence, state transitions, error codes, sanitized URLs/origins, relay navigation kind/hop count, hashed/truncated relay signal identifiers where needed, and redacted diagnostics. Do not log full relay URLs or signal UUIDs by default.

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
- allow a relay through an unreviewed intermediary or wrong-bookmaker destination;
- treat same-origin as sufficient authorization for an arbitrary `bet-up.it` path;
- make the relay same-origin hop budget user-configurable or auto-increase it after failure;
- treat relay path/suffix/redirect success as positive selection identity evidence;
- expose the structured ingress on non-loopback interfaces by default or accept it without required local authentication/request bounds;
- expose sensitive authentication/session data in logs or artifacts;
- allow relay-page subresources to reach loopback/private/internal network targets;
- omit relay-resolution security regressions from the pinned-browser CI gate.

QA and Security should maintain automated tests/checklists covering these gates.
