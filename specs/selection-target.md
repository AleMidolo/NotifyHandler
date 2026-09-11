# Selection target specification

`SelectionTarget` is the normalized, bookmaker-agnostic instruction for one leg of a chosen surebet pair. It is produced by domain/application logic and consumed by a bookmaker adapter.

The target describes **what must be selected**, not **how a bookmaker page is manipulated**.

## 1. Conceptual structure

```text
SelectionTarget
  id: string
  bookmaker: canonical bookmaker id
  event:
    participantA: string
    participantB: string
    competition?: string
    scheduledAt?: normalized date-time
    sourceDisplay: string
  market:
    family: normalized market family
    context?: normalized subtype/context
    line?: decimal
    sourceLabel: string
  outcome:
    side: normalized outcome id
    sourceLabel?: string
  expectedOdds: decimal
  deepLink?: validated-candidate URL
  provenance:
    notificationOptionId: string
    sourceOfferId/reference: string
```

Implementation types may differ, but these semantics must remain representable.

## 2. Invariants

A target is valid for execution only when:
- `bookmaker` resolves to one supported adapter;
- event identity contains sufficient information for the matching policy;
- market semantics are explicit;
- a required line/threshold is present for line-based markets;
- outcome/side is explicit;
- expected odds are valid decimal odds;
- provenance resolves back to the chosen notification option/offer;
- any supplied deep link is treated as untrusted until navigation validation passes.

A recommended MVP option produces exactly two valid `SelectionTarget` values.

## 3. Adapter contract expectations

Given a target, an adapter must independently establish evidence for:

1. supported/allowed bookmaker page or origin;
2. target event identity;
3. target market family/context;
4. exact target line when applicable;
5. exact target side/outcome;
6. observed odds where available;
7. page state sufficient to safely perform the selection click.

The adapter must not reinterpret the target into a different line, side, event, or market simply because the requested candidate cannot be found.

## 4. Matching evidence

Architecture should define a structured evidence/result model. It should be capable of distinguishing at least:
- `not_checked`;
- `matched`;
- `not_matched`;
- `ambiguous`;
- `unavailable`.

Evidence should include safe, diagnosable details such as normalized text/identifiers observed for candidates, but must avoid sensitive session/authentication data.

A selection is permitted only when all identity dimensions required by policy are positively matched. An `ambiguous`, `not_matched`, or required `unavailable` identity dimension must prevent the click.

## 5. Event matching principles

Participant names alone may not always be sufficient. Matching policy should use competition and scheduled date/time context where available and meaningful.

Adapters may implement bookmaker-specific normalization, aliases, ordering rules, or localized labels, but these rules must be deterministic/tested. Fuzzy similarity must never by itself authorize a click when multiple plausible candidates exist.

## 6. Market/line matching principles

Market family and line are separate identity dimensions.

For example, for `U/O CORNER 11.5` + `OVER`:
- total-corners 11.5 is not equivalent to goals 11.5;
- total-corners 11.5 is not equivalent to total-corners 10.5 or 12.5;
- OVER is not equivalent to UNDER;
- a neighboring DOM row is not evidence of the requested line.

The adapter should parse/normalize displayed line values and compare them exactly according to the shared numeric policy.

## 7. Odds semantics

`expectedOdds` comes from the notification and is immutable input evidence.

The adapter should return `observedOdds` when available and an explicit comparison result, conceptually:
- equal within agreed decimal representation;
- changed higher;
- changed lower;
- unavailable/unreadable.

Odds comparison does not replace identity matching. An exact odds value on the wrong candidate is not evidence that the candidate is correct.

## 8. Result semantics

The shared adapter result should be able to express at least:
- page opened/waiting;
- manual login required;
- event matched/not matched/ambiguous;
- market matched/not matched/ambiguous;
- line matched/not matched/ambiguous;
- outcome matched/not matched/ambiguous;
- observed odds and comparison;
- selection prepared;
- cancelled;
- safe failure with reason code/evidence.

A `selection prepared` result means only that the target outcome has been selected/clicked in the bookmaker UI. It must not imply that a stake was entered or a bet was submitted.

## 9. Capability exclusions

The adapter interface must not expose capabilities for:
- receiving or entering credentials;
- handling MFA/OTP/CAPTCHA;
- entering/changing stake amounts;
- clicking submit/place/confirm bet actions;
- deposits/withdrawals/cash-out;
- bypassing access controls, anti-bot, rate-limit, or geo restrictions.

These are intentionally outside the product contract.

## 10. Retry and revalidation

A retry, resume after manual login, redirect, page refresh, or significant page-state change must not blindly reuse stale matching evidence. Required identity checks must be performed again before selection when prior evidence may no longer be valid.

## 11. Test contract

Shared adapter contract tests should exercise a fake/sanitized page model and assert that:
- exact target can produce `selection prepared`;
- wrong event never clicks;
- wrong market never clicks;
- neighboring line never clicks;
- wrong side never clicks;
- duplicate/ambiguous candidates never click;
- changed odds remain visible as changed;
- manual-login state does not invoke credential automation;
- cancellation prevents further click attempts;
- no adapter capability can enter stakes or submit a bet.
