# ADR-0002: Automatic primary-recommendation startup

- Status: Accepted
- Date: 2026-09-11
- Decision owner: Software Architect
- Related: `ARCH-003`, issue #22, `docs/product-requirements.md`, `specs/notification-format.md`, `specs/execution-contract.md`

## Context

The original MVP architecture required the application to display a parsed preview, ask the user to choose a recommended pair, show an execution summary, and wait for an explicit start action before browser automation.

The product requirement changed on 2026-09-11. Notification-to-browser latency is now a first-class requirement, and a valid notification must proceed automatically without pre-execution user interaction.

The notification protocol already carries ordered recommended options. For the initial protocol, source order is semantically meaningful and the first recommendation is the authoritative primary recommendation.

The change must not weaken wrong-selection prevention, navigation safety, authentication boundaries, changed-odds handling, cancellation/freshness protections, or the transaction boundary.

## Decision

For the initial notification contract, NotifyHandler will automatically execute the **first recommended option in preserved source order**.

The normal flow is:

```text
notification receipt
  -> deterministic parse/validation
  -> primary recommendation = recommendedOptions[0]
  -> exactly two distinct SelectionTarget legs
  -> adapter + navigation preflight for both legs
  -> immutable ExecutionPlan
  -> automatic dispatch of both leg starts
  -> independent browser/adapter execution
```

No parsed-preview acknowledgement, pair-selection prompt, execution-summary confirmation, or user start action exists in the normal valid-notification path.

Parsed/normalized notification data and exact targets may still be displayed, but rendering is asynchronous observability and is not a prerequisite for browser startup.

## Primary-option failure policy

If recommendation index `0` is malformed, ambiguous, references unsupported bookmakers, resolves to fewer/more than two legs, resolves both legs to the same bookmaker, or otherwise fails deterministic preflight:

- execution fails safely before bookmaker navigation;
- no worker leg is started;
- the user is not asked to choose another recommendation;
- recommendation index `1+` is not used as a fallback.

This prevents the application from silently changing the notification producer's selected strategy.

A future protocol may define an explicit primary/preferred marker. Such behavior requires a versioned notification-spec change and must not be inferred heuristically.

## Ownership

### Domain/parser

Must preserve `recommendedOptions` source order exactly and provide deterministic references/errors.

### Core/application

Owns automatic primary resolution, execution-plan construction, adapter/navigation preflight, and automatic two-leg dispatch.

The production ingestion path must not depend on a renderer-provided `recommendedOptionId` or renderer `START` command.

### Renderer

Is an unprivileged observability and post-start recovery surface. It may display the primary option/targets and execution state, but it does not authorize initial execution.

### Worker/adapters

Existing `start` APIs remain worker lifecycle operations. The core invokes them automatically after plan readiness. Matching, origin, odds, freshness, cancellation, and selection-gate rules are unchanged.

## Concurrency

Both legs should be scheduled as soon as safely practical after shared preflight succeeds. Concurrent dispatch is preferred because one bookmaker launch should not unnecessarily delay the other.

Both targets are preflighted before intentional dispatch so a known invalid/unsupported second leg cannot cause a one-sided navigation merely because the first leg was processed first.

Once dispatch begins, runtime failures remain independent: a browser launch failure or execution interruption on one leg does not rewrite the other leg's state.

## Preserved interruptions

Automatic startup removes only routine pre-execution user gates.

The following execution-time user interactions remain valid:

- `AUTH_REQUIRED`: the affected leg pauses for manual bookmaker authentication;
- `ODDS_CHANGED`: the affected leg pauses under the accepted exact-observed-odds acknowledgement policy;
- recovery controls such as retry, reopen, cancel, and restart;
- manual stake entry, review, and final bet submission after handoff.

These interactions occur after automatic execution has begun and do not restore a generic plan-confirmation step.

## Safety invariants preserved

Automatic startup does not alter these rules:

- event, market/context, exact line, and outcome must independently match;
- fuzzy/nearest candidates cannot authorize selection;
- deep links are untrusted and origins/redirects remain allow-listed;
- stale evidence cannot authorize a click;
- cancellation prevents later activation for the cancelled attempt;
- changed odds remain explicit;
- adapters have no credential/MFA/CAPTCHA, stake-entry, bet-submission, deposit/withdrawal, or bypass capabilities;
- final selection activation remains behind `SelectionActivationGate`.

## Implementation consequences

The current domain API accepts a caller-selected `recommendedOptionId` when building an execution plan. Implementations may retain that lower-level API, but APP-002 must add a production composition/API that derives the id from `notification.recommendedOptions[0]` and cannot receive it from normal UI choice.

The current APP-001 preview/recommendation selector may remain for diagnostics or optional tooling, but normal notification receipt must bypass it as an execution gate.

Tests must prove that delaying or disabling renderer preview rendering does not delay worker startup.

## Consequences

### Positive

- lower notification-to-browser-open latency;
- deterministic behavior without user choice races;
- source-selected recommendation semantics remain intact;
- UI rendering latency cannot block browser startup;
- downstream orchestration has one clear automatic entry path.

### Costs / risks

- malformed primary recommendations cannot be manually corrected inline; they fail safely;
- automatic browser opening increases the importance of strict input, adapter, and navigation preflight;
- application integration tests must cover races between fast execution events and slower renderer initialization;
- users lose the old opportunity to choose an alternate recommendation before execution, by product design.

## Rejected alternatives

### Keep preview/confirmation but auto-select recommendation

Rejected because it still adds a pre-execution latency gate contrary to the updated product requirement.

### Automatically choose the first valid recommendation

Rejected because skipping an invalid primary and using a later option silently changes source semantics.

### Rank recommendations by odds/ROI/bookmaker preference

Rejected because no such ranking contract exists in the notification protocol and it would make behavior dependent on application heuristics.

### Let the renderer send automatic `START` after rendering

Rejected because renderer lifecycle/render timing would remain in the critical startup path. The core owns automatic dispatch.
