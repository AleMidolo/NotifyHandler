# ADR-0004: Versioned typed navigation and restricted bet-up relay resolution

Status: **Accepted**

Date: 2026-09-22

## Context

ARCH-004 introduced `notifyhandler.direct-pair.v1` for an upstream surebet bot that was expected to supply direct bookmaker-origin match links.

Real production notifications instead contain credential-free relay URLs such as:

```text
https://www.bet-up.it/lnk/<signal-uuid>/<bookmaker>
```

Observed samples use one signal UUID with bookmaker-specific suffixes such as `bet365`, `sisal`, `lottomatica`, `eplay24`, `admiralbet`, and `domusbet`.

The relay is expected to navigate through the browser to the bookmaker page. It is not bookmaker/event evidence.

Changing v1 to accept a new origin would silently weaken a previously accepted protocol and could make existing validation ambiguous.

## Decision

Introduce **`notifyhandler.direct-pair.v2`**.

V2 replaces the leg's untyped `deepLink` field with a typed navigation candidate:

- `bookmaker-direct`;
- `betup-relay`.

V1 remains supported and direct-bookmaker-only.

Both protocol versions normalize into the same two-leg `ExecutionPlan`; no second orchestration/state machine is introduced.

## Relay grammar decision

The only relay origin accepted by this ADR is:

```text
https://www.bet-up.it
```

The accepted path is exactly:

```text
/lnk/<uuid>/<bookmaker-suffix>
```

with no userinfo, query, or fragment.

The suffix must map through a version-controlled registry and equal the structured leg's canonical bookmaker.

When both legs use the relay form, their signal UUIDs must agree.

No fuzzy suffix mapping is permitted.

## Resolution placement

Relay **syntax and binding** are checked in application/core preflight.

Relay **network resolution and redirect traversal** occur in a dedicated restricted stage inside the browser worker/gateway.

Rationale:

- redirect behavior is browser/network state, not domain parsing;
- the worker already owns isolated sessions, cancellation, request/origin policy, DNS/private-target checks, and evidence epochs;
- following the relay in the core with a general HTTP client would create a second privileged network path and a new URL-trust boundary.

The resolver is not a bookmaker adapter and does not perform event/market/outcome matching.

## Redirect/origin policy

The approved relay path is intentionally strict:

1. open the exact validated `www.bet-up.it` relay;
2. permit one cross-origin transition only when its destination is already an approved origin for the leg's expected bookmaker adapter;
3. reject any third-party intermediary;
4. apply fail-closed DNS/private-target checks to relay and destination before navigation;
5. after the expected bookmaker origin is reached, finish relay resolution and hand control to the existing adapter/navigation policy.

This allows normal HTTP, meta, or script-driven top-level navigation only when the actual top-level destination is the expected bookmaker.

Unreviewed affiliate/tracker intermediaries are not accepted merely because they may eventually reach the bookmaker.

If real evidence later proves a required intermediary pattern, it must be reviewed and added explicitly rather than accepted generically.

## Evidence decision

Relay resolution produces **zero positive selection identity evidence**.

The relay origin, signal UUID, suffix, redirect destination, and successful final bookmaker arrival cannot mark event, competition/time, market, line, outcome, or odds as matched.

Matching begins only after arrival on the expected bookmaker origin in a fresh evidence epoch.

The SelectionActivationGate remains unchanged.

## Authentication decision

A challenge on the relay origin is not `AUTH_REQUIRED`; it is a relay-resolution safe failure.

Manual `AUTH_REQUIRED` applies only after the browser has reached an approved bookmaker origin and the bookmaker requires user authentication.

No relay/bookmaker credentials, MFA/CAPTCHA automation, or access-control bypass is introduced.

## Failure and retry decision

Malformed relay input, suffix mismatch, unexpected intermediary, wrong final bookmaker, private/internal DNS target, loop/limit, unresolved timeout, or relay challenge all fail safely before activation.

Wrong/stale content after correct bookmaker arrival uses the existing deterministic matching failures.

Retry/reopen re-resolves the immutable relay from the beginning. A previously resolved bookmaker URL is not cached as trusted execution input.

## Privacy decision

Diagnostics record only the minimum relay metadata needed for support:

- relay kind/origin;
- bookmaker suffix/id;
- hashed/truncated signal identifier if needed;
- hop/transition count;
- sanitized final origin/path category;
- failure code/timing.

Full relay URLs and signal UUIDs are not logged/persisted by default.

## Rejected alternatives

### Widen v1 to accept bet-up.it

Rejected because it changes the meaning of an already accepted/shipped contract and makes a v1 `deepLink` ambiguous.

### Core-side HTTP redirect resolution

Rejected because it creates a second privileged network client, bypasses the browser gateway's navigation controls, and would require duplicating DNS/origin/cancellation policy.

### Let each bookmaker adapter resolve relay links

Rejected because relay semantics are shared upstream infrastructure, not bookmaker-specific DOM behavior. It would duplicate trust logic across adapters.

### Allow arbitrary intermediary redirects

Rejected because a trusted first/final origin does not make unknown intermediary origins safe. New intermediaries require explicit evidence and review.

### Treat relay suffix as bookmaker/event evidence

Rejected because the upstream relay path can be stale, malformed, or misdirected and does not prove page identity.

## Consequences

### Application Engineer

Add v2 payload validation and typed navigation normalization while preserving v1 unchanged. Core preflight validates relay grammar/suffix/signal consistency but never follows the relay.

### Browser/Bookmaker Automation Engineer

Add the shared restricted relay resolver to the worker/browser gateway; then BOOK-016 can run relay-aware evidence collection. Adapters receive control only after successful expected-bookmaker resolution.

### Security & Compliance Engineer

Review relay DNS/request interception, redirect/origin enforcement, challenge behavior, logging minimization, and protection against open-redirect/SSRF-style misuse.

### QA / Integration Engineer

Add deterministic v1/v2 compatibility and relay-path regressions, proving no relay metadata authorizes identity matching or transaction behavior.

## References

- ARCH-005 / #119
- PRODUCT-019 / #118
- PRODUCT-016 / #109
- BOOK-016 / #104
- `specs/structured-ingestion-v1.md`
- `specs/structured-ingestion-v2.md`
- `docs/adr/0003-loopback-structured-direct-pair-ingress.md`
