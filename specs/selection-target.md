# Selection target specification

Status: **Accepted architecture/domain contract for Milestone 1, amended by ARCH-004, ARCH-005, ARCH-006, and ARCH-010**

`SelectionTarget` is the immutable, bookmaker-agnostic instruction for one leg of an accepted surebet execution pair. It describes **what must be selected**, never how a bookmaker DOM is manipulated.

Normative companion contracts:

- `specs/structured-ingestion-v1.md` — frozen direct-bookmaker structured provenance;
- `specs/structured-ingestion-v2.md` — typed direct/relay navigation semantics;
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
    period: MarketPeriod;
    line?: DecimalString;
    sourceLabel: string;
  }>;
  outcome: Readonly<{
    side: OutcomeId;
    sourceLabel?: string;
  }>;
  expectedOdds?: DecimalOddsString; // informational provenance only
  navigation?: Readonly<
    | { kind: "BOOKMAKER_DIRECT"; url: string }
    | {
        kind: "BETUP_RELAY";
        url: string;
        signalId: string;
        bookmaker: BookmakerId;
      }
  >;
  deepLink?: string; // deprecated v1/legacy compatibility projection only
  provenance: Readonly<
    | {
        kind: "legacy-recommendation";
        notificationOptionId: string;
        sourceOfferId: string;
      }
    | {
        kind: "structured-direct-pair";
        schemaVersion: "notifyhandler.direct-pair.v1" | "notifyhandler.direct-pair.v2";
        notificationId: string;
        legIndex: 0 | 1;
      }
  >;
}>;
```

Decimal line values use canonical decimal-safe strings/arbitrary-precision decimal semantics for identity. Odds use the same decimal-safe representation when present, but are informational metadata and not identity.

## 2. Invariants

A target is valid for execution only when:

- `bookmaker` resolves to exactly one supported adapter;
- both event participants are present after domain normalization;
- market family/context semantics are explicit;
- `market.period` is explicit and immutable; for the current MVP executable scope it is `full_match`;
- a line is present for every line-based market;
- outcome/side is explicit;
- expected odds, when present, are valid positive decimal odds;
- provenance resolves either to the legacy primary recommendation/source offer or to one explicit structured v1/v2 leg;
- any supplied navigation URL remains untrusted until runtime origin/DNS/redirect validation;
- structured-v1 provenance requires a `BOOKMAKER_DIRECT` candidate (or the deprecated equivalent direct `deepLink` projection);
- structured-v2 provenance requires an explicit typed navigation candidate; a relay candidate must carry parsed signal/bookmaker binding;
- legacy provenance may omit navigation when its adapter flow permits another approved entry point.

Every accepted execution pair resolves to exactly two valid targets.

Targets are immutable once the execution plan is created. Event, bookmaker, market family/context, market period, line, and side define selection identity. Expected odds are immutable informational metadata when present but do not participate in identity equivalence or activation. An adapter may never mutate identity fields to make a page candidate fit.

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
3. market family/context and exact period;
4. exact line when required;
5. exact outcome/side;
6. page state sufficient to activate and verify the exact target selection.

The adapter may also observe displayed odds as optional informational metadata, but price readability/equality is not required for activation.

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

## 7. Market period and line matching

Market family, context/subtype, period, and numeric line are separate identity dimensions.

`MarketPeriod` is a canonical domain value. For the current executable MVP scope:

```ts
type MarketPeriod = "full_match";
```

This narrow enum is intentional. Supporting first-half, second-half, regulation-plus-overtime, or another settlement period requires an explicit domain/spec extension; adapters must never infer or substitute one.

For the current `U/O CORNER 11.5` + `OVER` target:

- total corners is not total goals;
- match total is not team total;
- `full_match` is not first half or another period;
- 11.5 is not 10.5, 11.0, 12.0, or 12.5;
- `OVER` is not `UNDER`.

A market candidate can contribute `MARKET_MATCHED` only when family, context/subtype, and period are all deterministically established for the current evidence epoch. If the target period is not observable under the adapter's reviewed mapping, market identity is `UNAVAILABLE`; an explicitly different period is `MISMATCHED`.

No nearest-line, neighboring-DOM, section-position, or odds-based substitution is permitted.

## 8. Odds semantics

`expectedOdds` is optional informational notification provenance.

`observedOdds` is optional current page telemetry.

When both are present, they may be compared for display, but:

- equality is not required;
- changed odds do not create `ODDS_CHANGED`;
- missing/unreadable odds do not fail an otherwise exact target;
- no odds value can repair or override event/market/period/line/outcome identity.

Structured-v1 compatibility may still require a wire-level expected price. That does not make price part of SelectionTarget identity.

## 9. Result semantics

The shared automation result can produce:

- `READY_FOR_USER`;
- `AUTH_REQUIRED`;
- `FAILED_SAFE`;
- `CANCELLED`.

`READY_FOR_USER` requires exact identity evidence, final selection activation, and post-activation verification for this target. Optional observed odds may accompany the result.

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

Retry, reopen, manual-login resume, redirect, refresh, browser replacement, or meaningful page-state change invalidates stale positive evidence as defined by `specs/execution-contract.md`.

A previous target match never authorizes a future click after its evidence epoch has expired.

## 12. Test contract

Shared tests must prove that:

- an exact target can become `READY_FOR_USER` only after verified selection;
- wrong/similar event never activates;
- wrong market never activates;
- a first-half/other-period market never satisfies a `full_match` target;
- unavailable period evidence never activates;
- neighboring line never activates;
- wrong side never activates;
- duplicate/ambiguous candidates never activate;
- changed higher/lower odds with exact identity remain non-blocking and may be visible as informational telemetry;
- missing/unreadable odds with exact identity remain non-blocking;
- manual login invokes no credential automation;
- cancellation and stale evidence prevent activation;
- no adapter/core capability can enter stakes or submit a bet.

## 13. Structured direct-pair provenance

For `notifyhandler.direct-pair.v1` or v2, `provenance.kind` is `structured-direct-pair` and identifies the message/schema plus leg index without inventing a recommendation id.

The direct match link is required input for that source, but it remains a navigation candidate only. It must not be converted into event/market/outcome evidence.

If a structured-v1 direct link is unsafe, stale, wrong-event, blocked by authentication/access behavior that cannot be resumed safely, or insufficient to establish deterministic page evidence, the leg fails safely. The target must not be mutated to a generic bookmaker URL or a different event.


## 14. Typed navigation target

ARCH-005 makes navigation intent explicit.

New structured implementations should consume `navigation`, not infer behavior from URL origin.

`BOOKMAKER_DIRECT` uses the existing direct-bookmaker validation and navigation path.

`BETUP_RELAY` is valid only for structured v2. Its `bookmaker` field must equal the enclosing `SelectionTarget.bookmaker`; its signal/bookmaker values come from validated relay-path parsing and are immutable provenance, not selection evidence.

The deprecated `deepLink` field exists only to avoid silently breaking already-shipped v1/legacy code during migration. Implementations must not populate contradictory `navigation` and `deepLink` values. When `navigation` is present it is authoritative for worker routing, while all URLs remain untrusted.

A successful relay resolution never mutates the target navigation into a trusted direct URL. Retry/reopen resolves the original immutable navigation target again.
