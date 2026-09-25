# BOOK-029 — Default-deny bookmaker WSS gateway and passive-provenance.v2

Date: **2026-09-24**  
Issue: **#209**  
Architecture: **ARCH-011/#203**, ADR-0008  
Network contract: `specs/bookmaker-network-policy.md`  
Diagnostic contract: `specs/passive-diagnostic-provenance-v2.md`

## Scope

BOOK-029 implements the shared bookmaker browser-network framework for bounded WebSocket page transport.

It does **not** add a live BET365 or SISAL socket hostname.

The version-controlled live registry remains:

- SISAL exact hosts: empty;
- SISAL reviewed suffixes: empty;
- BET365 exact hosts: empty;
- BET365 reviewed suffixes: empty.

Therefore the merged framework remains default-deny until BOOK-030 or another separately reviewed task adds evidence-backed configuration.

No live bookmaker execution is part of BOOK-029.

## Gateway policy

A socket may connect only when all of these checks pass:

1. the current top-level page is already on an approved origin for the same bookmaker;
2. scheme is exactly `wss:`;
3. URL credentials are absent;
4. port is the default TLS WebSocket port (implicit or explicit 443);
5. destination is a DNS hostname, not an IP literal;
6. destination matches a source-controlled exact-host or reviewed suffix rule;
7. DNS resolves successfully and every answer is public/non-loopback/non-link-local/non-private under the existing shared network policy;
8. the current attempt is not cancelled.

Failure categories are finite:

- `BOOKMAKER_WSS_INSECURE`;
- `BOOKMAKER_WSS_UNAPPROVED`;
- `BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED`.

No observed hostname is added to policy automatically.

### Reviewed suffix boundary

BOOK-029 intentionally constrains reviewed suffix rules to a namespace containing the bookmaker's approved top-level origin. SEC-009 additionally requires the reviewed suffix to remain inside an additional source-controlled bookmaker namespace (`sisal.it` or `bet365.it`), so a multi-label public suffix such as `co.uk` cannot become an allowlisted wildcard even when the approved page origin happens to end in it.

A third-party WSS host can still be represented by an explicit reviewed exact-host rule. Any need for a changing third-party suffix requires an explicit architecture/security amendment rather than runtime discovery.

## Runtime capability boundary

Allowed WSS remains Chromium-native page transport.

The worker does not expose:

- WebSocket objects;
- socket URL/destination;
- payloads/messages;
- send/receive APIs;
- handshake metadata;
- socket-based matching evidence.

A blocked production WSS marks the browser attempt network-unsafe. Matching/navigation-control/selection activation through that attempt then fail closed.

Relay resolution remains stricter: any relay-phase WebSocket is blocked exactly as before.

Cancellation, attempt supersession, and context close are transport lifetime boundaries. The runtime tracks allowed routed sockets and actively closes them when an attempt is cancelled or replaced; a WSS DNS decision that began in an older attempt cannot connect after the attempt generation changes.

## Passive provenance v2

New target-aware passive diagnostics emit:

`diagnosticSchemaVersion: "passive-provenance.v2"`.

Transport states are finite:

- `CLEAR / NONE_OBSERVED`;
- `CLEAR / ALLOWED_REVIEWED_WSS_OBSERVED`;
- `BLOCKED / INSECURE_WEBSOCKET / SOCKET`;
- `BLOCKED / UNAPPROVED_WEBSOCKET / SOCKET`;
- `BLOCKED / WEBSOCKET_PUBLIC_TARGET_REJECTED / SOCKET`;
- existing ordinary HTTPS/protocol blocked states.

An allowed reviewed socket does not block render provenance collection.

V2 retains no socket host, URL, IP, port, path/query/fragment, headers, payload, handshake data, count, ordering, or dynamic browser/network error.

Historical `passive-provenance.v1` validation and artifacts are unchanged.

## Deterministic coverage

BOOK-029 tests cover:

- empty/default-deny live registry;
- reviewed exact-host allow;
- reviewed bookmaker-namespace suffix allow;
- suffix-confusion reject;
- unapproved public host reject;
- `ws://` reject;
- URL-credential reject;
- non-443 reject;
- IPv4/IPv6 literal reject;
- DNS failure/empty answers reject;
- private/loopback/link-local/mixed DNS answers reject;
- cancelled-attempt reject;
- production gateway closes blocked WSS;
- blocked WSS revokes matching capability;
- reviewed WSS reaches Chromium `connectToServer()` only after policy approval;
- no socket capability on the bookmaker page port;
- relay WSS regression remains blocked;
- finite/redacted passive-provenance.v2 categories;
- allowed reviewed WSS remains non-blocking diagnostic provenance;
- first blocked transport trigger wins;
- historical v1 artifact validation remains unchanged.

## Downstream gate

BOOK-029 itself authorizes no live re-test and no live hostname rule.

After the full ARCH-010/011 implementation set is integrated:

1. SEC-009/#211 reviews odds migration and WSS boundary.
2. QA-008/#212 certifies deterministic/browser/privacy/packaging regressions.
3. BOOK-030/#210 may run only the Security-approved controlled hostname-evidence procedure.
4. An evidence-backed BET365 host rule still requires explicit Security approval before any BET365 render re-test.
