# Selection target specification

Status: **Accepted architecture/domain contract for Milestone 1**

`SelectionTarget` is the immutable, bookmaker-agnostic instruction for one leg of a chosen surebet pair. It describes **what must be selected**, never how a bookmaker DOM is manipulated.

Normative companion contracts:

- `specs/execution-contract.md` — two-leg runtime/state semantics;
- `specs/bookmaker-adapter-contract.md` — worker/adapter/browser capability boundary;
- `specs/matching-policy.md` — identity evidence, odds, and activation rules;
- `docs/error-model.md` — interruptions and safe failures.

## 1. Conceptual structure

```ts
type SelectionTarget = Readonly<{
  id: string;
  bookmaker: BookmakerId;
  event: Readonly<{
    participantA: string;
    participantB: string;
    competition?: string;
    scheduledAt?: string; // normalized ISO-8601 instant with source timezone resolved
    sourceDisplay: string;
  }>;
  market: Readonly<{
    family: MarketFamily;
    context?: string;
    line?: DecimalString;
    sourceLabel: string;
  }>;
  outcome: Readonly<{
    side: OutcomeId;
    sourceLabel?: string;
  }>;
  expectedOdds: DecimalOddsString;
  deepLink?: string; // untrusted navigation candidate until validated
  provenance: Readonly<{
    notificationOptionId: string;
    sourceOfferId: string;
  }>;
}>;
```

Decimal line and odds values use canonical decimal-safe strings/arbitrary-precision decimal semantics. Implementations must not rely on binary floating-point equality for identity.

## 2. Invariants

A target is valid for execution only when:

- `bookmaker` resolves to exactly one supported adapter;
- both event participants are present after domain normalization;
- market family/context semantics are explicit;
- a line is present for every line-based market;
- outcome/side is explicit;
- expected odds are valid positive decimal odds;
- provenance resolves to the user-selected recommended option and source offer;
- any supplied deep link remains untrusted until runtime origin/scheme validation.

One recommended MVP pair resolves to exactly two valid targets.

Targets are immutable after the execution summary is shown. A different event, bookmaker, market, line, side, or expected odds requires rebuilding/reviewing the plan; an adapter may never mutate a target to make a page candidate fit.

## 3. Target vs execution state

`SelectionTarget` contains identity intent only. It does not contain:

- browser/session handles;
- matching evidence;
- observed odds;
- current execution state;
- retry counters;
- credentials/MFA/CAPTCHA data;
- actionable stake values;
- any transaction command.

Those runtime concerns belong to `ExecutionPlan`/leg runtime and adapter result contracts.

## 4. Adapter obligations

Given a target, the adapter must independently establish current-epoch evidence for:

1. approved HTTPS origin;
2. event identity;
3. market family/context;
4. exact line when required;
5. exact outcome/side;
6. displayed odds;
7. page state sufficient to activate and verify the exact target selection.

The adapter must not reinterpret a missing target into the nearest available event, market, line, side, or bookmaker.

## 5. Evidence semantics

Required identity dimensions use the shared statuses:

- `NOT_CHECKED`;
- `MATCHED`;
- `MISMATCHED`;
- `AMBIGUOUS`;
- `UNAVAILABLE`.

Only `MATCHED` is authorizing for a required identity dimension. See `specs/matching-policy.md` for the deterministic event/market/line/outcome rules.

## 6. Event matching

Participant identity is mandatory. Competition and scheduled time provide context according to the shared policy.

Fuzzy similarity may discover candidates but cannot itself produce `MATCHED`. Approved aliases must be deterministic, version-controlled, and tested.

When target context exists but the page exposes neither competition nor time, participant names alone are insufficient under the MVP policy.

## 7. Market and line matching

Market family, optional context, and numeric line are separate identity dimensions.

For `U/O CORNER 11.5` + `OVER`:

- total corners is not total goals;
- match total is not team total;
- full match is not first half;
- 11.5 is not 10.5, 11.0, 12.0, or 12.5;
- `OVER` is not `UNDER`.

No nearest-line or neighboring-DOM substitution is permitted.

## 8. Odds semantics

`expectedOdds` is immutable notification evidence. `observedOdds` is current page evidence and remains distinct.

Shared comparison values are:

- `EQUAL`;
- `HIGHER`;
- `LOWER`;
- `UNAVAILABLE`.

Under the MVP policy, changed odds produce `ODDS_CHANGED` before selection activation and require explicit acknowledgement plus complete revalidation. Unavailable/unreadable odds produce safe failure rather than a click.

Odds identity never repairs wrong event/market/line/outcome evidence.

## 9. Result semantics

The shared automation result can produce:

- `READY_FOR_USER`;
- `AUTH_REQUIRED`;
- `ODDS_CHANGED`;
- `FAILED_SAFE`;
- `CANCELLED`.

`READY_FOR_USER` requires exact identity evidence, permitted odds state, final selection activation, and post-activation verification for this target.

It never means a stake was entered or a bet was submitted.

## 10. Capability exclusions

No contract consuming `SelectionTarget` may expose capabilities for:

- receiving/entering bookmaker credentials;
- automating MFA/OTP/CAPTCHA;
- entering/changing stakes;
- submitting/confirming/finalizing a bet;
- deposits/withdrawals/cash-out;
- bypassing access controls, anti-bot systems, rate limits, or geo restrictions.

## 11. Retry/revalidation

Retry, reopen, manual-login resume, changed-odds continuation, redirect, refresh, browser replacement, or meaningful page-state change invalidates stale positive evidence as defined by `specs/execution-contract.md`.

A previous target match never authorizes a future click after its evidence epoch has expired.

## 12. Test contract

Shared tests must prove that:

- an exact target can become `READY_FOR_USER` only after verified selection;
- wrong/similar event never activates;
- wrong market never activates;
- neighboring line never activates;
- wrong side never activates;
- duplicate/ambiguous candidates never activate;
- changed odds pause before activation and remain visible;
- stale odds acknowledgement does not authorize a new price;
- manual login invokes no credential automation;
- cancellation and stale evidence prevent activation;
- no adapter/core capability can enter stakes or submit a bet.
