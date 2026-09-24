# End-to-end workflow

## 1. Notification receipt and parsing

1. A notification transport supplies notification text or structured data. The planned local bot integration uses a loopback HTTP/webhook transport with a versioned structured payload.
2. Transport passes raw/structured content to the core normalization path without bookmaker-specific browser behavior.
3. Parsing and validation start immediately.
4. Parser returns either a normalized notification or explicit validation errors.
5. A normalized interpretation may be displayed for observability, but it does not require user acknowledgement and does not gate execution.

No browser action occurs until the notification and resulting targets satisfy the deterministic validation and navigation-safety contracts. There is no normal preview-approval step.

## 2. Automatic execution-pair resolution

Two compatible input modes are supported by product policy:

1. **Legacy textual notification:** preserve recommended options in source order and use the first recommendation as the authoritative primary option.
2. **Versioned structured bot notification:** v1 accepts the authoritative pair with direct bookmaker links; v2 accepts the same authoritative pair with typed `bookmaker-direct` or `betup-relay` navigation.

The application never asks the user which pair to choose. Either input mode must resolve deterministically to exactly two distinct valid `SelectionTarget` legs. A malformed, ambiguous, unsupported, or same-bookmaker pair fails safely before bookmaker navigation; no alternate pair is silently substituted.

Each leg contains bookmaker, event identity/context, market/period, line, outcome, and optional navigation. Expected/notified odds may be retained as informational metadata when present.

## 3. Automatic pre-execution validation and immediate start

Execution starts automatically as soon as all of the following are true:
- the notification is valid;
- the authoritative pair (legacy primary recommendation or structured explicit pair) resolves deterministically to exactly two valid, distinct bookmaker legs;
- both bookmakers have supported adapters;
- targets contain sufficient identity information for the matching policy;
- supplied navigation targets pass origin/deep-link safety checks required before use;
- structured requests have passed loopback authentication, media/size bounds, versioned schema, freshness, and idempotency checks;
- v2 relay candidates have passed relay grammar/suffix/signal-consistency preflight.

There is no pre-execution confirmation button, no recommended-option selector, and no requirement that the user approve an execution summary.

The application may display the normalized notification and exact two targets while execution is already starting.

If any precondition fails, no bookmaker navigation occurs and the failure is surfaced explicitly.

## 4. Two-leg execution

The orchestrator creates two independent leg executions and should start both as soon as safely practical. They may run concurrently according to the architecture, but neither leg's state may overwrite or hide the other.

Suggested leg lifecycle:

`pending -> opening -> waiting_for_page -> matching_event -> matching_market -> matching_line? -> matching_outcome -> activating_selection -> verifying_selection -> selection_prepared -> ready_for_user`

Possible interruption/terminal states include:
- `manual_login_required`;
- `failed_safely`;
- `cancelled`.

Observed/notified odds may be displayed as informational state but never create an action-required leg state.

Architecture may refine these names while preserving their semantics.

## 5. Matching sequence

For each leg the adapter should:

1. resolve typed navigation: v1/direct v2 opens the validated bookmaker candidate; relay v2 runs the restricted `bet-up.it -> expected bookmaker` resolver first; legacy input uses its permitted approved entry behavior. No navigation link/relay metadata counts as event-match evidence;
2. wait for an allowed page state;
3. detect whether manual authentication is required and pause if so;
4. locate candidate event(s);
5. verify event identity using available participants, competition, and date/time context;
6. locate and verify the requested market family/context and exact period;
7. verify the exact line/threshold when required;
8. locate and verify the requested side/outcome;
9. optionally observe displayed odds when already available without broadening the normal target-selection flow;
10. submit the candidate through the shared activation gate only when every required identity dimension is matched and the attempt is current/not cancelled;
11. verify that the exact requested selection is selected;
12. return structured evidence/result to the orchestrator.

Failure of required identity at steps 4-8 must not result in a speculative click. Price observation at step 9 is non-gating.

## 6. Odds observability

Expected/notified odds and observed bookmaker odds remain distinct informational metadata when available.

- a changed price may be shown to the user;
- a missing/unreadable price does not block an otherwise exact target;
- no acknowledgement is required before activation;
- no retry, extra wait, navigation, or interaction is performed solely to make price readable;
- price never repairs a wrong event/market/period/line/outcome.

NotifyHandler does not calculate whether the pair remains a surebet, ROI/profitability, stake sizing, or whether the current price is acceptable.

## 7. Manual login

When a bookmaker requires login:
- adapter returns/enters `manual login required`;
- the application explains that the user must authenticate manually;
- NotifyHandler does not access credentials, automate MFA, or automate CAPTCHA;
- execution may resume only after the user has completed authentication and the adapter can safely re-validate page context.

After resume, event/market/period/line/outcome checks must be performed again if navigation/session changes may have invalidated prior evidence.

Manual login is an interruption imposed by bookmaker authentication, not a normal pre-execution product confirmation step.

## 8. Manual handoff

When a leg is successfully selected, the application reports `selection prepared`. When the relevant execution state is ready for user control, it reports `ready for user`.

The user then manually:
- authenticates if still necessary;
- inspects the selections and current odds;
- enters stakes;
- reviews bookmaker terms/state;
- submits or abandons the bet.

NotifyHandler does not automate these steps.

## 9. Partial failures

If one leg succeeds and the other fails:
- preserve both states;
- do not imply the surebet is ready;
- show which leg is prepared and why the other failed;
- provide only safe recovery actions (for example retry/reopen/cancel/restart);
- never compensate by selecting a different market/outcome or a different recommended pair without a new notification/target.

## 10. Cancellation and recovery

Cancellation should stop further automated actions as soon as practical. Retry/reopen flows must re-run required validation rather than assuming stale matching evidence remains valid.

Recovery actions are available after automatic execution has started; they are not prerequisites for starting a normal valid notification.

## 11. Input transports

NotifyHandler has a transport boundary above parsing/normalization. Transport code contains no bookmaker DOM, Playwright, matching, or outcome-activation logic.

Two current input contracts are supported:

- legacy text/manual input -> `specs/notification-format.md`;
- structured local bot input v1 -> `specs/structured-ingestion-v1.md`;
- structured local bot input v2 -> `specs/structured-ingestion-v2.md`.

The first bot-to-desktop transport is a loopback-only HTTP endpoint, conceptually `POST /api/v1/notifications/direct-pair`.

The listener:

- binds `127.0.0.1` by default;
- requires an unguessable local bearer token;
- accepts JSON only with a 64 KiB ceiling;
- rejects unexpected browser Origin requests and invalid Host authority;
- requires `sentAt` freshness and `notificationId` idempotency;
- bounds request rate/concurrency;
- returns sanitized errors/references without waiting for bookmaker execution to finish.

V1 and v2 use the same hardened ingress/idempotency boundary. An exact duplicate structured request returns the existing execution reference and never creates a second plan. Reuse of the same id with a different normalized payload is rejected.

Telegram, clipboard monitoring, and other transports may be added later through the same normalization boundary.

The desktop listener must not be exposed to the public Internet by default. A remote surebet service requires a separately designed secure relay/outbound connection or another explicit architecture decision.

Any accepted transport triggers the same automatic two-leg processing path without introducing a confirmation step.


## 12. Relay-aware v2 navigation

For a `betup-relay` leg:

1. core validates relay syntax, suffix/bookmaker binding, and pair signal consistency;
2. worker opens the immutable canonical relay in the isolated leg browser with zero positive identity evidence;
3. the resolver accepts either the expected adapter-approved bookmaker origin or one additional top-level visit to the exact same canonical relay URL;
4. if the canonical revisit occurs, the next accepted cross-origin destination must be the expected bookmaker; another relay visit or any different same-origin path fails safely;
5. unexpected intermediary/wrong-bookmaker/private-target/challenge states fail safely;
6. after expected-bookmaker arrival, matching starts from a fresh evidence epoch;
7. bookmaker login may then pause at `AUTH_REQUIRED`;
8. wrong event/market/period/line/outcome fails through the normal deterministic policy; price remains informational.

A relay never authorizes generic discovery, arbitrary same-origin crawling, selection activation, credentials, stake entry, or wager submission. The one-revisit budget is fixed and non-configurable.


## 13. Bookmaker WebSocket page transport

After the browser has reached an approved bookmaker origin, the worker/browser gateway may permit normal page `wss://` traffic only under `specs/bookmaker-network-policy.md`.

This transport:

- is public-DNS/private-network validated;
- is restricted by version-controlled bookmaker host policy;
- remains browser-native and opaque to adapter/core/renderer logic;
- contributes zero selection evidence;
- exposes no socket payload/message API to NotifyHandler;
- is terminated with the isolated browser context/cancellation.

During `bet-up.it` relay resolution, WebSockets remain blocked. Unsafe/unapproved bookmaker WSS fails safely rather than widening the allow policy.
