# Browser automation worker

`@notify-handler/automation` owns the Playwright/Chromium capability boundary described by ADR-0001.

The production launcher creates one dedicated Chromium process and one ephemeral browser context per bookmaker leg. It exposes only the shared `BookmakerPagePort`, a selection gate bound to a fresh evidence epoch, cancellation/cleanup, and a non-sensitive session id. Raw Playwright `Browser`, `BrowserContext`, `Page`, locator, cookie, storage, credential, stake, payment, and wager-submission capabilities are not exported to the application or bookmaker adapters.

The current SISAL and BET365 DOM mappings are deliberately **synthetic semantic fixture mappings** (`data-nh-*-role` attributes). They exist to exercise the real browser runtime deterministically without asserting anything about either live bookmaker DOM. Live mappings remain future, separately reviewed work; the adapters stay `Testable`, not live `Supported`.

Browser CI uses `launchFixtureLegSession`, a test-support entry point that intercepts only explicitly configured, adapter-approved HTTPS fixture URLs and blocks all other network requests. Production navigation origins are never broadened for tests.

Production sessions default to headed Chromium. CI fixture sessions default to headless Chromium. Profiles are ephemeral; persistent authenticated profiles, CAPTCHA/MFA automation, anti-bot/geo/rate-limit bypass, stake entry, funding, cash-out, and wager submission are outside this package by design.
