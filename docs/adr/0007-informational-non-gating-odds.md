# ADR-0007: Treat bookmaker odds as informational, non-gating metadata

Status: **Accepted**

Date: 2026-09-24

## Context

The original execution contract treated bookmaker price as an activation gate:

- the adapter had to read a displayed price;
- equal price allowed activation;
- changed price produced `ODDS_CHANGED`;
- the user had to acknowledge the exact observed price;
- acknowledgement forced a full revalidation;
- unreadable price produced `ODDS_UNAVAILABLE` safe failure.

PRODUCT-031 corrects that boundary. NotifyHandler is a **selection-preparation tool**, not a surebet decision engine. Its job is to prepare the exact bookmaker selections and hand control to the user. It does not decide whether the current price still makes the pair profitable or acceptable.

Price is not part of selection identity.

## Decision

Selection authorization is based only on:

- approved bookmaker/browser origin and network policy;
- event identity;
- market family/context;
- market period;
- exact numeric line when required;
- exact requested outcome/side;
- current attempt/evidence freshness;
- cancellation state;
- page state sufficient to activate and then verify the exact requested selection.

Expected/notified and displayed odds are informational metadata only.

A changed, absent, unreadable, or unparsable displayed price does not by itself block selection activation when identity is otherwise established.

## State-machine changes

Remove the blocking price path from the shared execution state machine:

- retire `VERIFYING_ODDS` as a mandatory state;
- retire `ODDS_CHANGED` as a leg state/interruption;
- retire `CONTINUE_WITH_OBSERVED_ODDS`;
- remove changed-odds acknowledgement from renderer/core/worker commands;
- remove odds from `SelectionActivationGate` authorization inputs.

The normal path becomes:

```text
MATCHING_OUTCOME
  -> ACTIVATING_SELECTION
  -> VERIFYING_SELECTION
  -> SELECTION_PREPARED
  -> READY_FOR_USER
```

Price observation may occur opportunistically and emit informational telemetry without changing the leg state.

## Price representation

The domain may retain:

- optional expected/notified odds from the input;
- optional observed odds from the bookmaker page;
- optional comparison metadata when both values are available.

These values remain decimal-safe where present.

No comparison value is authorizing.

A useful conceptual shape is:

```ts
type OddsObservation = Readonly<{
  expected?: DecimalOddsString;
  observed?: DecimalOddsString;
  comparison?: "EQUAL" | "HIGHER" | "LOWER";
  status: "NOT_OBSERVED" | "OBSERVED" | "UNAVAILABLE" | "INVALID";
}>;
```

The exact implementation type may differ, but `UNAVAILABLE` and `INVALID` are informational states rather than safe failures.

## Input compatibility

### Legacy input

Legacy notifications may continue carrying odds. Existing parser behavior may preserve them as informational provenance.

Price presence is no longer part of target validity or execution preflight.

### Structured v1

`notifyhandler.direct-pair.v1` remains **wire-frozen**. Its existing required `expectedOdds` field remains required so existing producers/validators are not silently redefined.

The v1 normalizer treats that field as informational metadata only.

### Structured v2

V2 is amended so `expectedOdds` is optional.

This is backward compatible with every existing v2 producer because previously valid payloads remain valid unchanged.

When supplied, the value must still be a valid canonical positive decimal string. When absent, execution remains valid if every required identity/navigation field is valid.

### SelectionTarget

`SelectionTarget.expectedOdds` becomes optional.

It is immutable metadata within the plan when present, but it is not part of target identity equivalence and does not participate in `MatchingEvidenceSnapshot` or selection activation.

A new notification remains a new plan regardless of whether only its informational price changed.

## Adapter behavior

Adapters:

1. establish event;
2. establish market family/context/period;
3. establish exact line when required;
4. establish exact outcome;
5. may observe the displayed price if it is already available without broadening navigation or interaction;
6. submit candidate + identity evidence to `SelectionActivationGate`;
7. activate and verify the exact selection;
8. return `READY_FOR_USER` with optional odds observation.

An adapter must not:

- delay activation solely to obtain a price;
- navigate or click extra UI solely to make price readable unless separately justified by the normal target-selection flow;
- reject an exact identity because price changed or could not be parsed;
- calculate ROI, arbitrage validity, profitability, or stakes.

## Error model

Remove price as a failure stage for normal selection preparation.

`ODDS_UNAVAILABLE` and `ODDS_INVALID` are retired as terminal safe-failure codes for the current contract.

Existing implementation may temporarily emit migration telemetry, but downstream work must remove any path where those conditions transition the leg to `FAILED_SAFE`.

## UI behavior

The UI may display:

- notified price when present;
- currently observed price when available;
- changed/unavailable status as informational text.

It must not require acknowledgement before preparation continues.

The user decides whether the displayed price is acceptable, how much to stake, and whether to place the bet.

## Preserved boundaries

This change does not weaken:

- event matching;
- market family/context matching;
- market-period matching;
- exact-line matching;
- exact-side matching;
- selected-state verification;
- authentication boundaries;
- browser/network safety;
- cancellation/staleness rules;
- transaction boundaries.

## Rejected alternatives

### Keep ODDS_CHANGED only as a warning state

Rejected. A blocking/action-required state still makes price part of execution authorization.

### Automatically accept only better prices

Rejected. NotifyHandler does not decide whether a price is good/bad or whether the pair remains profitable.

### Recalculate surebet ROI

Rejected. Surebet decision logic is explicitly outside the product.

## Consequences

Application, bookmaker, domain, QA, and security implementations must remove legacy odds-gating behavior while preserving optional price observability.

## References

- PRODUCT-031 / #199
- ARCH-010 / #200
- `docs/product-requirements.md`
- `specs/matching-policy.md`
- `specs/execution-contract.md`
