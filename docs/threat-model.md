# Threat model

This threat model is the security baseline for NotifyHandler. It applies to notification ingestion, parsing, application orchestration, bookmaker adapters, the local browser runtime, diagnostics, CI, packaging, and release review.

NotifyHandler is intentionally limited to navigation, deterministic target verification, and activation of the requested bookmaker selection. Authentication, stake entry, transaction review, and wager submission remain manual user actions.

## Assets to protect

- Bookmaker credentials, MFA/OTP values, password-manager contents, cookies, session tokens, and authorization headers.
- The integrity of the requested event, market, line, side/outcome, expected odds, and bookmaker identity.
- The user's bookmaker session and browser profile data.
- The transaction boundary: no automatic stake entry, funding, cash-out, wager confirmation, or wager submission.
- Local host integrity, including prevention of arbitrary file/internal-network navigation and command execution.
- Diagnostic artifacts and logs, which must not become a secondary store of secrets or unnecessary personal data.
- Build and release integrity.

## Trust boundaries

### Notification input

Notification text, URLs, bookmaker labels, expected odds, and any future transport metadata are untrusted. Parsing is not authorization to navigate or click.

Controls:
- deterministic parsing and validation;
- reject malformed or ambiguous primary recommendations before browser startup;
- deep links are re-validated by the bookmaker adapter/browser boundary;
- no notification-controlled shell commands, file paths, script execution, or browser-evaluation source.

### Application to bookmaker adapter

Selection targets are normalized internal data, but adapters must still treat them as untrusted because they originate from external notifications.

Controls:
- bookmaker identity must match the adapter;
- only adapter-declared supported HTTPS origins may be opened;
- URL userinfo/embedded credentials are forbidden;
- redirects and meaningful navigation invalidate prior matching evidence;
- adapters fail safely instead of substituting another event/market/line/outcome.

### Adapter to browser runtime

The browser runtime is a privileged capability boundary. Adapters receive only the minimum operations required to navigate, query approved page evidence, and activate a verified selection.

Controls:
- `openAllowed` is the only untrusted-input navigation entry point;
- navigation must reject non-HTTPS schemes, unapproved origins, credential-bearing URLs, local files, loopback/internal targets, and unsupported redirects;
- browser contexts must not expose password-manager APIs, credential stores, arbitrary filesystem access, raw DevTools endpoints, or unrestricted script execution to notification-controlled data;
- unrelated bookmaker sessions should not share mutable page state unless the architecture explicitly documents the isolation rationale.

### Bookmaker page content

Bookmaker DOM, script state, redirects, labels, and displayed odds are untrusted runtime evidence. A compromised page or unexpected page state must not expand application capabilities.

Controls:
- exact deterministic identity checks for event, market, line, and outcome;
- origin re-check after navigation/redirect and after manual authentication resume;
- stale evidence cannot authorize a later click;
- selection activation is routed through the restricted activation gate;
- no generic "click arbitrary selector" API is exposed to higher layers.

### Manual authentication boundary

Authentication is a user-only phase.

Controls:
- NotifyHandler must not request, read, store, transmit, autofill, or log credentials, MFA/OTP values, recovery codes, or security answers;
- CAPTCHA and anti-bot challenges must not be solved or bypassed;
- after manual login, page origin and selection evidence are revalidated before any activation.

### Local control surfaces

The structured v1 ingress is now a concrete local HTTP control surface. It is security-sensitive even though it binds only to the local machine.

Controls:
- bind the production listener only to `127.0.0.1`; there is no configurable LAN/WAN bind address;
- require a 256-bit base64url bearer capability before parsing the request body;
- store the bearer token in the Electron user-data directory with mode `0600` on POSIX and a current-user-only Windows ACL; ACL hardening fails closed;
- support explicit token rotation without changing the notification protocol;
- require the exact configured loopback `Host`, reject any browser `Origin`, and emit no permissive CORS policy;
- accept only POST + JSON, cap the body at 64 KiB, and bound request rate/concurrency;
- validate freshness and idempotency before creating browser work;
- persist a 24-hour, bounded, current-user-only idempotency tombstone containing only notification id, normalized payload hash, deterministic execution id, timestamp, and pending/accepted state;
- fsync the pending tombstone before execution startup; recovered tombstones from an earlier process block automatic replay rather than recreating browser work;
- fail closed before listener startup on corrupt, oversized, future-dated, duplicate-key, or otherwise invalid durable idempotency state; evict expired tombstones;
- return sanitized execution/error metadata only; never echo Authorization, token, full request bodies, or deep links;
- do not expose generic browser-evaluation, shell, filesystem, credential, or transaction APIs;
- remote webhook exposure, tunnels, reverse proxies, or public listeners remain out of scope and require a new architecture/security decision.

Residual boundary: the local bearer is intended to be readable by the cooperating local sender running as the same OS user. It is not a defense against malware or another fully compromised process already running as that user. Rotation limits credential lifetime after suspected disclosure, but host compromise remains outside this capability's protection model.

## Primary threats and required mitigations

### Malicious notification input

Threats include script/command injection, malformed URLs, credential-bearing URLs, path traversal strings, oversized input, confusing Unicode, duplicate bookmaker legs, and targets crafted to exploit permissive matching.

Mitigations:
- parse as data only;
- reject unsupported schemes/origins and URL userinfo;
- never interpolate notification values into shell commands or executable browser scripts;
- keep deterministic match dimensions separate;
- enforce exactly two distinct bookmaker legs for the primary option;
- bound future transport/request sizes at ingestion.

### Malicious redirect and relay content

Threat: an approved direct link or bet-up relay redirects to another origin, abuses same-origin redirects as an open-redirect/crawling surface, changes signal/bookmaker identity mid-chain, reaches a login phishing page/local service/unsupported scheme, or a compromised relay page attempts subresource requests against loopback/private/internal services.

Mitigations:
- check final/current origin before matching;
- direct-bookmaker redirects remain constrained by the existing bookmaker navigation policy;
- typed bet-up relay navigation permits only GET top-level requests: the exact validated relay URL, at most one additional GET visit to that exact same canonical URL, then a direct GET transition to the expected bookmaker origin; POST/form or other method-based transitions, arbitrary same-origin paths, additional revisits, intermediary and wrong-bookmaker destinations fail safely;
- relay HTTP redirects are terminated at the gateway with automatic redirect following disabled; the `Location` target is validated before any destination request and an approved target is re-issued as a fresh interceptable browser navigation;
- relay origin is re-resolved through the fail-closed private/internal DNS policy on both initial entry and the one permitted revisit; the expected-bookmaker target is independently resolved before navigation;
- while relay resolution is active, every intercepted non-top-level network request must be public HTTPS without URL credentials and must resolve only to non-private/non-internal addresses; an unsafe relay subresource aborts the request and fails the relay attempt;
- a second additional relay visit, non-canonical same-origin target, unsupported relay challenge, and unresolved timeout fail before matching or activation;
- retry/reopen re-resolve the immutable relay rather than trusting a previously resolved final URL;
- re-run origin and target validation after manual login, refresh, retry, reopen, or navigation.

### Diagnostic provenance as a covert data channel

Threat: a live-validation diagnostic that is intended to retain only sanitized provenance accidentally becomes a network/page-content exfiltration channel through destination strings, raw titles, hidden text, counts, error messages, request sequences, or unconstrained metadata.

Mitigations:
- version the passive provenance schema and reject unknown fields/enums before artifact retention;
- retain only the first finite transport trigger category and finite scope, never destination/network strings or request sequences;
- retain target DOM presence/visibility only as booleans against fixed reviewed predicates;
- reduce document title to participant-pair/competition booleans and never retain raw title;
- reduce page population to one fixed coarse bucket and discard raw counts;
- omit render provenance entirely after transport, route, auth, CAPTCHA/anti-bot, access, or consent failure;
- keep provenance outside production matching/evidence/activation interfaces;
- copy no browser/runtime/DNS exception text into artifacts;
- keep source lock, timeouts, waits, zero-interaction capability, WebSocket blocking, DNS/origin policy, and transaction boundary unchanged;
- require Security and QA approval of the exact implementation before any further live run.

### Compromised bookmaker content

Threat: hostile page content attempts to cause arbitrary clicks, credential capture, transaction submission, or misleading match evidence.

Mitigations:
- page content never gains new application capabilities;
- adapters use constrained read/query ports and a restricted selection activation gate;
- no stake-entry or wager-submission capability exists in production interfaces;
- ambiguity or contradiction produces safe failure.

### Compromised local control endpoint

Threat: another local process or malicious web page controls the browser automation service, or an authenticated sender replays a still-fresh notification after the desktop process restarts.

Mitigations:
- loopback-only binding, per-session capability authentication, Host/Origin checks, and no permissive CORS;
- state-changing endpoints are not GET requests;
- durable idempotency reservation is written before browser work and survives restart for 24 hours;
- an exact replay recovered from a previous process is blocked because browser execution state itself is not restored;
- same id with different content remains a conflict; unresolved current-process reservations fail closed;
- no endpoint may expose credentials, cookies, arbitrary navigation, arbitrary JavaScript evaluation, stake entry, or wager submission.

### Unsafe browser permissions/profile handling

Threat: automation gains access to unrelated browsing data, saved passwords, extensions, downloads, filesystem paths, microphone/camera, or other privileged browser features.

Mitigations:
- use a dedicated automation context/profile with the minimum permissions required;
- do not load unrelated browser extensions or password-manager extensions;
- do not persist storage state unless explicitly required and security-reviewed;
- never serialize cookies/session storage into logs or repository artifacts;
- disable unnecessary downloads and device permissions.

### Accidental transaction submission

Threat: a selector or future refactor activates a stake field, funding action, cash-out, or final confirmation.

Mitigations:
- structural absence of transaction methods from production ports/contracts;
- only the requested selection activation capability is exposed;
- regression tests inspect production orchestration capability surfaces;
- any introduction of stake/funding/submit/finalize APIs is a release blocker and requires Security review.

### Accidental credential capture

Threat: diagnostics, page scraping, screenshots, console logs, or future telemetry collect secrets.

Mitigations:
- do not query password/MFA fields except to identify that authentication is required without reading their values;
- redact URLs before logging: omit userinfo, sensitive query parameters, fragments, tokens, and session identifiers;
- never log cookies, authorization headers, browser storage, password-manager data, or form values from credential inputs;
- diagnostic screenshots/traces are off by default for authenticated production sessions unless a dedicated redaction policy is implemented.

## Navigation policy

For structured direct-pair links, navigation uses defense in depth: worker preflight resolves the approved hostname and fails closed if any answer is loopback, link-local, private, multicast, documentation-only, or otherwise forbidden; the live browser gateway repeats resolved-target validation immediately before top-level navigation and redirects. Fixture-only routes do not perform external DNS because they never reach the network.

Every bookmaker adapter and the browser runtime must enforce all of the following before opening notification-derived URLs:

1. URL parses successfully.
2. Scheme is exactly `https:` unless a future ADR explicitly approves another scheme.
3. Username and password components are empty.
4. Origin exactly matches an adapter-approved origin, including port semantics.
5. No `javascript:`, `data:`, `file:`, browser-internal, extension, loopback, or private/internal-network target is accepted.
6. Redirects are revalidated before matching or activation continues.
7. Navigation to authentication/account pages may result from normal bookmaker flows, but automation must not interact with credential, funding, stake, or transaction controls.

Adapters should prefer a small explicit set of canonical bookmaker origins. Broad suffix rules such as `*.example.com` require separate security review because subdomain ownership and takeover risk differ by bookmaker.

## Passive direct-page diagnostics

BOOK-024-style diagnostics are a separate non-authorizing surface and must not inherit production selection capabilities.

Controls:
- the bookmaker and full direct URL are source-locked; same-origin alternative paths/fragments are not accepted as substitutes;
- the browser runs in a fresh ephemeral context with downloads disabled and service workers blocked;
- every routed HTTP(S) request must pass public-HTTPS and fail-closed DNS/private/internal-address validation before the request is allowed to continue;
- WebSockets are not required by this diagnostic and are blocked rather than inspected or proxied;
- popups are closed and cannot create a second navigation/evidence surface;
- evidence collection is visible-text only, bounded by fixed candidate/sample/length limits, and redacts UUIDs, email-shaped values, visible URLs, and long opaque tokens;
- full DOM/page dumps, screenshots, traces, HAR, cookies, storage/session state, form values, authenticated captures, and private/protected API responses are prohibited;
- summaries hard-code `authorizesProductionMapping: false`; passive evidence cannot authorize adapter selectors, outcome activation, or bookmaker support promotion;
- retained passive-diagnostic validators must constrain both field names and values: source-locked metadata stays exact, unapproved final routes use fixed placeholders, bounded snippets are rechecked for redaction, and derived matching booleans must agree with their retained evidence;
- CLI failures use fixed sanitized text and must not echo browser/runtime errors containing direct URLs or BET365 fragment state;
- no live run is permitted until Security and QA gates explicitly approve the exact diagnostic implementation.

## Logging and privacy policy

Relay-resolution failures and worker events must not include the full relay URL or signal UUID. Relay diagnostics are limited to typed kind, normalized bookmaker id/suffix, bounded transition count, sanitized origin/path category, failure code, and optionally a one-way truncated signal hash when explicitly needed.

Permitted diagnostics include:
- normalized bookmaker ID;
- state transition and failure code;
- evidence dimension status/reason codes;
- sanitized origin and non-sensitive path category;
- expected and observed public odds where needed for troubleshooting;
- attempt/evidence identifiers that are random/internal and contain no personal data.

Prohibited diagnostics include:
- passwords, MFA/OTP values, recovery codes, security answers;
- cookies, authorization headers, bearer tokens, CSRF/session tokens;
- password-manager contents;
- full authenticated URLs when query/fragment values may contain secrets;
- unnecessary names, account identifiers, balances, payment data, or other personal data.

## Dependency and supply-chain controls

- Keep runtime dependencies minimal and pinned through `package-lock.json`.
- Use `npm ci --ignore-scripts` in CI unless a reviewed dependency explicitly requires lifecycle scripts.
- Audit production dependencies at high severity or stricter as a release gate.
- Pin third-party GitHub Actions by immutable commit SHA; comments may record the human-readable major version.
- Pin browser automation tooling/runtime versions and update them deliberately.
- Do not add packages that provide CAPTCHA bypass, credential automation, stealth/anti-detection, geo-evasion, rate-limit bypass, or wagering APIs.
- Security-sensitive dependency changes require code review and passing CI before release.

## Security release gates

A release is blocked when any known production path can:
- navigate notification input to an unsafe/unapproved origin or scheme;
- expose or automate credentials/MFA/CAPTCHA;
- bypass authentication, anti-bot, rate-limit, geo, or access controls;
- activate a selection without deterministic identity evidence;
- enter stakes, fund an account, cash out, or submit/finalize a wager;
- expose authentication/session secrets in logs, traces, screenshots, artifacts, or telemetry;
- expose an unauthenticated/non-loopback local control surface;
- depend on an unreviewed security-critical package/action change.

## Review checklist for new bookmaker adapters

- Approved origin list is explicit and HTTPS-only.
- Deep-link parser rejects malformed, cross-origin, unsafe-scheme, and credential-bearing URLs before browser navigation.
- Redirect origin is checked before matching.
- Authentication returns a manual-user state without reading credentials.
- Event/market/line/outcome ambiguity fails safely.
- Odds changes do not change target identity.
- Adapter has no stake, funding, withdrawal, cash-out, submit, or finalize methods.
- Tests cover navigation rejection, authentication pause, mismatch/ambiguity, cancellation, and transaction-boundary capability absence.
