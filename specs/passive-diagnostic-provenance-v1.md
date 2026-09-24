# Passive direct-page diagnostic provenance v1

Status: **Accepted architecture contract for Milestone 6**

This specification defines the minimum additional provenance that may be retained by the source-locked passive direct-page diagnostic after BOOK-024/BOOK-025.

It does **not** change bookmaker matching, browser network policy, readiness timing, interaction capability, or live-support qualification.

## 1. Purpose

BOOK-024 produced two ambiguous but useful states:

- a BET365 run stopped at the fail-closed browser/network boundary, but the retained `PRIVATE_OR_INTERNAL_DESTINATION` reason did not reveal which finite policy class triggered it;
- a SISAL run completed on the exact source-locked route with zero visible target signals, but the artifact could not distinguish target predicates absent from the DOM from predicates present but not visibly observed.

The v1 provenance schema exists only to distinguish those states while minimizing retained information.

## 2. Non-authorizing invariant

Every field in this specification is diagnostic provenance only.

It must never:

- mark event, competition/time, market family/context/period, line, outcome, or odds as matched;
- satisfy or repair `MatchingEvidenceSnapshot`;
- authorize `SelectionActivationGate`;
- authorize a retry, longer timeout, wider action budget, new origin/protocol, WebSocket, generic discovery, Betup fallback, or private/protected API use;
- promote a bookmaker from `Blocked` or `Testable` to `Feasible` or `Supported`;
- set `authorizesProductionMapping` to true.

`authorizesProductionMapping` remains literal `false`.

## 3. Schema version

An implementation adding this provenance declares:

```ts
diagnosticSchemaVersion: "passive-provenance.v1";
```

Unknown diagnostic schema versions or unknown fields in the retained artifact fail validation before artifact retention.

The implementation must use an explicit allowlist for all retained summary fields and nested diagnostic fields.

## 4. Transport-boundary provenance

The existing high-level block behavior remains unchanged.

In particular, a transport-policy block may continue to surface the compatibility `blockReason` used by BOOK-024. The new field only records the **first finite trigger class** that caused the transport boundary to fail.

Conceptually:

```ts
type PassiveTransportProvenance =
  | Readonly<{
      state: "CLEAR";
    }>
  | Readonly<{
      state: "BLOCKED";
      trigger: "WEBSOCKET_ATTEMPT";
      scope: "SOCKET";
    }>
  | Readonly<{
      state: "BLOCKED";
      trigger: "PUBLIC_HTTPS_TARGET_REJECTED";
      scope: "TOP_LEVEL" | "SUBRESOURCE";
    }>
  | Readonly<{
      state: "BLOCKED";
      trigger: "DISALLOWED_PROTOCOL";
      scope: "TOP_LEVEL" | "SUBRESOURCE";
    }>;
```

### 4.1 Meaning of categories

`WEBSOCKET_ATTEMPT`
: the existing diagnostic observed a WebSocket attempt and closed it under the current fail-closed policy.

`PUBLIC_HTTPS_TARGET_REJECTED`
: an HTTPS request failed the existing public-target / resolved-address validation. This category does not state whether the cause was private address space, DNS uncertainty, a forbidden address class, or another internal validation detail.

`DISALLOWED_PROTOCOL`
: a request used a protocol outside the already approved passive-probe set.

### 4.2 Scope

For ordinary requests, scope is derived from browser request metadata and is only:

- `TOP_LEVEL`;
- `SUBRESOURCE`.

WebSocket provenance uses `SOCKET`.

No frame URL, request URL, hostname, IP, port, path, query, fragment, protocol string, request method, headers, body, response metadata, browser error, DNS answer, or exception text is retained.

### 4.3 First-trigger only

Only the first transport-boundary trigger is retained.

The artifact must not retain:

- a sequence of blocked requests;
- per-category counts;
- timing sequences that could reconstruct request ordering;
- dynamic network strings.

Later blocked requests do not enrich the artifact.

This minimizes the diagnostic channel and keeps the result sufficient for the BOOK-025 ambiguity.

## 5. Render-state provenance

Render diagnostics are collected only when:

1. transport provenance is `CLEAR`;
2. the exact source-locked approved final route is preserved;
3. no authentication, CAPTCHA/anti-bot, access restriction, or consent boundary has been detected.

If any of those conditions is false, render provenance is omitted.

Conceptually:

```ts
type TargetPredicatePresence = Readonly<{
  domPresent: boolean;
  visibleObservedWithinBound: boolean;
}>;

type PassiveRenderProvenance = Readonly<{
  readiness:
    | "DOMCONTENTLOADED_CONFIRMED"
    | "DOMCONTENTLOADED_NOT_CONFIRMED";

  titlePredicates: Readonly<{
    participantPair: boolean;
    competition: boolean;
  }>;

  targetPresence: Readonly<{
    participantA: TargetPredicatePresence;
    participantB: TargetPredicatePresence;
    competition: TargetPredicatePresence;
    scheduledDate: TargetPredicatePresence;
    scheduledTime: TargetPredicatePresence;
    broadCornerContext: TargetPredicatePresence;
    totalCornersMarket: TargetPredicatePresence;
    fullMatchContext: TargetPredicatePresence;
    exactLine: TargetPredicatePresence;
    requestedSideAtLine: TargetPredicatePresence;
    expectedOdds: TargetPredicatePresence;
  }>;

  domPopulation:
    | "EMPTY"
    | "SPARSE"
    | "POPULATED";
}>;
```

## 6. Target predicate presence

For each existing target predicate:

- `domPresent` is true when at least one DOM candidate exists for the reviewed predicate;
- `visibleObservedWithinBound` is true when visibility is positively observed within the existing bounded candidate scan.

The following invariant is mandatory:

```text
visibleObservedWithinBound => domPresent
```

The artifact does not retain:

- hidden text;
- the number of matching nodes;
- selector strings;
- matched element identifiers;
- matched snippets beyond the already existing BOOK-024 visible-evidence contract;
- a reason why a present node is non-visible.

The new presence fields do not alter existing visible evidence or its authorization status.

## 7. Readiness provenance

The implementation must not increase or add waits.

It records only whether the already existing DOMContentLoaded readiness observation was confirmed inside the current BOOK-024 timing budget.

Allowed values:

- `DOMCONTENTLOADED_CONFIRMED`;
- `DOMCONTENTLOADED_NOT_CONFIRMED`.

No raw readyState string, timing trace, performance entry, network-idle wait, retry, polling loop, or extra readiness delay is added.

## 8. Document-title predicates

The page title may be read transiently only to compute two booleans:

- `participantPair`: both target participants are present under the same deterministic text-normalization rules used by the diagnostic;
- `competition`: target competition predicate is present.

The raw title must never be retained, logged, emitted in an exception, or copied into another diagnostic field.

Title predicates are navigation/render provenance only. They do not establish production event identity or satisfy adapter matching.

## 9. DOM population bucket

To distinguish an empty/minimal shell from a nontrivial page without retaining page content, v1 permits one coarse element-count bucket.

Count only descendants under the document body and retain only:

- `EMPTY` — 0 descendants;
- `SPARSE` — 1 through 31 descendants;
- `POPULATED` — 32 or more descendants.

The raw count is never retained or logged.

The thresholds are fixed by this version and are not runtime-configurable.

The bucket is diagnostic only and cannot be used as a matching or support predicate.

## 10. Retention prohibition

The new provenance must never retain or reconstruct:

- blocked destination host, IP, port, origin, path, query, fragment, or protocol;
- request/response bodies, headers, cookies, tokens, authorization data, CSRF values, browser storage, or session identifiers;
- raw browser/runtime/DNS errors;
- raw document title;
- body text, hidden target text, HTML, DOM serialization, screenshots, video, trace, HAR, console output, or performance/network logs;
- raw element counts;
- selectors or node identifiers derived from the live page.

Existing source-locked target metadata and previously reviewed bounded visible evidence remain governed by their existing BOOK-024 contract; ARCH-008 adds no broader content retention.

## 11. Capability boundary

ARCH-008 adds observation fields only.

The probe remains:

- exact-source-locked;
- non-CI for real bookmaker execution;
- headed for live execution;
- zero-click;
- zero-fill/type;
- no arbitrary page evaluation API exposed as a reusable capability;
- no outcome activation;
- no stake/betslip/payment/wager capability;
- no credential/MFA/CAPTCHA handling;
- no protected/private API use;
- no access-control/anti-bot/rate-limit/geo bypass;
- no generic discovery;
- no Betup fallback.

Existing navigation timeout, fixed readiness delay, action budget, source targets, origin policy, DNS/private-target checks, popup handling, WebSocket blocking, and transaction boundary remain unchanged.

## 12. Validation rules

Before a summary is retained or packaged:

- `diagnosticSchemaVersion` must be exactly `passive-provenance.v1`;
- every field must be in the explicit schema allowlist;
- enum values must be exact;
- `visibleObservedWithinBound` cannot be true when `domPresent` is false;
- render provenance must be absent when transport is blocked, route preservation fails, or an auth/access/consent block is present;
- transport-block provenance contains exactly one trigger and its valid scope;
- no unknown nested fields are allowed;
- the artifact must still contain `authorizesProductionMapping: false`.

Validation fails closed. An invalid summary is not retained as qualifying evidence.

## 13. Required deterministic tests

Implementation tests must cover:

### Transport provenance

1. no blocked request -> `CLEAR`;
2. WebSocket attempt -> `WEBSOCKET_ATTEMPT/SOCKET`;
3. top-level HTTPS public-target validation rejection;
4. subresource HTTPS public-target validation rejection;
5. top-level disallowed protocol;
6. subresource disallowed protocol;
7. first-trigger-only behavior when multiple blocks occur;
8. no host/IP/path/protocol/error string appears in retained output.

### Render provenance

9. predicate absent from DOM -> `domPresent=false`, `visibleObservedWithinBound=false`;
10. predicate present but non-visible -> `true/false`;
11. predicate visibly observed -> `true/true`;
12. invalid `false/true` summary rejected;
13. title participant-pair boolean without title retention;
14. title competition boolean without title retention;
15. DOMContentLoaded confirmed/unconfirmed using the existing timing budget only;
16. DOM population buckets at 0, 1/31, and 32+ boundaries;
17. render provenance omitted for transport block;
18. render provenance omitted for auth/CAPTCHA/access/consent block.

### Schema/privacy/capability

19. unknown top-level/nested diagnostic field rejected;
20. unknown enum rejected;
21. dynamic runtime/network message cannot enter summary;
22. existing exact-route/source-lock behavior unchanged;
23. existing DNS/private-network/protocol/WebSocket/popup protections unchanged;
24. no extra wait/retry/click/evaluate/action capability;
25. existing transaction-boundary and `authorizesProductionMapping:false` regressions remain green.

## 14. Live-run gate

Architecture approval alone does not authorize another live run.

After implementation:

1. Security reviews the exact implementation head under SEC-008;
2. QA certifies the deterministic/browser/packaging matrix;
3. only then may Release/DevOps run at most the separately authorized bounded non-CI diagnostic.

No retry of BOOK-024 under the old schema is authorized.
