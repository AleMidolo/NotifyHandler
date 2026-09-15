# DEVOPS-004 — Controlled local live-validation runner

Date: **2026-09-15**  
Scope: reproducible non-CI execution of the BOOK-012 interactive explorer.

## Purpose

BOOK-012 is intentionally a live, headed, credential-free evidence collector and must not become a CI workload. DEVOPS-004 provides one repository-level command that performs the environment/toolchain prerequisites and then delegates unchanged to the BOOK-012 explorer.

The runner does not broaden the BOOK-012 capability boundary. Same-origin public navigation/expansion classification, action/rate limits, ephemeral browser context, safe-stop behavior, sanitized evidence, and the prohibition on outcome activation/authentication/stake/submission remain owned by `interactive-explorer.ts`.

## Required environment

Run from a normal developer workstation or other explicitly controlled local environment with:

- outbound DNS and HTTPS access to the selected public bookmaker origin;
- Node.js exactly matching `.nvmrc` (`24.21.0` at this revision);
- npm exactly matching the root `packageManager` pin (`11.19.0` at this revision);
- repository dependencies installed from the committed lockfile.

Start from a clean checkout:

```text
nvm use
npm ci --ignore-scripts
```

Do not add credentials, browser profiles, cookies/storage exports, proxies intended to bypass access restrictions, or CI secrets.

## Single run command

For ADMIRALBET:

```text
npm run live:explore:local -- admiralbet
```

The only accepted bookmaker arguments are:

```text
admiralbet
sisal
bet365
```

The runner:

1. refuses to run when common CI signals such as `CI` or `GITHUB_ACTIONS` are active;
2. verifies the exact repository-pinned Node and npm versions;
3. verifies that the installed `playwright-core` version exactly matches the automation workspace lockfile dependency;
4. installs the Chromium revision selected by that pinned Playwright version when its executable is absent;
5. checks that the selected bookmaker hostname resolves before launching the browser;
6. delegates to the existing `packages/automation` BOOK-012 explorer with `NH_LIVE_EXPLORER_BOOKMAKER` fixed from the command argument.

Browser-install progress is written to stderr. On a successful explorer run, stdout is therefore the existing BOOK-012 sanitized JSON evidence only.

## Optional BOOK-012 controls

The wrapper deliberately does not add new live-explorer controls. Existing BOOK-012 environment variables remain available:

- `NH_LIVE_EXPLORER_URL` — must remain on the exact approved origin;
- `NH_LIVE_EXPLORER_MAX_ACTIONS` — integer `1..12`, default `10`;
- `NH_LIVE_EXPLORER_DELAY_MS` — integer `750..5000`, default `1000`.

Example:

```text
NH_LIVE_EXPLORER_MAX_ACTIONS=8 npm run live:explore:local -- admiralbet
```

On Windows PowerShell, set the environment variable before invoking npm rather than using POSIX inline assignment.

## Explicit prerequisite failures

The runner fails before live browser interaction when it detects any of these conditions:

- a CI environment signal is active;
- Node/npm differs from the repository pins;
- `node_modules` / locked `playwright-core` is missing or has the wrong version;
- the pinned Chromium installation cannot be produced;
- DNS cannot resolve the selected bookmaker hostname.

If HTTPS/browser navigation itself is unavailable after DNS succeeds, the unchanged BOOK-012 explorer fails safely through its existing error/boundary handling. Do not work around network, geo, CAPTCHA, authentication, anti-bot, or access restrictions.

## CI policy

No GitHub Actions job invokes `live:explore:local` or visits a bookmaker. Ordinary CI runs only deterministic tests of the wrapper guards and the pre-existing BOOK-012 boundary tests.

The wrapper actively rejects CI execution, so accidentally wiring the live command into a workflow fails closed before Chromium or network interaction.

## Evidence and privacy

This runner adds no evidence format of its own. Successful stdout remains the sanitized BOOK-012 `ExplorerSummary` JSON. It does not create screenshots, traces, HAR files, browser profiles, cookie/storage dumps, credentials, account data, stake data, or wager artifacts.

`authorizesProductionMapping: false` remains enforced by BOOK-012. A successful run is evidence for BOOK-013/014/015 only; it does not by itself promote a bookmaker to live `Supported` status.

## Handoff for BOOK-013

For the current Milestone 6 queue, execute:

```text
npm run live:explore:local -- admiralbet
```

in a qualifying local environment, retain only the sanitized JSON result needed for engineering analysis, and hand that result to the Bookmaker Automation Engineer for BOOK-013 / #62.
