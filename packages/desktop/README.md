# Local desktop application

`@notify-handler/desktop` is the local composition root and user-operable shell between the bookmaker-agnostic application core and the isolated browser-automation worker.

## Development launch

From the repository root:

```sh
npm ci --ignore-scripts
npm run browser:install
npm run desktop:dev
```

The dev command pins Electron `44.3.0` on demand instead of adding Electron to the production dependency lock. The shell starts without bookmaker credentials and performs no bookmaker action until notification input is delivered. Packaging/installers remain a Release / DevOps follow-up.

## Runtime boundary

`createLocalNotifyHandlerRuntime()` constructs the automatic orchestrator, concrete Playwright worker facade, worker-owned preflight, and independent per-leg SISAL/BET365 browser sessions. `createProductionDesktopController()` adds the trusted main-process state/IPC controller and non-sensitive notification-to-first-worker-start latency metrics.

The Electron renderer is sandboxed, uses context isolation, has Node integration and webviews disabled, and receives only a narrow preload bridge. It cannot access Playwright, browser/session objects, filesystem APIs, credentials, cookies/tokens, or generic IPC/browser controls.

Submitting notification input enters the existing automatic path immediately: recommendation index `0` is resolved, preflight runs, and both legs are dispatched without a preview acknowledgement, pair selector, plan confirmation, or Start button. Renderer updates are out-of-band and never gate browser startup.

The renderer shows the exact normalized two-leg target, independent leg state, expected/observed odds, safe failures, and only state-valid recovery controls. Stale leg/attempt commands are rejected in the trusted controller. `READY_FOR_USER` is a manual handoff: authentication, stake entry, review, and final submission remain user actions in the separate bookmaker windows.

Browser E2E tests continue to use synthetic in-memory HTTPS fixture routing and never contact live bookmaker infrastructure.
