# Development and release baseline

This document defines the reproducible development and CI baseline for NotifyHandler. It follows ADR-0001: a local-first TypeScript/Node.js desktop application with a separate Playwright browser-automation worker and headed Chromium sessions.

## Pinned toolchain

- Node.js: `24.21.0` (`.nvmrc`)
- npm: `11.19.0` (`packageManager` and root engine policy)
- TypeScript: `6.0.3`
- Electron: `44.3.0`
- esbuild: `0.28.2`
- Playwright Core / browser runtime: `1.63.0`

All JavaScript dependencies above are represented in the committed `package-lock.json`. `.npmrc` enforces the Node/npm engine policy and exact dependency saves.

## Clean checkout setup

For normal local development, use the exact Node/npm toolchain and install from the lockfile:

```bash
nvm use
npm ci
npm run browser:install
npm run check
```

`npm run check` is the repository-wide quality entry point. It runs workspace build, lint, typecheck, and unit-test commands when present. No baseline command requires bookmaker credentials, cookies, auth tokens, a live bookmaker account, or access to a betting transaction.

The desktop shell now uses the locked Electron binary rather than an on-demand package download:

```bash
npm run desktop:dev
```

## Browser runtime

The automation worker depends on locked `playwright-core@1.63.0`. Browser installation uses that committed dependency directly:

```bash
npm run browser:install
```

Linux CI/containers that need OS browser libraries use:

```bash
npm run browser:install:ci
```

`.github/workflows/browser-runtime.yml` verifies the deterministic browser fixture suites and Electron shell smoke without live bookmaker access. The workflow installs Electron explicitly after `npm ci --ignore-scripts`, so dependency lifecycle scripts stay disabled during the general dependency-install phase.

## CI policy

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` and:

1. checks out the repository with a commit-pinned GitHub Action;
2. loads Node from `.nvmrc` with a commit-pinned setup action;
3. verifies the expected npm version;
4. installs from the lockfile using `npm ci --ignore-scripts`;
5. runs `npm run check`;
6. audits production dependencies at high severity or above.

Baseline CI uses no repository secrets. Local/mock fixtures are the required default for browser and integration testing. Live bookmaker automation must not be added to ordinary CI.

## Desktop packaging

DEVOPS-002 introduces a reproducible **Windows x64 unsigned preview** packaging path. It is intentionally not a production release or signed installer.

The build stages Electron's locked runtime, bundles the privileged desktop/core/worker application code to JavaScript with locked esbuild, keeps `playwright-core` behind the worker boundary, copies the static sandboxed renderer/preload, and provisions a dedicated Playwright Chromium runtime under Electron `resources/`. The packaged bootstrap fixes `PLAYWRIGHT_BROWSERS_PATH` to that application-owned runtime before the worker is imported.

Electron's renderer Chromium and Playwright Chromium are both present. This duplication is intentional at the current architecture boundary: bookmaker pages must remain in separate worker-owned browser processes rather than reusing or attaching to the Electron renderer browser.

A clean Windows x64 release build requires the browser path to be explicit:

```powershell
npm ci --ignore-scripts
node node_modules/electron/install.js
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.cache\ms-playwright"
npm run browser:install
npm run check
$env:NOTIFYHANDLER_BUILD_ID = (git rev-parse --short=12 HEAD)
npm run release:bundle
npm run release:verify
```

`.github/workflows/desktop-release.yml` is the authoritative clean-environment path. It additionally runs browser-backed suites, generates CycloneDX inventory, launches the packaged shell in no-notification smoke mode, archives the bundle, records an archive SHA-256, uploads the preview artifact, and can create GitHub artifact provenance on non-PR runs.

See `docs/release.md` for artifact naming, signing, distribution, rollback, and the release checklist.

## Diagnostics and sensitive data

Logs and artifacts must not contain passwords, MFA/OTP values, CAPTCHA material, cookies, authorization headers, auth/session tokens, browser profile contents, or bookmaker session secrets. `.env*` files are ignored except for an explicitly sanitized `.env.example`.

Browser traces, screenshots, HAR files, videos, saved profiles, and local browser user-data directories are treated as potentially sensitive once authenticated sessions exist. They are excluded from release artifacts and are not uploaded by default.

## Production release status

A production release is **not ready** merely because a preview artifact builds. Production requires all repository release gates plus a supported-bookmaker declaration, reviewed signing/distribution credentials, signed Windows artifacts, and any platform-specific hardening required for additional operating systems. Authentication, stake entry, review, and final wager submission remain manual user actions in every distribution mode.
