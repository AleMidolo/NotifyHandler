# Application workflow package

`@notify-handler/application` owns the renderer-neutral application behavior for APP-001.

It accepts pasted surebet notification text, delegates deterministic parsing to `@notify-handler/domain`, exposes a normalized presentation model, lets the user choose one recommended pair, and builds the exact two-leg execution plan/summary that must be shown before browser execution begins.

The package deliberately stops at the reviewed plan boundary. It does not import bookmaker adapters or Playwright and exposes no credential, authentication automation, stake-entry, or bet-submission capability. Suggested stakes remain informational preview data and are not copied into the `ExecutionPlan`.

`ApplicationWorkflow` currently supports:

- valid/invalid input states;
- normalized event, market, offer, odds, and recommendation preview;
- deterministic recommended-pair selection;
- exact two-leg execution summary;
- stale-plan clearing when input or selection changes;
- an explicit `canStartExecution` gate for the downstream APP-002 orchestrator.

APP-002 will consume the immutable `ExecutionPlan` only after the renderer has displayed this summary and the user starts execution.
