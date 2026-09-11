# Test strategy

Status: **Architecture baseline for Milestone 1**

The test strategy prioritizes deterministic wrong-selection prevention and transaction-boundary enforcement. Routine automated tests must not require bookmaker credentials, live accounts, or real betting transactions.

## 1. Test pyramid

### Pure unit tests

Run without Electron or a browser for:

- notification/domain normalization;
- selection-target validation;
- execution-plan construction;
- leg state-machine transition guards;
- stale attempt/evidence rejection;
- decimal line parsing/equality;
- odds comparison;
- text normalization and approved alias mappings;
- matching-policy authorization predicate;
- URL/origin validation;
- error/recoverability mapping.

### Shared adapter contract tests

Every bookmaker adapter must run against the same behavioral contract using deterministic sanitized fixture pages and a real browser automation runtime where useful.

Required cases:

1. exact event + market + line + outcome + expected odds -> verified preparation;
2. similar but wrong event -> no activation;
3. duplicate event candidates -> ambiguous, no activation;
4. wrong competition/time context -> no activation;
5. wrong market family/context -> no activation;
6. neighboring line -> no activation;
7. duplicate exact-line candidates that cannot be distinguished -> no activation;
8. wrong outcome side -> no activation;
9. changed higher odds -> `ODDS_CHANGED`, no activation before acknowledgement;
10. changed lower odds -> `ODDS_CHANGED`, no activation before acknowledgement;
11. acknowledged odds change followed by another price change -> pause again;
12. unreadable odds -> `ODDS_UNAVAILABLE`, no activation under MVP policy;
13. manual login page -> `AUTH_REQUIRED`, no credential automation;
14. resume after manual login -> complete revalidation before activation;
15. unsafe deep link -> blocked before navigation;
16. redirect to unapproved origin -> blocked;
17. cancellation during wait/matching -> no later activation;
18. post-click selected-state verification failure -> not `READY_FOR_USER`;
19. stale event from old attempt/evidence epoch -> ignored;
20. interface/capability audit -> no credential/stake/submit transaction operations.

### Browser integration tests

Use Playwright against local fixture servers/pages to verify:

- worker/page lifecycle;
- headed/headless-compatible adapter behavior where applicable;
- origin/redirect policy;
- login interruption and resume state handling without real credentials;
- independent two-leg browser sessions;
- cancellation/cleanup;
- selection-gate enforcement;
- fixture DOM mutations that invalidate evidence.

CI normally runs browser fixtures headless. Headed local smoke tests validate manual handoff/window behavior.

### Application integration tests

Use fake adapters or worker test doubles to verify:

- exactly two independent leg states;
- partial success/failure remains visible;
- one leg's retry/cancel/login pause does not rewrite the other;
- user cannot execute invalid/ambiguous plan input;
- `ODDS_CHANGED` displays expected and observed values;
- only an acknowledgement of the exact observed value can continue;
- app never reports full pair readiness unless both current legs are `READY_FOR_USER`;
- renderer/core messages contain no credentials, cookies, stake command, or submit-bet command.

## 2. Deterministic fixture rules

Fixture content must be sanitized and synthetic or otherwise safe to store in the repository.

Fixtures should model the minimum page behaviors needed to exercise adapter logic:

- event lists/cards;
- market containers;
- line labels;
- outcome controls;
- displayed odds;
- login-required state;
- selected-state representation;
- allowed and blocked redirects.

Do not store real credentials, authenticated account HTML, cookies, access tokens, or personal data in fixtures.

Fixtures should deliberately include near-miss cases rather than only happy paths.

## 3. Contract-test adapter harness

The QA implementation should provide one reusable harness that supplies:

- immutable `SelectionTarget`;
- fresh browser/session per case unless the case explicitly tests lifecycle;
- controlled fixture URL/origin registration;
- event recorder for states/evidence;
- selection activation spy/gate;
- cancellation control;
- deterministic clock where needed.

Core assertions include:

- activation count is exactly zero for every negative/ambiguous case;
- activation count is at most one for a successful attempt;
- only the candidate tied to current matched evidence can be activated;
- no activation occurs after cancellation or from stale evidence;
- success requires post-activation selected-state verification.

## 4. Transaction-boundary tests

Release-gate tests must demonstrate that public application/core/worker/adapter contracts do not expose:

- credential entry;
- MFA/OTP/CAPTCHA automation;
- stake entry/change;
- bet place/submit/confirm/finalize;
- deposit/withdraw/cash-out;
- access-control/anti-bot/geo/rate-limit bypass.

Static/package-boundary tests should also ensure:

- renderer cannot import Playwright;
- core/application code cannot import bookmaker DOM modules;
- adapters receive restricted browser capabilities rather than unrestricted application privileges;
- selection activation goes through the shared activation gate.

## 5. Security/privacy tests

Tests should verify:

- unsafe URL schemes are rejected;
- unsupported origins and cross-origin redirects are rejected;
- private/internal network navigation is rejected when input-controlled;
- diagnostics redact/omit cookies, tokens, authorization headers, and credential values;
- ephemeral browser profile directories are isolated and cleaned according to runtime policy;
- one leg cannot address the other leg's browser/session handles.

## 6. State-machine tests

Generate or enumerate allowed transitions from `specs/execution-contract.md` and reject all others.

Specific regressions:

- `AUTH_REQUIRED` cannot jump directly to activation;
- `ODDS_CHANGED` cannot jump directly to activation;
- resume/continue creates fresh evidence;
- `FAILED_SAFE` is never treated as prepared;
- `SELECTION_PREPARED` requires activation plus verification path;
- stale async events cannot move a newer attempt backwards/forwards;
- cancellation prevents later activation.

## 7. Live verification policy

Live bookmaker verification is not part of routine CI and must not be required for merge confidence.

If a bookmaker integration needs manual live verification and automated access is permitted:

- use navigation/read/selection-preparation boundaries only;
- do not automate credentials/MFA/CAPTCHA;
- do not enter stakes;
- do not submit/confirm bets;
- do not bypass technical controls;
- record sanitized outcomes in documentation/issues rather than account data.

A bookmaker that cannot be exercised safely/permittedly remains unsupported rather than receiving bypass logic.

## 8. Merge/release gates

A change affecting matching, adapter behavior, browser capability, or orchestration is not ready when any of the following is true:

- required shared contract tests fail;
- a near-match fixture can activate a selection;
- ambiguity can be represented as success;
- changed odds can be silently ignored;
- stale evidence can authorize activation;
- cancellation can race into a later activation;
- stake/bet-submit/credential automation becomes reachable;
- unsafe navigation is possible from untrusted notification data;
- sensitive authentication/session data is written to logs/artifacts.
