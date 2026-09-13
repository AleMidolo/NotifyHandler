# Application workflow package

`@notify-handler/application` owns renderer-neutral application behavior and two-leg orchestration.

## Production automatic path

`AutomaticExecutionOrchestrator` is the APP-002 production path. Notification receipt immediately triggers deterministic parsing and uses recommendation index `0` (preserved source order) as the primary recommendation. It builds exactly two immutable targets, runs an injected plan-level adapter/navigation preflight, and schedules both worker legs automatically once preflight succeeds.

There is no parsed-preview acknowledgement, recommended-option choice, execution-summary confirmation, or renderer-issued start command in the production path. Preview/summary rendering may happen concurrently for observability but cannot gate worker dispatch.

The orchestrator owns:

- independent per-leg runtime state, attempt ids, and evidence epochs;
- automatic concurrent start dispatch for both valid legs;
- `AUTH_REQUIRED` pause/resume with fresh evidence;
- explicit `ODDS_CHANGED` expected/observed values and exact-value acknowledgement;
- retry and reopen with fresh attempts;
- leg and plan cancellation with stale-event rejection;
- restart of the same automatically resolved immutable plan;
- partial-failure and full `READY_FOR_USER` derivation;
- conversion of worker/runtime exceptions into safe failures.

The injected core/worker ports deliberately expose no DOM selectors, raw browser objects, credentials, MFA/CAPTCHA automation, stake-entry operations, or bet-submission operations.

## Legacy/non-blocking preview helper

`ApplicationWorkflow` remains available as the APP-001 presentation helper for normalized event/market/offer/recommendation previews and explicit plan inspection. Its historical pair-selection API is not part of the normal production start trigger and must not be used as a prerequisite for automatic execution.

Suggested stakes remain presentation-only data and never enter execution targets or worker commands.
