# ADR-0008: Permit bounded bookmaker WSS page transport

Status: **Accepted**

Date: 2026-09-24

## Context

The original passive diagnostic treated any WebSocket attempt as a terminal fail-closed condition.

The qualified BET365 diagnostic later established that the exact source-locked page attempts a WebSocket before useful render evidence is available.

PRODUCT-032 corrects the product assumption: a normal headed bookmaker page must not fail merely because ordinary rendering uses WebSockets.

At the same time, permitting arbitrary sockets would create an unacceptable network and data boundary.

## Decision

Permit bookmaker WebSockets only through the shared browser gateway and only under `specs/bookmaker-network-policy.md`.

The policy requires:

- `wss://` only;
- default TLS port 443 only;
- no URL credentials;
- DNS hostname, not IP literal;
- fail-closed public DNS/IP validation;
- bookmaker-scoped, version-controlled exact-host or reviewed-host-suffix authorization;
- active top-level page already on an approved origin for that bookmaker;
- isolated current browser attempt.

No notification/page/user value can add a WSS destination rule.

## Browser-native only

Allowed sockets remain inside Chromium's normal page runtime.

No raw socket capability is exposed to adapters, core, renderer, matching, or activation code.

NotifyHandler does not inspect or retain payloads and does not send application-authored messages.

## Relay boundary

Bet-up relay resolution remains stricter.

Relay-origin WebSockets remain blocked. WSS policy becomes eligible only after the worker reaches an approved bookmaker origin and exits relay resolution.

## Failure behavior

Unsafe/unapproved sockets fail closed with finite browser/network failure categories.

The application never auto-learns or retries by widening the allowlist.

## Passive diagnostic evolution

`passive-provenance.v1` is retained as the historical schema that recorded any WebSocket attempt as blocked.

Current diagnostics move to `passive-provenance.v2`.

Under v2:

- a reviewed allowed WSS can be observed as finite non-authorizing transport provenance and render observation may continue;
- blocked WSS remains terminal;
- no destination or payload is retained.

## Security rationale

This approach behaves more like a normal browser without creating:

- arbitrary socket egress;
- private-network reachability;
- payload-based scraping/matching;
- private API reverse engineering;
- credential/transaction capability.

## Rejected alternatives

### Allow any public WSS

Rejected. Public reachability is not sufficient authorization.

### Allow every subdomain of the current bookmaker origin automatically

Rejected. Subdomain ownership/takeover and third-party hosting differ by bookmaker. Suffix rules must be explicit version-controlled policy.

### Retain socket host for diagnostics

Rejected by default. Finite allow/block provenance is enough for routine diagnostics.

### Expose WebSocket messages to adapters

Rejected. It would create a new data/API capability outside the DOM-based selection contract.

### Keep blocking every socket

Rejected by PRODUCT-032 because normal bookmaker rendering may require WSS.

## Consequences

A separate Bookmaker/worker task must implement the network policy and migrate the passive diagnostic to provenance v2.

Security and QA must review the exact implementation before BET365 is re-tested live.

## References

- PRODUCT-032 / #202
- ARCH-011 / #203
- ARCH-009 / #196 (superseded)
- `specs/bookmaker-network-policy.md`
- `specs/passive-diagnostic-provenance-v2.md`
