# ADR-0005: Allow one bounded same-origin bet-up relay revisit

Status: **Accepted**

Date: 2026-09-23

## Context

ARCH-005 / ADR-0004 deliberately allowed only this relay transition:

```text
exact validated bet-up relay -> expected bookmaker origin
```

and treated any second top-level navigation on `https://www.bet-up.it` as a loop.

Two independent qualifying BOOK-016 workstation runs, one for BET365 and one for SISAL, both stopped before bookmaker arrival with `RELAY_REDIRECT_LIMIT`. Under the merged resolver, that failure can occur only after the exact validated relay entry has already been accepted and another top-level navigation remains on the relay origin.

This is shared relay-state-machine evidence. It does not establish bookmaker market infeasibility and it does not justify arbitrary relay crawling.

The retained diagnostics intentionally do not contain the full second-hop URL. Therefore architecture may approve only behavior supported by the evidence we actually have: **one additional top-level visit to the same canonical relay identity**, not an unknown second path grammar.

## Decision

Amend the restricted relay state machine to permit exactly **one** additional same-origin relay visit before expected-bookmaker arrival.

The accepted sequence is:

```text
ENTRY
  exact https://www.bet-up.it/lnk/<signal-uuid>/<bookmaker-suffix>
        |
        +----> expected bookmaker origin -> RESOLVED
        |
        +----> same canonical relay URL (one time only)
                  |
                  +----> expected bookmaker origin -> RESOLVED
                  |
                  +----> any relay-origin navigation -> RELAY_REDIRECT_LIMIT
```

No other same-origin path is approved by this ADR.

## Canonical relay identity

The immutable structured target already contains:

- canonical signal UUID;
- canonical bookmaker id;
- validated relay suffix/bookmaker binding;
- exact initial relay URL.

The one allowed revisit must satisfy all of the following:

1. scheme exactly `https:`;
2. origin exactly `https://www.bet-up.it`;
3. no URL username/password;
4. no query string;
5. no fragment;
6. path exactly `/lnk/<uuid>/<bookmaker-suffix>`;
7. normalized UUID exactly equals the immutable target signal UUID;
8. suffix resolves through the version-controlled registry to exactly the immutable target bookmaker;
9. canonical href equals the original validated relay href.

A same-origin URL with a different UUID, suffix, query, fragment, credentials, or path is not the reviewed revisit and fails closed.

## Hop budget

The evidence proves that at least one extra same-origin visit occurs in the real upstream flow. It does not prove that two or more are required.

Therefore the maximum additional same-origin hop budget is exactly:

```text
1
```

The initial relay entry is not counted as an additional hop.

After the single permitted revisit is consumed, the next accepted top-level cross-origin transition must be directly to an origin registered for the expected bookmaker adapter.

A second relay-origin visit returns `RELAY_REDIRECT_LIMIT`.

The hop budget is fixed architecture policy. It is not user-configurable, not increased on retry, and not tied to the BOOK-012 interaction-action budget.

## Network validation

Every accepted top-level relay request, including the permitted revisit, repeats fail-closed network validation.

The resolver must:

- re-run public HTTPS / DNS private-internal checks for the relay request;
- preserve SEC-004 request interception for relay-page subresources;
- reject WebSockets during relay resolution;
- validate redirect destinations before any redirected request is made;
- apply the normal expected-bookmaker resolved-target validation before bookmaker arrival.

A same hostname is not exempt from DNS revalidation because DNS rebinding/state can change between requests.

## Cross-origin policy

The only allowed cross-origin destination remains the expected registered bookmaker origin.

- expected bookmaker -> potentially resolve;
- another known bookmaker -> `RELAY_WRONG_FINAL_BOOKMAKER`;
- unknown/affiliate/tracker/intermediary -> `RELAY_INTERMEDIARY_BLOCKED`;
- private/internal/uncertain network destination -> `RELAY_NETWORK_TARGET_BLOCKED`.

This ADR does not authorize an affiliate hop, URL shortener, identity provider, tracker, or arbitrary redirect chain.

## Evidence boundary

The allowed same-origin revisit remains navigation-only metadata.

Neither:

- relay entry;
- relay revisit;
- signal UUID;
- bookmaker suffix;
- successful expected-origin arrival;

can mark event, competition/time, market family/context/period, line, outcome, or odds as matched.

Bookmaker identity matching starts only after expected-bookmaker arrival in a fresh evidence epoch, exactly as before.

## Authentication/challenge boundary

A login, CAPTCHA, MFA, consent challenge, or other interaction requirement on the relay origin remains unsupported.

It returns `RELAY_CHALLENGE_UNSUPPORTED`.

The extra same-origin hop must not be implemented through challenge solving, form filling, generic clicking, script injection, or anti-bot/access-control bypass.

Bookmaker `AUTH_REQUIRED` remains possible only after valid expected-bookmaker arrival.

## Retry and cancellation

Retry/reopen begins again from the immutable initial relay target with a fresh same-origin-hop budget of one.

A previous resolved bookmaker URL or previous second-hop state is never trusted across attempts.

Cancellation/stale-attempt rules remain unchanged and must prevent late navigation from entering matching or selection activation.

## Diagnostics and privacy

Diagnostics may record:

- navigation kind;
- relay origin;
- same-origin hop count `0|1`;
- whether the second hop was canonical-match or rejected by category;
- sanitized failure code;
- expected/final origin category;
- timings;
- hashed/truncated signal identifier where already permitted.

Do not persist/log by default:

- full relay URL;
- full signal UUID;
- query/fragment data;
- raw redirect targets;
- cookies/session state;
- authorization headers or local-ingress tokens.

A rejected non-canonical same-origin target should be reported by reason category, not by leaking its full URL.

## Failure semantics

Use existing relay failures where possible:

- malformed/unreviewed same-origin URL -> `RELAY_INVALID`;
- same-origin path UUID differs from immutable signal -> `RELAY_SIGNAL_MISMATCH`;
- suffix differs from immutable bookmaker -> `RELAY_BOOKMAKER_MISMATCH`;
- second additional same-origin visit -> `RELAY_REDIRECT_LIMIT`;
- unexpected cross-origin intermediary -> `RELAY_INTERMEDIARY_BLOCKED`;
- wrong known bookmaker -> `RELAY_WRONG_FINAL_BOOKMAKER`;
- forbidden network target -> `RELAY_NETWORK_TARGET_BLOCKED`;
- unsupported relay challenge -> `RELAY_CHALLENGE_UNSUPPORTED`;
- expected bookmaker not reached in the bounded time -> `RELAY_UNRESOLVED`.

All remain pre-activation failures with `activation: "NOT_ATTEMPTED"`.

## Rejected alternatives

### Arbitrary same-origin relay crawling

Rejected. Same-origin does not make an arbitrary path trustworthy, and the live evidence does not establish another path grammar.

### Two-or-more relay revisits

Rejected. No evidence currently requires more than one additional relay visit.

### Configurable hop budget

Rejected. It would turn a reviewed finite protocol into an operational tuning knob and could conceal loops.

### Automatic retry after RELAY_REDIRECT_LIMIT

Rejected. Repeated attempts against the same unresolved state are not evidence and could broaden traffic without changing the contract.

### Follow redirect chain with a generic HTTP client

Rejected for the same reasons as ADR-0004: it would create a second privileged network path outside the browser gateway's DNS/origin/cancellation controls.

## Consequences

### Bookmaker Automation Engineer

Revise the shared relay resolver, not individual adapters:

- store immutable relay signal/bookmaker identity in active resolver state;
- track `sameOriginHopCount`;
- allow one canonical same-relay revisit;
- revalidate DNS on that revisit;
- require expected-bookmaker destination immediately afterward;
- add deterministic fixture/browser regressions.

### Security & Compliance Engineer

Review the implementation for:

- open-redirect expansion;
- DNS rebinding between relay visits;
- query/fragment/userinfo/path smuggling;
- signal/suffix mismatch handling;
- redirect validation before request;
- subresource/WebSocket boundaries;
- privacy/redaction;
- no challenge/access-control bypass.

### QA / Integration Engineer

Run deterministic relay-state-machine regressions before another live validation run.

### Product / live validation

Do not request another live BOOK-016-style run until the resolver revision and its Security/QA gates are merged.

If the real flow next produces a different same-origin path, second additional relay visit, or another intermediary, fail closed and record that new sanitized evidence. Do not widen this ADR by inference.

## References

- ARCH-007 / #147
- BOOK-016 / #104
- BOOK-017 / #124
- SEC-004 / #125
- DEVOPS-012 / #143
- ADR-0004
- `specs/structured-ingestion-v2.md`
- `packages/automation/src/page-runtime.ts`
- `docs/safety-boundaries.md`
- `docs/threat-model.md`
