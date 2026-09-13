# Local desktop composition

`@notify-handler/desktop` is the local composition root between the bookmaker-agnostic application core and the isolated browser-automation worker.

`createLocalNotifyHandlerRuntime()` constructs the automatic application orchestrator, the concrete Playwright worker facade, worker-owned preflight, and independent per-leg SISAL/BET365 browser sessions.

The application package does **not** import Playwright, DOM mappings, or bookmaker adapters. Those dependencies remain behind `@notify-handler/automation`.

The runtime automatically resolves recommendation index `0` and starts both legs after deterministic parsing and whole-plan preflight. User interaction is only for execution-time interruptions such as manual authentication or changed-odds acknowledgement, followed by manual stake entry/review/submission after `READY_FOR_USER`.

This package intentionally exposes no credential, MFA/CAPTCHA, stake-entry, wager-submission, funding, cash-out, anti-bot, geo, rate-limit, or access-control bypass capability.

Browser E2E tests use the same composition with synthetic in-memory HTTPS fixture routing. They never contact live bookmaker infrastructure.
