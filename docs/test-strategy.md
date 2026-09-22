# Test strategy

Status: **Architecture baseline for Milestone 1, amended by ARCH-003, ARCH-004, ARCH-005, and ARCH-006**

The test strategy prioritizes deterministic wrong-selection prevention, automatic notification-to-browser startup correctness, and transaction-boundary enforcement. Routine automated tests must not require bookmaker credentials, live accounts, or real betting transactions.

## 1. Critical end-to-end contracts

Both accepted ingestion contracts must converge on the same two-leg runtime without pre-execution user action.

### 1.1 Legacy text

```text
text notification
  -> parse/validate
  -> preserve recommendation source order
  -> resolve recommendation[0] as primary
  -> build exactly two distinct-bookmaker targets
  -> validate adapter/navigation preflight
  -> automatically dispatch both legs
```

Required legacy cases include valid automatic primary selection, no renderer/start-button dependency, invalid-primary/no-later-fallback, same-bookmaker rejection, unsupported-bookmaker rejection, and unsafe navigation preflight.

### 1.2 Structured direct-pair v1

```text
authenticated loopback POST
  -> media/size + schema validation
  -> freshness + idempotency
  -> validate explicit two distinct legs
  -> validate required direct match links
  -> build the same two SelectionTargets / ExecutionPlan
  -> automatically dispatch both legs
```

Required structured cases:

1. valid authenticated request -> exactly one execution and exactly two worker starts;
2. missing/invalid bearer token -> zero executions/navigation;
3. non-loopback/invalid Host or unexpected browser Origin -> zero executions/navigation;
4. wrong media type, malformed JSON, or >64 KiB request -> zero executions/navigation;
5. stale/future `sentAt` -> zero executions/navigation;
6. same id + same normalized payload -> same execution reference, zero duplicate starts;
7. same id + different payload -> conflict, zero new execution;
8. same-bookmaker/unsupported pair -> semantic failure before navigation;
9. credential-bearing/off-origin/private/internal direct link -> failure before navigation;
10. direct link reaches wrong event -> matching failure, not link trust;
11. blocked/stale/insufficient structured direct link -> no generic-discovery fallback;
12. delayed/absent renderer observation -> startup still occurs.

Both paths must preserve the same authentication, odds, cancellation, stale-evidence, selection-gate, and transaction-boundary regressions.

### 1.3 Structured direct-pair v2 relay navigation

Relay-aware regressions must prove that navigation resolution and identity matching remain separate:

1. v1 direct-bookmaker payload still behaves unchanged;
2. valid v2 `bookmaker-direct` uses the existing direct policy;
3. valid `https://www.bet-up.it/lnk/<uuid>/<expected-suffix>` relay passes syntax preflight;
4. malformed path/userinfo/query/fragment is rejected before worker navigation;
5. suffix/bookmaker mismatch is rejected before worker navigation;
6. two relay legs with different signal UUIDs are rejected before worker navigation;
7. relay DNS/private/internal target rejection produces zero bookmaker matching;
8. valid relay -> expected bookmaker origin begins matching in a fresh evidence epoch;
9. relay -> unexpected third-party intermediary is blocked;
10. relay -> wrong bookmaker is blocked;
11. relay loop/revisit/transition budget fails safely;
12. relay challenge/auth wall is a relay failure, not `AUTH_REQUIRED`;
13. expected bookmaker arrival + wrong event fails through ordinary event matching;
14. relay metadata never marks event/market/line/outcome/odds as `MATCHED`;
15. cancellation during relay resolution prevents later matching/activation;
16. retry/reopen re-resolves the original relay and does not trust a cached final URL;
17. diagnostics omit full relay URL and full signal UUID;
18. no credential/MFA/CAPTCHA/stake/wager/bypass capability is added.

## 2. Test pyramid

### Pure unit tests

Run without Electron or a browser for:

- notification/domain normalization;
- recommendation source-order preservation;
- deterministic primary recommendation resolution;
- no-fallback behavior;
- selection-target validation, including required market period;
- primary execution-plan construction;
- two-distinct-bookmaker invariant;
- leg state-machine transition guards;
- automatic-start trigger predicates;
- stale attempt/evidence rejection;
- decimal line parsing/equality;
- odds comparison;
- text normalization and approved alias mappings;
- matching-policy authorization predicate;
- URL/origin validation;
- v2 relay grammar/suffix/signal consistency;
- typed navigation candidate normalization;
- error/recoverability mapping.

### Shared adapter contract tests

Every bookmaker adapter must run against the same behavioral contract using deterministic sanitized fixture pages and a real browser automation runtime where useful.

Required cases:

1. exact event + market + line + outcome + expected odds -> verified preparation;
2. similar but wrong event -> no activation;
3. duplicate event candidates -> ambiguous, no activation;
4. wrong competition/time context -> no activation;
5. wrong market family/context -> no activation;
6. wrong market period (for example first half with otherwise identical total-corners line/side/odds) -> no activation;
7. unavailable/ambiguous required period evidence -> no activation;
8. neighboring line -> no activation;
9. duplicate exact-line candidates that cannot be distinguished -> no activation;
10. wrong outcome side -> no activation;
11. changed higher odds -> `ODDS_CHANGED`, no activation before acknowledgement;
12. changed lower odds -> `ODDS_CHANGED`, no activation before acknowledgement;
13. acknowledged odds change followed by another price change -> pause again;
14. unreadable odds -> `ODDS_UNAVAILABLE`, no activation under MVP policy;
15. manual login page -> `AUTH_REQUIRED`, no credential automation;
16. resume after manual login -> complete revalidation before activation;
17. unsafe deep link -> blocked before navigation;
18. redirect to unapproved origin -> blocked;
19. cancellation during wait/matching -> no later activation;
20. post-click selected-state verification failure -> not `READY_FOR_USER`;
21. stale event from old attempt/evidence epoch -> ignored;
22. interface/capability audit -> no credential/stake/submit transaction operations.

### Browser integration tests

Use Playwright against local fixture servers/pages to verify:

- worker/page lifecycle;
- automatic start request opens the intended isolated browser session without a renderer start action;
- headed/headless-compatible adapter behavior where applicable;
- origin/redirect policy;
- restricted relay resolution, intermediary blocking, wrong-bookmaker rejection, and fresh-evidence handoff;
- login interruption and resume state handling without real credentials;
- independent two-leg browser sessions;
- cancellation/cleanup;
- selection-gate enforcement;
- fixture DOM mutations that invalidate evidence.

CI normally runs browser fixtures headless. Headed local smoke tests validate manual handoff/window behavior.

### Application integration tests

Use fake adapters/worker test doubles to verify:

- notification receipt invokes parsing automatically;
- the first source-order recommendation becomes the plan recommendation id without a user-selected id;
- invalid primary recommendation cannot navigate or start and cannot fall through to a later option;
- both valid legs are automatically dispatched once preflight succeeds;
- renderer preview/summary is informational and not a synchronization prerequisite;
- exactly two independent leg states exist;
- partial success/failure remains visible;
- one leg's retry/cancel/login pause does not rewrite the other;
- `ODDS_CHANGED` displays expected and observed values;
- only an acknowledgement of the exact observed value can continue;
- app never reports full pair readiness unless both current legs are `READY_FOR_USER`;
- renderer/core messages contain no credentials, cookies, stake command, or submit-bet command.

Legacy APP-001 pair-selection/start behavior may be tested as optional tooling, but tests must not treat it as required for the production automatic path.

## 3. Automatic-start harness requirements

The application test harness should expose:

- a notification-receipt entry point;
- deterministic parser/domain fixture input;
- a fake adapter registry with explicit supported/unsupported bookmakers;
- navigation-preflight stubs;
- worker start spies per leg;
- renderer observer spies that can intentionally block/delay to prove they are non-gating;
- deterministic clock/timestamps where needed.

Core assertions:

- worker start count is exactly zero for preflight-invalid input;
- worker start count is exactly two for a valid plan;
- started targets correspond exactly to primary recommendation index 0;
- no renderer/user event is necessary between notification receipt and the first worker start;
- a valid later recommendation cannot rescue an invalid primary;
- source order is not sorted/re-ranked by ROI, bookmaker name, odds, or display order;
- after dispatch, each leg's state and failures are independent.

### 3.1 Structured-ingress harness requirements

The application/security harness should provide:

- a real loopback-bound test listener or equivalent socket-level boundary test;
- deterministic local bearer token injection/rotation;
- Host/Origin controls;
- request body/media-type bounds;
- deterministic clock for `sentAt` freshness;
- bounded idempotency store and payload-hash spy;
- execution creation and worker-start spies;
- navigation spy proving rejected requests never reach the worker.

The harness must never require bookmaker credentials or live bookmaker access.

## 4. Deterministic fixture rules

Fixture content must be sanitized and synthetic or otherwise safe to store in the repository.

Notification fixtures must include:

- multiple valid recommendations in deliberate source order;
- first-invalid/later-valid recommendation;
- same-bookmaker primary;
- unsupported-bookmaker primary;
- deep-link/navigation-preflight rejection;
- valid primary with informational suggested stakes that never enter execution commands.

Browser fixtures should model the minimum page behaviors needed to exercise adapter logic: event lists/cards, market containers with deterministic period identity, line labels, outcome controls, displayed odds, login-required state, selected-state representation, and allowed/blocked redirects. Include a first-half near-miss sharing the same family/context/line/side/odds as a full-match target.

Do not store real credentials, authenticated account HTML, cookies, access tokens, or personal data in fixtures. Fixtures should deliberately include near-miss cases rather than only happy paths.

## 5. Contract-test adapter harness

The QA implementation should provide one reusable harness that supplies:

- immutable `SelectionTarget`;
- fresh browser/session per case unless lifecycle is under test;
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

## 6. Transaction-boundary tests

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
- selection activation goes through the shared activation gate;
- production notification handling does not depend on renderer-selected `recommendedOptionId` or a renderer-issued `START`.

## 7. Security/privacy tests

Tests should verify:

- unsafe URL schemes are rejected;
- structured ingress binds loopback-only by default and rejects unauthenticated/unexpected browser-origin requests;
- local ingress token/Authorization headers are absent from logs/artifacts;
- replay/idempotency rules prevent duplicate browser starts;
- unsupported origins and cross-origin redirects are rejected;
- relay resolution allows only the reviewed direct transition to the expected bookmaker and blocks private/internal resolved targets;
- private/internal network navigation is rejected when input-controlled;
- preflight-invalid primary targets create zero browser navigation attempts;
- diagnostics redact/omit cookies, tokens, authorization headers, and credential values;
- ephemeral browser profile directories are isolated and cleaned according to runtime policy;
- one leg cannot address the other leg's browser/session handles.

## 8. State-machine tests

Generate or enumerate allowed transitions from `specs/execution-contract.md` and reject all others.

Specific regressions:

- valid plan creation automatically schedules both `PENDING -> OPENING` paths without a user start transition;
- `PENDING` cannot remain indefinitely waiting for renderer approval in the normal valid path;
- `AUTH_REQUIRED` cannot jump directly to activation;
- `ODDS_CHANGED` cannot jump directly to activation;
- resume/continue creates fresh evidence;
- `FAILED_SAFE` is never treated as prepared;
- `SELECTION_PREPARED` requires activation plus verification path;
- stale async events cannot move a newer attempt backwards/forwards;
- cancellation prevents later activation.

## 9. Latency tests and diagnostics

Latency optimization must never bypass validation. Tests should make these timestamps available using a deterministic clock where possible:

- notification received;
- parse/primary-plan ready;
- each worker start dispatched;
- each browser open requested;
- first page ready.

Regression tests should fail on accidental synchronous renderer waits in the path from plan-ready to worker-start. Hard production latency thresholds may be introduced later once runtime baselines exist.

## 10. Live verification policy

Live bookmaker verification is not part of routine CI and must not be required for merge confidence.

If a bookmaker integration needs manual live verification and automated access is permitted:

- use navigation/read/selection-preparation boundaries only;
- do not automate credentials/MFA/CAPTCHA;
- do not enter stakes;
- do not submit/confirm bets;
- do not bypass technical controls;
- record sanitized outcomes in documentation/issues rather than account data.

A bookmaker that cannot be exercised safely/permittedly remains unsupported rather than receiving bypass logic.

## 11. Merge/release gates

A change affecting ingestion, primary resolution, matching, adapter behavior, browser capability, or orchestration is not ready when any of the following is true:

- a valid notification requires preview acknowledgement, pair selection, execution confirmation, or a manual start action;
- primary source order is not preserved;
- an invalid primary can silently fall through to a later recommendation;
- preflight-invalid input can start/navigate either bookmaker leg;
- a valid primary does not dispatch exactly two legs;
- required shared contract tests fail;
- a near-match fixture can activate a selection;
- a first-half/other-period market can satisfy a `full_match` target;
- missing required market-period evidence can be treated as matched;
- ambiguity can be represented as success;
- changed odds can be silently ignored;
- stale evidence can authorize activation;
- cancellation can race into a later activation;
- stake/bet-submit/credential automation becomes reachable;
- unsafe navigation is possible from untrusted notification data;
- structured ingress can bind non-loopback by default, accept unauthenticated/oversized/stale/replayed input, or create duplicate execution;
- structured-v1 direct-link failure can silently fall back to generic discovery;
- v1 semantics are silently widened to relay origins;
- v2 relay can traverse an unreviewed intermediary/wrong bookmaker or authorize positive identity evidence;
- sensitive authentication/session data is written to logs/artifacts.
