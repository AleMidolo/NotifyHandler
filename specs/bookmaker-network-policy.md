# Bookmaker browser network policy

Status: **Accepted architecture contract for Milestone 6**

This specification defines browser network permissions that are broader than top-level navigation but narrower than unrestricted browser networking.

It is normative for worker/browser-gateway implementations.

## 1. Principle

Normal bookmaker pages may use HTTPS subresources and WebSockets as part of ordinary browser rendering.

Network transport is not bookmaker selection evidence.

The browser gateway may permit only network destinations that are both:

1. technically safe under fail-closed public-network validation; and
2. explicitly authorized by version-controlled bookmaker policy.

Notification/user input never creates network allow rules.

## 2. Policy ownership

Each bookmaker adapter/runtime registration has a version-controlled network policy.

Conceptually:

```ts
type BookmakerNetworkPolicy = Readonly<{
  bookmaker: BookmakerId;
  topLevelOrigins: readonly HttpsOrigin[];
  websocket: Readonly<{
    exactHosts: readonly string[];
    reviewedHostSuffixes: readonly string[];
  }>;
}>;
```

The registry belongs to trusted application source/configuration reviewed with the bookmaker integration.

It must not be populated from:

- notification URLs;
- page DOM/script content;
- redirect destinations;
- upstream relay metadata;
- user-entered hostnames;
- runtime-discovered socket destinations.

## 3. Allowed WebSocket transport

A bookmaker WebSocket may be established only when **all** conditions pass:

1. current top-level page is already on an approved origin for the same bookmaker;
2. URL scheme is exactly `wss:`;
3. URL username/password are empty;
4. destination uses default TLS WebSocket port 443 (explicit `:443` is equivalent);
5. destination hostname is a DNS name, not an IP literal;
6. hostname matches the selected bookmaker's reviewed WebSocket host policy;
7. current DNS resolution succeeds, every resolver result is a syntactically valid IP address, and every accepted answer is public/non-loopback/non-link-local/non-private/non-internal under the shared resolved-target policy;
8. the browser session/attempt is current and not cancelled.

`ws://` is never permitted.

A separate architecture/security review is required before allowing non-443 WSS.

## 4. Host matching

The narrowest policy is preferred.

### Exact host

An exact host rule matches one canonical lowercase DNS hostname.

### Reviewed suffix

A suffix rule may be used only when a bookmaker demonstrably uses changing subdomains under a reviewed bookmaker-controlled namespace.

For a suffix `bet365.it`, valid matching is:

- exact `bet365.it`; or
- a hostname ending in `.bet365.it`.

String suffixes such as `evilbet365.it` do not match.

Rules:

- suffixes must be explicitly version controlled per bookmaker;
- a suffix must not be a public suffix/TLD;
- wildcard `*` syntax is not accepted as runtime input;
- there is no automatic rule that every subdomain of the current page origin is trusted;
- third-party CDN/telemetry hosts require an explicit exact/suffix rule if they are genuinely necessary.

## 5. Relay phase

The WSS permission in this specification applies only after the browser is operating on an approved bookmaker origin.

During `BETUP_RELAY` resolution:

- WebSockets remain unsupported/blocked;
- the finite relay-navigation policy remains unchanged;
- no relay page may expand the selected bookmaker's network policy.

## 6. Payload boundary

Allowed WSS is **browser-native page transport only**.

NotifyHandler must not expose socket objects/messages to:

- core;
- renderer;
- bookmaker adapter public API;
- matching policy;
- SelectionActivationGate.

The application must not:

- inspect payloads for event/market/line/side/odds evidence;
- record socket payloads;
- reverse-engineer protected/private APIs from socket traffic;
- send application-authored socket messages;
- use sockets for credentials, MFA/CAPTCHA, stake, betslip, payment, or wager submission.

Chromium/page scripts may use the socket as they normally would in a headed browser, subject to browser/session isolation.

## 7. Unsafe/unapproved socket behavior

A socket is blocked when any policy check fails.

Normative categories:

- `BOOKMAKER_WSS_INSECURE` — `ws://` or otherwise non-TLS socket scheme;
- `BOOKMAKER_WSS_UNAPPROVED` — WSS host/port not in the bookmaker's reviewed policy;
- `BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED` — DNS/public-target validation failed or was uncertain.

For production execution, an unsafe/unapproved socket attempt is a safe browser/network failure for that attempt; matching/activation must not proceed on a page whose required network behavior violated policy.

The system must not automatically add the observed destination to the allowlist.

## 8. Redirect/handshake uncertainty

If Chromium or the gateway cannot determine/validate the actual destination of a WebSocket handshake or any redirect/upgrade destination before permitting the connection, fail closed.

Any destination reached through WebSocket handshake redirection must independently satisfy the same bookmaker-scoped WSS policy.

## 9. Session, cancellation, and evidence

Allowed WSS:

- is scoped to the isolated browser context for one leg;
- ends when that context/attempt is closed;
- must not survive retry/reopen into another context;
- does not increment or repair matching evidence;
- does not by itself advance the evidence epoch;
- must be terminated by normal context cleanup/cancellation.

## 10. Diagnostics

Routine diagnostics may retain only finite source-controlled state such as:

- no socket observed;
- reviewed WSS allowed;
- insecure WSS blocked;
- unapproved WSS blocked;
- WSS public-target validation blocked.

Do not retain:

- socket URL;
- host;
- IP;
- port;
- path/query/fragment;
- Origin header;
- cookies/auth headers;
- payload/message data;
- handshake response data;
- dynamic browser/network error text.

## 11. Required tests

Shared browser-gateway tests must cover:

1. reviewed exact-host public `wss://` allowed;
2. reviewed suffix subdomain public `wss://` allowed;
3. suffix-confusion host rejected;
4. unapproved public WSS rejected;
5. private/loopback/link-local WSS rejected;
6. DNS uncertainty rejected;
7. `ws://` rejected;
8. non-443 WSS rejected;
9. IP-literal WSS rejected;
10. relay-origin WSS remains rejected;
11. cancellation/context close terminates socket transport;
12. allowed WSS emits zero matching evidence;
13. no raw socket payload/destination enters logs/artifacts;
14. no adapter/core/renderer socket API exists.

## 12. Security gate

A bookmaker WSS rule is security-sensitive configuration.

Adding or widening an exact/suffix rule requires:

- evidence that normal public page rendering needs it;
- code review;
- deterministic tests;
- Security review before live-support qualification.

