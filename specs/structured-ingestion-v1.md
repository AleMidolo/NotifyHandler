# Structured direct-pair ingestion v1

Status: **Accepted architecture contract for Milestone 6**

This specification defines the first machine-to-machine structured notification protocol for NotifyHandler. It complements, and does not replace, the legacy textual notification format in `specs/notification-format.md`.

The protocol is intentionally narrow: one message describes one explicit two-leg surebet pair and provides one direct bookmaker match-page link for each leg.

## 1. Protocol identifier

A request payload must declare:

```json
{
  "schemaVersion": "notifyhandler.direct-pair.v1"
}
```

Unknown schema versions are rejected. Version negotiation, implicit upgrades, and heuristic interpretation are out of scope.

## 2. Payload

Conceptually:

```ts
type DirectPairNotificationV1 = Readonly<{
  schemaVersion: "notifyhandler.direct-pair.v1";
  notificationId: string;
  sentAt: string; // ISO-8601 UTC
  event: {
    participantA: string;
    participantB: string;
    competition?: string;
    scheduledAt?: string; // ISO-8601 with offset when supplied
    sourceDisplay?: string;
  };
  market: {
    family: string;
    context?: string;
    period: "full_match";
    line?: string; // canonical decimal string when line-based
    sourceLabel?: string;
  };
  legs: readonly [
    DirectPairLegV1,
    DirectPairLegV1
  ];
}>;

type DirectPairLegV1 = Readonly<{
  bookmaker: BookmakerId;
  outcome: string;
  expectedOdds: string; // canonical decimal odds
  deepLink: string;     // required direct match-page URL
}>;
```

The initial production target is pre-match football full-match total-corners over/under, but the protocol is versioned so future market families can be added deliberately rather than inferred.

## 3. Core invariants

A v1 payload is executable only when all of the following are true:

- `schemaVersion` is exactly supported;
- `notificationId` is present, bounded, and valid for idempotency use;
- `sentAt` is valid and within the configured freshness window;
- event identity contains two non-empty distinguishable participants;
- the market is supported and all market-required fields are present;
- exactly two legs are present;
- the two legs resolve to distinct supported canonical bookmakers;
- each leg has an explicit outcome/side, expected decimal odds, and direct match link;
- each direct link passes pre-navigation validation;
- no required field has multiple plausible interpretations.

The pair in `legs` is authoritative for v1. There is no `recommendedOptions` array, no recommendation chooser, no fallback to another pair, and no user confirmation before execution.

## 4. Normalization boundary

Structured ingress must not create a second browser/orchestration architecture.

The structured validator converts a valid v1 payload into the same bookmaker-agnostic immutable execution semantics used elsewhere:

```text
DirectPairNotificationV1
        |
        v
structured validator / normalizer
        |
        v
exactly two SelectionTarget values
        |
        v
ExecutionPlan
        |
        v
existing two-leg orchestration / worker / adapter contracts
```

Legacy textual input continues to use the parser and source-order primary-recommendation rule defined in `specs/notification-format.md`.

The two ingestion paths converge before worker execution.

## 5. Direct-link semantics

For v1, `deepLink` is required for each leg and is the preferred initial navigation target.

A deep link is **untrusted navigation input**, not matching evidence.

Its presence does not prove:

- event identity;
- competition or scheduled-time context;
- market family/context;
- exact numeric line;
- requested side/outcome;
- displayed odds;
- authentication state.

All of those dimensions remain subject to the existing deterministic matching policy after navigation.

### 5.1 Pre-navigation validation

Before any browser process navigates, the application/worker boundary must reject a link unless:

1. it parses as a URL;
2. scheme is exactly `https:`;
3. username and password components are empty;
4. origin exactly matches an origin registered for the selected bookmaker adapter;
5. hostname is not loopback, link-local, multicast, or private/internal by literal address;
6. DNS resolution used for navigation contains no loopback, link-local, private/internal, or otherwise forbidden target address;
7. the target is not `file:`, `data:`, `javascript:`, browser-internal, extension, or another executable/custom scheme;
8. notification-controlled data is not used to form shell commands or arbitrary browser-evaluation source.

Validation is defense-in-depth: ingestion preflight validates the candidate, and the browser gateway validates again immediately before navigation.

### 5.2 Redirect/final-origin policy

Redirects do not inherit trust from the original URL.

Every top-level redirect/final location must be revalidated. Cross-origin navigation is accepted only when the exact final origin is explicitly registered for that bookmaker flow; otherwise execution stops with a structured safe failure.

A redirect or cross-document navigation invalidates positive matching evidence and advances the evidence epoch before any later selection activation.

### 5.3 No generic-discovery fallback for v1

If the direct match link is malformed, blocked, stale, wrong-event, unsupported, or cannot expose enough deterministic evidence, the v1 leg fails safely.

The system must not silently fall back to generic bookmaker homepage/competition discovery for that structured request. Such fallback would hide an invalid authoritative input, increase latency, and make result interpretation ambiguous.

Legacy textual behavior remains governed by its existing adapter/navigation contract.

## 6. Local HTTP ingress

The desktop application may expose a dedicated local HTTP endpoint for this protocol.

### 6.1 Network binding

Default binding is loopback only:

- IPv4: `127.0.0.1`;
- IPv6 may be supported only by an explicit separate `::1` listener/configuration.

The server must not bind `0.0.0.0`, a LAN interface, or an Internet-facing interface by default.

Remote ingress, reverse proxies, tunnels, cloud relays, and public webhook exposure require a separate architecture/security decision.

### 6.2 Endpoint

Conceptual endpoint:

```text
POST /api/v1/notifications/direct-pair
```

The exact port may be application-configured, but the listener authority is local-only.

Only `POST` is allowed for ingestion. State-changing ingestion must not be exposed as `GET`.

### 6.3 Authentication

Every request requires a local bearer capability:

```http
Authorization: Bearer <local-ingress-token>
```

Requirements:

- token is generated from at least 256 bits of cryptographically secure randomness;
- token is never accepted in query parameters, URL fragments, request body fields, or logs;
- token is stored with user-only local permissions or OS credential storage where available;
- renderer/browser content never receives the token;
- comparison is constant-time where practical;
- rotation is supported without changing the protocol payload;
- missing/invalid authentication is rejected before body processing beyond bounded transport necessities.

This token authenticates local callers to the ingress surface. It does not authenticate to any bookmaker and must never be reused as a bookmaker/session credential.

### 6.4 Browser-origin requests / CORS

The v1 endpoint is intended for local machine-to-machine callers, not arbitrary web pages.

Default policy:

- no permissive CORS headers;
- reject requests carrying an unexpected `Origin` header;
- validate the `Host` header against the configured loopback authority;
- do not support JSONP, form-encoded fallback, or browser-friendly unauthenticated modes.

A browser-based sender requires a separately reviewed policy.

## 7. Request bounds and media type

Initial limits:

- `Content-Type` must be `application/json` (UTF-8);
- maximum request body size: **64 KiB**;
- JSON depth/collection sizes must be bounded by the schema;
- unknown top-level fields may be rejected in strict mode to prevent accidental protocol drift;
- oversized bodies are rejected before full buffering when the HTTP framework permits.

These are protocol ceilings, not targets; normal payloads should be much smaller.

## 8. Freshness, replay, and idempotency

### 8.1 Freshness

`sentAt` is required and normalized to UTC.

Default acceptance window:

- no more than 5 minutes older than the local application clock;
- no more than 60 seconds in the future.

Freshness rejection happens before browser navigation.

The window is configuration owned by the core/security layer and may be tightened, but weakening it requires review.

### 8.2 Idempotency key

`notificationId` is the idempotency key.

Requirements:

- opaque ASCII/UUID-like value, 1-128 characters;
- not interpreted as a filename, URL, command, or database key without encoding;
- retained only as needed to suppress duplicate execution.

The application stores a bounded idempotency record for at least the freshness/retry horizon and preferably 24 hours. The record should contain a hash of the normalized payload plus the resulting execution identifier/status reference, not the full sensitive payload.

### 8.3 Duplicate semantics

For the same authenticated caller/token scope:

- same `notificationId` + same normalized payload hash => do not start a second execution; return the original/same execution reference with `duplicate: true`;
- same `notificationId` + different normalized payload hash => reject with idempotency conflict;
- expired idempotency records may be evicted according to bounded retention policy.

Idempotency does not weaken cancellation or stale-attempt rules inside an already-created execution.

## 9. Rate and abuse bounds

The local endpoint must have bounded request concurrency and rate limiting.

A reasonable initial default is a small burst with an order-of-tens requests/minute sustained ceiling, configurable for the upstream bot's legitimate rate.

When limits are exceeded, requests fail before execution creation. The implementation must not queue an unbounded number of browser starts.

Security owns final concrete thresholds and regression tests.

## 10. HTTP response semantics

The transport returns only sanitized machine-readable metadata.

Recommended status mapping:

- `202 Accepted` — new valid notification accepted and execution created;
- `202 Accepted` with `duplicate: true` — exact duplicate already accepted;
- `400 Bad Request` — malformed JSON/schema syntax;
- `401 Unauthorized` — missing/invalid local bearer token;
- `403 Forbidden` — invalid local Host/Origin/network policy;
- `409 Conflict` — reused idempotency key with different payload;
- `413 Payload Too Large` — request size limit exceeded;
- `415 Unsupported Media Type` — not JSON;
- `422 Unprocessable Entity` — semantically invalid/unsupported notification;
- `429 Too Many Requests` — local rate/concurrency limit;
- `503 Service Unavailable` — application not ready to create executions.

A successful response may conceptually contain:

```json
{
  "accepted": true,
  "duplicate": false,
  "notificationId": "…",
  "executionId": "…"
}
```

Responses must not echo the bearer token, full deep links, cookies, bookmaker session state, or raw notification text.

## 11. Automatic start semantics

For a newly accepted valid v1 request:

1. authenticate and bound the HTTP request;
2. validate schema/freshness/idempotency;
3. normalize event, market, and both explicit legs;
4. validate distinct supported bookmakers and direct-link candidates;
5. construct exactly two immutable `SelectionTarget` values;
6. create one immutable `ExecutionPlan`;
7. atomically register the idempotency/execution association;
8. start both legs automatically, preferably concurrently;
9. return the accepted execution reference without waiting for bookmaker preparation to finish.

No renderer acknowledgement, pair choice, or start button is part of this path.

## 12. Interaction with execution states

The existing state machine remains authoritative.

### Manual authentication

If direct-link navigation reaches an authentication boundary:

- leg enters `AUTH_REQUIRED`;
- user authenticates manually in the visible bookmaker browser;
- resume creates fresh evidence;
- worker revalidates current origin;
- if necessary, worker may reopen the same immutable validated direct link;
- event/market/line/outcome/odds are re-verified from scratch.

No credentials/MFA/CAPTCHA values enter the protocol or application.

### Odds change

`ODDS_CHANGED` behavior is unchanged. Acknowledgement is post-start, bound to the exact observed value, and followed by full revalidation.

### Cancellation

Cancellation invalidates the current attempt. No later redirect, resume, duplicate HTTP request, or stale browser callback may reactivate the cancelled attempt.

A duplicate HTTP request for an already-created execution returns the existing execution reference rather than creating a replacement attempt.

## 13. SelectionActivationGate

Direct-link startup does not bypass or modify the final activation gate.

Selection activation remains permitted only when the current attempt/evidence epoch has:

- approved current origin;
- matched event identity;
- matched market/context;
- matched exact line when required;
- matched requested outcome;
- satisfied current odds policy;
- no cancellation/staleness condition.

Post-click selected-state verification remains required before `READY_FOR_USER`.

## 14. Diagnostics/privacy

Permitted ingress diagnostics:

- schema version;
- internal execution/notification hash identifier;
- rejection/error code;
- bookmaker IDs;
- sanitized origin/path category;
- request size/timing;
- duplicate/idempotency outcome.

Do not log:

- bearer token or Authorization header;
- full raw request body by default;
- URL userinfo/query/fragment secrets;
- cookies/browser storage/auth headers;
- bookmaker credentials/MFA values;
- account/session data.

## 15. Backwards compatibility

Legacy textual notification support remains valid.

Legacy path:

```text
text -> legacy parser -> ordered recommendedOptions -> index 0 primary -> two SelectionTargets -> ExecutionPlan
```

Structured v1 path:

```text
JSON direct pair -> v1 validator -> explicit two legs -> two SelectionTargets -> ExecutionPlan
```

Both paths converge before worker execution and use the same matching, browser, odds, authentication, cancellation, and transaction boundaries.

## 16. Required tests

Application/Security/QA should cover at least:

- valid authenticated loopback request auto-starts exactly two legs;
- text input still follows legacy first-recommendation behavior;
- non-loopback binding/configuration is rejected by default;
- missing/invalid bearer token yields no execution/navigation;
- unexpected Origin/Host yields no execution/navigation;
- wrong media type/malformed JSON/oversized payload yields no execution/navigation;
- stale/future `sentAt` yields no execution/navigation;
- exact duplicate returns original execution without a second start;
- same id + changed payload yields conflict;
- same-bookmaker/unsupported bookmaker pair is rejected;
- unsafe/credential-bearing/off-origin direct URL is rejected;
- direct URL that opens the wrong event fails matching rather than being trusted;
- redirect to unapproved origin fails safely;
- direct-link failure does not trigger generic-discovery fallback;
- manual login resume revalidates the direct-link target;
- changed odds, cancellation, stale events, and activation-gate regressions remain unchanged;
- no credentials, MFA/CAPTCHA, stake, wager-submit, private-API, or bypass capability is introduced.
