# DEVOPS-007 — Portable Windows BOOK-012 validation runner

Date: **2026-09-15**  
Scope: portable, non-production workstation handoff for the existing BOOK-012 ADMIRALBET explorer.

## What this bundle is

The `book012-admiralbet-diagnostic-v1` GitHub prerelease contains a Windows x64 ZIP that packages the already-reviewed BOOK-012 interactive explorer together with the repository-pinned Node.js runtime, `playwright-core`, and Playwright Chromium revision.

It exists only to reduce workstation setup friction for DEVOPS-005 / #71. It does **not** change bookmaker matching, interaction classification, action budgets, safe-stop behavior, or support status.

**Diagnostic / non-production:** no bookmaker is promoted to live `Supported` by this bundle, and the bundle must not be represented as suitable for unattended or real-money operation.

## Security and capability boundary

The portable runner is locked to:

- bookmaker: `admiralbet`;
- approved origin: `https://www.admiralbet.it`;
- default BOOK-012 path: `/scommesse`;
- the existing BOOK-012 default action budget and delay policy;
- the existing default-deny navigation/expansion classifier and safe-stop rules.

The portable wrapper removes environment overrides for `NH_LIVE_EXPLORER_URL`, `NH_LIVE_EXPLORER_MAX_ACTIONS`, and `NH_LIVE_EXPLORER_DELAY_MS` before the explorer is launched. It accepts no bookmaker/origin/URL argument.

The browser remains a fresh application-owned Playwright Chromium session. The bundle does not persist browser profiles, cookies, storage, credentials, auth state, screenshots, traces, video, HAR, raw HTML, page dumps, stakes, or wager data.

It adds no login, MFA, CAPTCHA, outcome/odds activation, betslip, stake/payment, wager-submission, protected/private API, proxy, alternate-origin, or access-control-bypass capability.

## CI policy

GitHub Actions may build, verify, checksum, attest, and publish this diagnostic bundle. Normal live execution is explicitly refused when common CI signals are active.

CI performs only two portable-runner checks:

1. a fail-closed test proving that the normal launcher refuses to run live under GitHub Actions;
2. `--synthetic-smoke`, which launches the packaged Chromium against local in-memory HTML only and never contacts a bookmaker.

No bookmaker URL is opened by the workflow.

## Build and publication

The bundle is built on Windows x64 from the exact `main` source revision using:

- Node.js from `.nvmrc` (`24.21.0` at this revision);
- npm from the root `packageManager` pin;
- `playwright-core@1.63.0` from the lockfile/workspace dependency;
- the corresponding Playwright Chromium revision installed by that locked package.

The build includes:

- bundled `node.exe` and its redistribution license;
- the unchanged BOOK-012 `interactive-explorer.ts` and `navigation-policy.ts` sources;
- locked `playwright-core`;
- pinned Playwright Chromium payload;
- `BUNDLE-MANIFEST.json` with exact source/runtime/browser inventory;
- `SHA256SUMS.txt` covering bundle files;
- `README.txt` with operator instructions;
- `run-admiralbet-validation.cmd` as the one-command Windows launcher.

The final ZIP receives a companion `.sha256` file and GitHub artifact provenance before publication. The release workflow refuses to replace an existing diagnostic tag/release.

## Operator procedure for DEVOPS-005 / #71

Use a normal Windows x64 workstation with a headed desktop session and ordinary outbound DNS/HTTPS access to `www.admiralbet.it`.

1. Open the repository Releases page and select prerelease **`book012-admiralbet-diagnostic-v1`**.
2. Download the diagnostic ZIP and its companion `.sha256` file.
3. Verify the ZIP SHA-256 against the companion file.
4. Extract the ZIP into a fresh writable directory.
5. Run `run-admiralbet-validation.cmd` by double-clicking it or from cmd/PowerShell.
6. Allow the headed Chromium window to finish or stop safely. Do not use the bundle to log in or perform any manual transaction while validation is running.
7. If BOOK-012 produces a valid result, the wrapper prints the sanitized JSON and writes exactly one operator result file: `ExplorerSummary.json`.
8. Attach **only** `ExplorerSummary.json` to issue #62 / PR #68 for Bookmaker Automation Engineer interpretation.

If DNS/network/runtime prerequisites fail, retain only the minimal error text needed to diagnose the workstation. Such an environment failure is not bookmaker feasibility evidence and must not classify ADMIRALBET as `Blocked`.

The existing clean-checkout path remains an alternative:

```text
npm ci --ignore-scripts
npm run live:explore:local -- admiralbet
```

## Result interpretation

`ExplorerSummary.json` remains non-authorizing evidence. Its `authorizesProductionMapping` field must be `false`. DEVOPS-007 and DEVOPS-005 do not decide whether ADMIRALBET is feasible; BOOK-013 / #62 performs that interpretation only after an actual qualifying-host result exists.
