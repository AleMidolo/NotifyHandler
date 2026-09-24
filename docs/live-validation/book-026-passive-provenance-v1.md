# BOOK-026 — passive-provenance.v1 implementation

Date: **2026-09-24**  
Issue: **#188**  
Architecture: **ARCH-008/#184**, ADR-0006  
Schema: `specs/passive-diagnostic-provenance-v1.md`

## Scope

BOOK-026 extends the existing source-locked BOOK-024 passive direct-page diagnostic with finite, redacted provenance only.

It does not change:

- BET365/SISAL source targets;
- navigation timeout (20 seconds);
- fixed readiness delay (1 second);
- DNS/private-network checks;
- approved-origin/final-route policy;
- WebSocket blocking;
- popup/service-worker/download handling;
- retry/action budget;
- click/fill/type/outcome-activation capability;
- authentication/MFA/CAPTCHA behavior;
- stake/betslip/payment/wager boundary;
- generic discovery, Betup fallback, or private/protected API policy.

No live bookmaker run is part of BOOK-026.

## Schema

Every retained qualifying summary declares:

`diagnosticSchemaVersion: "passive-provenance.v1"`

and keeps:

`authorizesProductionMapping: false`.

### Transport provenance

Only the first source-controlled transport-policy class is retained:

- `CLEAR`;
- `WEBSOCKET_ATTEMPT / SOCKET`;
- `PUBLIC_HTTPS_TARGET_REJECTED / TOP_LEVEL|SUBRESOURCE`;
- `DISALLOWED_PROTOCOL / TOP_LEVEL|SUBRESOURCE`.

No blocked destination URL, host, IP, port, path, query, fragment, protocol string, browser error, DNS answer, sequence, or count is retained.

The compatibility BOOK-024 block reason remains unchanged.

### Render provenance

Render provenance is emitted only for a complete, exact-route, transport-clear page after auth/access/consent checks are clear.

For every existing target predicate it retains only:

- `domPresent`;
- `visibleObservedWithinBound`.

The invariant `visibleObservedWithinBound => domPresent` is validated.

Additional bounded fields:

- readiness:
  - `DOMCONTENTLOADED_CONFIRMED`;
  - `DOMCONTENTLOADED_NOT_CONFIRMED`;
- title booleans:
  - participant pair present;
  - competition present;
- DOM population:
  - `EMPTY` = 0 body descendants;
  - `SPARSE` = 1..31;
  - `POPULATED` = 32+.

Raw title, hidden text, body text, HTML, screenshots, traces, HAR, selectors, node identifiers, and raw element counts are never retained by the new provenance.

## Artifact validation

Before a summary is returned to the CLI for retention, BOOK-026 validates:

- exact schema version;
- explicit top-level and nested field allowlists;
- exact enum values;
- target/evidence field allowlists;
- bounded visible snippets;
- `authorizesProductionMapping: false`;
- complete summaries require clear transport plus render provenance and bounded evidence;
- blocked summaries require a block reason and omit render/evidence;
- blocked transport provenance requires the existing compatibility network block reason;
- invalid visible-without-DOM state fails closed.

Dynamic network/browser/runtime messages are not copied into the retained summary.

## Deterministic coverage

The implementation tests cover:

- clear transport;
- WebSocket provenance;
- top-level/subresource public-HTTPS rejection;
- top-level/subresource disallowed protocol;
- first-trigger-only retention;
- readiness finite states;
- DOM population thresholds;
- unknown top-level/nested fields and enum rejection;
- contradictory render provenance rejection;
- DOM absent vs present-but-not-visible vs visible;
- title predicate booleans without raw title retention;
- existing exact-route, target evidence, changed-odds, privacy, source-lock, and transaction-capability regressions.

## Gate

BOOK-026 does **not** authorize live execution.

After merge:

1. SEC-008/#186 reviews the exact implementation.
2. QA-007/#189 certifies deterministic/browser/artifact behavior.
3. Only a later separately scoped Release/DevOps issue may run another real passive diagnostic after both approvals.
