# ADR-0006: Finite redacted passive diagnostic provenance

Status: **Accepted**

Date: 2026-09-24

## Context

BOOK-024 added a source-locked passive direct-page diagnostic for the current SISAL/BET365 target. It intentionally preserved strong privacy and safety boundaries.

The qualified BOOK-024 runs exposed two ambiguities:

1. BET365 stopped at `PRIVATE_OR_INTERNAL_DESTINATION`, but that compatibility reason is set for several different fail-closed transport classes: WebSocket attempt, HTTPS public-target validation failure, or disallowed protocol.
2. SISAL completed on the exact source-locked event route with no visible target signals. The retained artifact could not distinguish a predicate absent from the DOM from one present but not visibly observed at the fixed passive measurement point.

The next diagnostic must explain those states without retaining blocked destinations, hidden content, raw page data, or adding interaction/network capability.

## Decision

Add a versioned, non-authorizing **passive diagnostic provenance v1** schema defined by `specs/passive-diagnostic-provenance-v1.md`.

This is an observability amendment only. It does not change the product runtime, bookmaker matching policy, browser trust boundary, source targets, timeouts, waits, interaction budget, or transaction boundary.

## Transport decision

Retain only the **first** transport-policy trigger as one finite source-controlled category:

- `WEBSOCKET_ATTEMPT / SOCKET`;
- `PUBLIC_HTTPS_TARGET_REJECTED / TOP_LEVEL|SUBRESOURCE`;
- `DISALLOWED_PROTOCOL / TOP_LEVEL|SUBRESOURCE`;
- or `CLEAR`.

The existing block behavior remains unchanged.

No destination host/IP/port/path/query/fragment/protocol string, request/response data, DNS answer, exception text, count, or sequence is retained.

The category explains which internal policy class fired; it does not explain the remote destination.

## Render decision

When and only when transport is clear, the exact source-locked final route is preserved, and no auth/access/consent boundary is present, retain:

- whether each already-reviewed target predicate exists in the DOM;
- whether a visible match was observed within the existing bounded scan;
- whether the existing DOMContentLoaded observation was confirmed;
- participant-pair and competition **title predicate booleans only**;
- one coarse body-descendant population bucket: `EMPTY | SPARSE | POPULATED`.

Do not retain raw title, hidden text, body text, HTML, screenshots, selectors, raw counts, page dumps, or traces.

## Why a population bucket is included

Target-presence booleans distinguish absent predicates from present-but-not-visible predicates, but when all target predicates are absent they do not distinguish an effectively empty shell from a nontrivial page containing unrelated content.

A three-value element-count bucket supplies that missing state with low information content:

- 0 -> `EMPTY`;
- 1..31 -> `SPARSE`;
- 32+ -> `POPULATED`.

The raw count is discarded and thresholds are fixed by schema version.

## Evidence/authorization decision

Diagnostic provenance is categorically separate from deterministic selection evidence.

No provenance field may:

- enter `MatchingEvidenceSnapshot`;
- repair a missing match dimension;
- authorize selection activation;
- authorize production mapping;
- promote bookmaker maturity/support;
- authorize retry, timeout expansion, interaction expansion, protocol/origin exceptions, or fallback behavior.

The existing `authorizesProductionMapping: false` literal remains mandatory.

## Timing decision

Do not alter BOOK-024 timing.

The readiness field reports only the result of the current DOMContentLoaded observation within the existing fixed delay/wait budget.

No network-idle wait, extra delay, polling loop, retry, or longer timeout is introduced.

## Privacy decision

Use a versioned explicit allowlist for retained summary fields and nested provenance.

Unknown fields/versions/enums fail validation before artifact retention.

The implementation must not copy dynamic network/browser/runtime messages into artifacts.

Existing bounded visible snippets remain under the separately reviewed BOOK-024 retention contract; ARCH-008 does not expand them and introduces no hidden/non-visible content retention.

## Implementation placement

This belongs only in the controlled live-validation diagnostic implementation.

It must not be added to:

- production bookmaker adapter public interfaces;
- the desktop application/core API;
- SelectionTarget or ExecutionPlan;
- SelectionActivationGate;
- production telemetry.

A separate Bookmaker implementation issue is required after this ADR is merged.

## Security/QA gate

Architecture approval does not authorize live execution.

The implementation must pass:

1. SEC-008 review of the exact implementation head;
2. a dedicated QA certification of schema/privacy/browser/capability regressions;
3. any required portable/Windows packaging gates;

before another real bookmaker diagnostic is run.

## Rejected alternatives

### Retain blocked destination hostname/path/IP

Rejected. It is unnecessary to distinguish the policy class and creates privacy/security risk.

### Retain the exact failed protocol

Rejected. A finite `DISALLOWED_PROTOCOL` category is sufficient.

### Retain all blocked-request categories or counts

Rejected. First-trigger provenance is enough and avoids turning the artifact into a request trace.

### Retain hidden target text

Rejected. DOM-presence/visibility booleans answer the diagnostic question without exposing page content.

### Retain raw document title

Rejected. Target-specific participant/competition predicate booleans are sufficient.

### Retain raw DOM element count

Rejected. A fixed coarse bucket is sufficient.

### Add longer waits/retries

Rejected. The evidence does not justify changing timing and doing so would confound comparison with BOOK-024.

### Allow WebSockets or weaken DNS/origin policy

Rejected. Diagnostic classification must not change the network trust boundary.

### Add clicks or interactive exploration

Rejected. ARCH-008 is passive provenance only.

## Consequences

### Bookmaker Automation Engineer

Implement the exact finite schema in the source-locked passive probe and its portable runner, with explicit artifact validation and no network/timing/action change.

### Security & Compliance Engineer

SEC-008 reviews the exact implementation, including allowlist enforcement, destination non-reconstruction, no hidden/raw content retention, capability invariance, and packaging/artifact redaction.

### QA / Integration Engineer

Add deterministic and pinned-browser coverage for all provenance categories, DOM presence/visibility states, title predicates, population buckets, unknown-field rejection, and unchanged safety/transaction gates.

### Release / DevOps Engineer

Do not run the new live diagnostic until Security and QA explicitly authorize the exact implementation/artifact.

## References

- ARCH-008 / #184
- BOOK-024 / #177
- BOOK-025 / #183
- SEC-007 / #178
- QA-006 / #179
- SEC-008 / #186
- `packages/automation/src/live-validation/target-aware-passive-probe.ts`
- `docs/live-validation/book-025-passive-diagnostic-interpretation.md`
