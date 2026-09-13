# Browser automation worker

`@notify-handler/automation` owns the Playwright/Chromium capability boundary described by ADR-0001.

The production launcher creates one dedicated Chromium process and one ephemeral browser context per bookmaker leg. It exposes only the shared `BookmakerPagePort`, a selection gate bound to a fresh evidence epoch, cancellation/cleanup, and a non-sensitive session id. Raw Playwright `Browser`, `BrowserContext`, `Page`, locator, cookie, storage, credential, stake, payment, and wager-submission capabilities are not exported to the application or bookmaker adapters.

`PlaywrightBookmakerAutomationWorker` is the concrete worker-facing lifecycle facade used by the application composition root. It owns the SISAL/BET365 adapter registry and implements start, manual-auth resume, changed-odds continuation, retry, reopen, and cancellation while keeping one isolated session per leg. Adapter terminal results are converted into the structured application lifecycle without exposing DOM or Playwright objects.

`createWorkerExecutionPreflight()` performs the non-browser whole-plan checks needed before automatic dispatch: both legs must resolve to registered workers, retain sufficient target identity, and use only approved HTTPS origins when notification deep links are supplied. Worker navigation policy still revalidates every navigation/redirect authoritatively.

The current SISAL and BET365 DOM mappings are deliberately **synthetic semantic fixture mappings** (`data-nh-*-role` attributes). They exist to exercise the real browser runtime deterministically without asserting anything about either live bookmaker DOM. Live mappings remain future, separately reviewed work; the adapters stay `Testable`, not live `Supported`.

Browser CI uses `launchFixtureLegSession` and `createFixtureAutomationWorker`, test-support entry points that intercept only explicitly configured, adapter-approved HTTPS fixture URLs and block all other network requests. Production navigation origins are never broadened for tests.

Production sessions default to headed Chromium. CI fixture sessions default to headless Chromium. Profiles are ephemeral; persistent authenticated profiles, CAPTCHA/MFA automation, anti-bot/geo/rate-limit bypass, stake entry, funding, cash-out, and wager submission are outside this package by design.
