# Matching, confidence, and odds policy

Status: **Accepted architecture contract for Milestone 1, amended by ARCH-006 and ARCH-010**

This specification defines the shared evidence model and minimum authorization rules for bookmaker selection preparation. Bookmaker adapters may be stricter, but may not weaken these rules.

## 1. Principle

NotifyHandler optimizes for precision, not click completion.

Fuzzy similarity, visual proximity, price similarity, or a single matching label may help discover candidates, but may not by themselves authorize a selection click. Price is informational and never an authorizing identity dimension.

A click is permitted only after the exact target identity is established across the required dimensions for the current evidence epoch.

## 2. Evidence status

Every independently evaluated identity dimension has one status:

```ts
type EvidenceStatus =
  | "NOT_CHECKED"
  | "MATCHED"
  | "MISMATCHED"
  | "AMBIGUOUS"
  | "UNAVAILABLE";
```

Meanings:

- `NOT_CHECKED`: evaluation has not occurred in the current evidence epoch;
- `MATCHED`: deterministic rules positively establish the target dimension;
- `MISMATCHED`: observed evidence contradicts the target;
- `AMBIGUOUS`: more than one plausible candidate remains or evidence conflicts;
- `UNAVAILABLE`: a required observation cannot be obtained from the supported page state.

Only `MATCHED` authorizes a required identity dimension.

## 3. Evidence snapshot

Conceptually:

```ts
type MatchingEvidenceSnapshot = Readonly<{
  evidenceEpoch: number;
  origin: EvidenceDimension;
  event: EventEvidence;
  market: EvidenceDimension;
  line: EvidenceDimension;
  outcome: EvidenceDimension;
}>;

type EvidenceDimension = Readonly<{
  status: EvidenceStatus;
  reasonCode: string;
  normalizedTarget?: string;
  normalizedObserved?: readonly string[];
}>;
```

Evidence is diagnostic data, not a mutable confidence score.

## 4. No weighted confidence score for authorization

The MVP must not authorize a click from a weighted numeric score such as "87% confidence".

Bookmaker-specific fuzzy matching may be used only as a **candidate discovery** mechanism. Before a candidate is marked `MATCHED`, it must satisfy deterministic identity rules and uniqueness requirements.

If fuzzy discovery returns multiple plausible candidates, the result is `AMBIGUOUS`.

## 5. Text normalization

Shared text normalization may perform only deterministic transformations such as:

- Unicode normalization;
- trim/collapse whitespace;
- case folding;
- punctuation normalization where semantically safe;
- bookmaker-specific, version-controlled alias mapping;
- removal of decorative tokens explicitly known not to carry identity.

Normalization must not silently erase identity-bearing numbers, participant tokens, market context, market period, or outcome direction.

Aliases that can authorize `MATCHED` must be explicit and tested. Arbitrary edit-distance similarity cannot become an approved alias at runtime.

## 6. Event identity

### 6.1 Participants

The normalized target participant pair is mandatory.

A candidate event passes the participant check only when both target participants resolve deterministically to the candidate participants using exact normalized values or approved aliases.

Home/away ordering may be treated as order-insensitive only for bookmakers/pages where the adapter documents and tests that presentation order can legitimately vary. It must never collapse distinct participant identities.

### 6.2 Candidate uniqueness

After deterministic participant matching, exactly one candidate event must remain eligible.

- zero candidates -> `MISMATCHED`/not found;
- more than one eligible candidate -> `AMBIGUOUS` unless additional target context deterministically resolves exactly one.

### 6.3 Competition and scheduled time context

Competition and scheduled time are corroborating identity dimensions when present in the target.

Rules:

- any observed competition value that deterministically contradicts a target competition rejects that candidate;
- when target competition is present and exposed by the page, it must match through exact normalization or an approved alias;
- when target scheduled time is present and exposed, absolute difference must be no more than **15 minutes** for the MVP;
- a time difference greater than 15 minutes is a mismatch, not a fuzzy near-match;
- adapters may use a stricter tolerance but may not widen the shared tolerance without an architecture change.

If the target contains competition and/or scheduled time but the page exposes neither, participant names alone are insufficient for the MVP and event identity is `UNAVAILABLE`.

If one of competition/time is unavailable but the other is positively matched, the event may still be accepted provided the participant pair is unique and no available context signal contradicts the target.

If the target contains neither competition nor scheduled time, a unique deterministic participant-pair match may establish the event.

### 6.4 Event status

Overall event evidence is `MATCHED` only when:

- participant pair is deterministically matched;
- exactly one candidate remains after available target context is applied;
- every available target context signal is non-contradictory;
- when target context exists, at least one competition/time context signal is positively matched.

## 7. Market identity

Market identity is independent from event identity.

A market is `MATCHED` only when:

- normalized market family exactly matches the target family or an approved bookmaker alias;
- any target market context/subtype is also matched;
- the target market period is positively established and matches exactly;
- exactly one eligible market container remains for the requested family/context/period and line combination.

Examples of distinct identities that must not be merged:

- total corners vs total goals;
- match totals vs team totals;
- full match vs first half;
- regulation time vs including overtime;
- Asian total vs ordinary over/under where settlement semantics differ.

For the current MVP, `SelectionTarget.market.period` is required and equals `full_match`. The page/fixture mapping must expose enough reviewed evidence to distinguish that period from first-half or another period.

Period evidence may come from deterministic bookmaker metadata, a reviewed market heading/container identity, or another version-controlled mapping. DOM position, visual proximity, identical line/odds, or the absence of an explicit "first half" label are not sufficient by themselves.

- exact target period -> may contribute to `MARKET_MATCHED`;
- explicitly different period -> `MISMATCHED`;
- period cannot be established -> `UNAVAILABLE`;
- multiple unresolved period interpretations -> `AMBIGUOUS`.

A visually nearby or similarly worded market is not sufficient.

## 8. Numeric line identity

Line values must be represented and compared using decimal-safe strings or arbitrary-precision decimal values, not binary floating-point equality.

Normalize equivalent decimal representations such as `11.50` and `11.5` to the same exact decimal value.

For a line-based target:

- exact normalized decimal equality -> `MATCHED`;
- neighboring line such as `10.5`, `11.0`, `12.0`, `12.5` -> `MISMATCHED`;
- multiple candidates at the exact line that cannot be otherwise distinguished -> `AMBIGUOUS`;
- line not observable -> `UNAVAILABLE`.

No tolerance or nearest-line substitution is permitted.

## 9. Outcome identity

Outcome/side is evaluated separately from market and line.

For directional totals, `OVER` and `UNDER` are distinct immutable target identities.

Approved localized aliases may map deterministically to the canonical outcome (`OVER`, `UNDER`, etc.). A generic positive/negative or left/right DOM position is not sufficient evidence by itself.

Exactly one candidate outcome must resolve to the target side. Zero is not found/mismatch; more than one unresolved candidate is ambiguous.

## 10. Origin identity

The active page origin must be allowed by the selected bookmaker adapter.

Origin evidence is `MATCHED` only when the current top-level location is an approved HTTPS origin. Unsafe or unrelated origins are mismatches and block all selection activation.

A redirect invalidates prior evidence and must be re-evaluated.

## 11. Odds/price representation

Bookmaker price is observational metadata, not selection identity.

When present, use decimal-safe representation:

```ts
type DecimalOddsString = string;

type OddsObservation = Readonly<{
  expected?: DecimalOddsString;
  observed?: DecimalOddsString;
  comparison?: "EQUAL" | "HIGHER" | "LOWER";
  status: "NOT_OBSERVED" | "OBSERVED" | "UNAVAILABLE" | "INVALID";
}>;
```

Exact implementation types may differ, but the semantics are mandatory:

- expected/notified odds may be absent;
- observed odds may be absent;
- comparison is optional and meaningful only when both values are valid;
- no price field belongs to `MatchingEvidenceSnapshot`;
- no price state authorizes or blocks selection activation.

Expected and observed odds remain distinct metadata whenever both exist.

## 12. Odds observation

If the target price is visible without broadening the normal target-selection flow, the adapter may observe it and expose it to the user.

When both valid values exist:

- observed == expected -> `EQUAL`;
- observed > expected -> `HIGHER`;
- observed < expected -> `LOWER`.

If the displayed price cannot be read or parsed, telemetry may report `UNAVAILABLE` or `INVALID`.

None of these states changes target identity.

Odds must never repair a failed event/market/period/line/outcome identity check, and a changed/missing/unreadable price must never invalidate an otherwise exact target.

## 13. Non-gating price behavior

There is no changed-odds acknowledgement gate.

- price equality is not required before activation;
- a higher/lower observed value does not produce `ODDS_CHANGED`;
- missing/unreadable odds do not produce a safe failure by themselves;
- no user acknowledgement is required to continue preparation;
- price observation must not introduce additional retry, wait, navigation, or interaction solely to satisfy an authorization predicate.

NotifyHandler does not calculate surebet validity, ROI, profitability, stake sizing, or whether a displayed price is acceptable.

The user makes those decisions after handoff.

## 14. Selection authorization predicate

Conceptually:

```ts
function mayActivateSelection(
  evidence: MatchingEvidenceSnapshot,
  cancelled: boolean,
): boolean {
  return !cancelled
    && evidence.origin.status === "MATCHED"
    && evidence.event.overall.status === "MATCHED"
    && evidence.market.status === "MATCHED"
    && (lineNotRequired || evidence.line.status === "MATCHED")
    && evidence.outcome.status === "MATCHED";
}
```

The real implementation must additionally verify attempt/evidence-epoch freshness and the current browser/network policy.

Odds are deliberately absent from this predicate.

## 15. Post-activation verification

A successful click is not yet `SELECTION_PREPARED`.

The adapter must verify a bookmaker-specific observable state proving that the exact target outcome is selected, such as a deterministic selected-state attribute or verified bet-slip selection identity.

Post-activation verification must not:

- enter stake values;
- click transaction buttons;
- accept transaction terms;
- interpret presence of an unrelated bet-slip item as success.

Failure to verify the exact selection returns `SELECTION_VERIFICATION_FAILED`.

## 16. Evidence retention

Evidence may be retained for diagnostics within the current execution, but it expires for authorization whenever the evidence epoch changes.

Persisted logs must contain only sanitized normalized evidence and must not contain credentials, cookies, tokens, or unrelated account data.
