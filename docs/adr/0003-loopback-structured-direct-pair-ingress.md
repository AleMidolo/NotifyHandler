# ADR-0003: Loopback structured direct-pair ingress

Status: **Accepted, amended by ADR-0007**

Date: 2026-09-21

## Context

NotifyHandler's initial ingestion contract was textual. The parser preserved ordered recommended options and the core automatically selected the first recommendation.

Milestone 6 live-feasibility work showed that generic bookmaker homepage/competition discovery was not producing sufficient deterministic evidence for the narrow full-match total-corners target. The upstream surebet bot can instead provide the exact two bookmaker legs and a bookmaker deep link intended to open each match page directly.

The architecture therefore needs a structured machine-to-machine ingress path without weakening the existing browser, matching, authentication, privacy, or transaction boundaries.

## Decision

Add a **versioned local structured protocol** identified as `notifyhandler.direct-pair.v1`.

A v1 message:

- carries one event/market target;
- carries exactly two explicit, distinct bookmaker legs;
- includes bookmaker, outcome, the frozen v1 `expectedOdds` compatibility field, and a required direct match-page link per leg; the price field is informational only;
- treats that explicit pair as authoritative;
- does not use `recommendedOptions` or any pair chooser;
- normalizes into the existing two `SelectionTarget` values and existing `ExecutionPlan`.

The legacy textual protocol remains supported and retains source-order first-recommendation semantics.

## Local HTTP transport decision

The desktop application may expose:

```text
POST /api/v1/notifications/direct-pair
```

on loopback only.

Remote/public webhook exposure is not part of this ADR.

The local endpoint requires:

- bearer-capability authentication generated from at least 256 bits of secure randomness;
- user-only/OS-protected local token storage;
- no token in URLs, payloads, renderer state, or logs;
- strict JSON content type and 64 KiB body ceiling;
- Host validation and default rejection of browser Origin requests;
- bounded concurrency/rate limits;
- required timestamp freshness;
- required idempotency key with duplicate/conflict semantics.

## Direct-link trust decision

A direct match link is a navigation optimization, not identity evidence.

Before use it must pass:

- HTTPS-only validation;
- no URL userinfo;
- exact adapter-approved bookmaker origin;
- no loopback/private/internal destination;
- DNS/private-target defenses;
- redirect/final-origin validation.

After page load, the adapter must still independently verify event, competition/time context where applicable, market/context/period, exact line, and requested side. Displayed odds may be observed as informational telemetry but do not gate activation.

## Fallback decision

For structured v1, failure of the authoritative direct link does **not** trigger silent fallback to generic homepage/competition discovery.

The leg fails safely.

This is deliberate because fallback would:

- hide stale/wrong producer links;
- make latency unpredictable;
- make evidence provenance ambiguous;
- reintroduce the discovery path Milestone 6 is explicitly trying to avoid.

Legacy textual input continues under its existing navigation behavior.

## Runtime integration

The structured transport is only an ingress adapter.

It must converge with the existing runtime before browser execution:

```text
HTTP direct-pair v1 ----\
                        -> normalized SelectionTargets -> ExecutionPlan -> existing orchestration
legacy text -----------/
```

No second state machine or bookmaker-specific HTTP path is created.

The existing:

- independent leg states;
- evidence epochs;
- manual-auth pause/resume;
- optional price observability without acknowledgement;
- cancellation;
- SelectionActivationGate;
- selected-state verification;
- no-stake/no-submit transaction boundary

remain unchanged.

## Security rationale

Loopback binding alone is insufficient because:

- malicious local processes may connect;
- malicious web pages can target localhost services;
- Host/Origin confusion and replay are possible;
- notification URLs are attacker-controlled data.

Therefore the endpoint also requires an unguessable local capability, browser-origin rejection, request bounds, freshness, idempotency, and explicit URL validation.

## Rejected alternatives

### Public Internet webhook

Rejected for this milestone because it adds TLS, public authentication, exposure, rate/abuse, remote secret management, and deployment concerns unrelated to the local desktop product.

### Trusting direct links as event evidence

Rejected because a stale or malicious link could target the wrong match/market while still being on an approved bookmaker origin.

### Generic homepage fallback for structured v1

Rejected because it hides invalid authoritative input and reintroduces the blocked discovery path.

### Separate structured execution engine

Rejected because it would duplicate state, recovery, safety, and adapter logic.

### Unauthenticated localhost endpoint

Rejected because localhost is reachable by other local software and can be targeted by browser-origin attacks.

## Consequences

### Application Engineer

Must implement the loopback HTTP transport, authentication, request bounds, freshness/idempotency, v1 schema validation, and conversion to the shared execution plan without coupling transport code to bookmaker adapters.

### Bookmaker Automation Engineer

Must consume the immutable direct link as the preferred initial navigation candidate, validate it at the worker/browser boundary, and independently re-establish all matching evidence after navigation.

### Security & Compliance Engineer

Must threat-model and regression-test the loopback endpoint, token lifecycle, browser-origin/Host protections, URL/DNS/redirect policy, logging minimization, and replay/idempotency behavior.

### QA / Integration Engineer

Must verify both ingestion paths converge on identical execution-state/matching/transaction contracts and that all rejected ingress cases produce zero bookmaker navigation.

## References

- ARCH-004 / #103
- PRODUCT-015 / #102
- `specs/structured-ingestion-v1.md`
- `specs/notification-format.md`
- `specs/selection-target.md`
- `specs/execution-contract.md`
- `specs/bookmaker-adapter-contract.md`
- `docs/safety-boundaries.md`
