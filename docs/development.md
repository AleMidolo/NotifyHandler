# Development and release baseline

This document defines the reproducible development and CI baseline for NotifyHandler. It follows ADR-0001: a local-first TypeScript/Node.js desktop application with a separate Playwright browser-automation worker and headed Chromium sessions.

## Pinned toolchain

- Node.js: `24.21.0` (`.nvmrc`)
- npm: `11.19.0` (`packageManager` and root engine policy)
- TypeScript: `6.0.3` (root lockfile)
- Playwright browser bootstrap baseline: `1.63.0`

Use the exact Node/npm line above. `.npmrc` enables engine enforcement and exact dependency saves. The committed `package-lock.json` is authoritative for repository dependencies; use `npm ci` in clean or CI environments.

## Clean checkout setup

```bash
nvm use
npm ci
npm run check
```

`npm run check` is the repository-wide quality entry point. It runs workspace build, lint, typecheck, and unit-test commands when present. New workspaces must expose the relevant scripts rather than adding package-specific CI steps unless a test genuinely needs a separate environment.

Current standardized commands:

```bash
npm run build
npm run lint
npm run typecheck
npm test
npm run check
```

No baseline command requires bookmaker credentials, cookies, auth tokens, a live bookmaker account, or access to a betting transaction.

## Browser runtime

ADR-0001 requires Playwright-controlled Chromium, but the browser worker workspace is not implemented yet. Until that workspace lands, the repository exposes an exact-version bootstrap command rather than making every domain-only install download a browser:

```bash
npm run browser:install
```

Linux CI/containers that need OS browser libraries can use:

```bash
npm run browser:install:ci
```

Both commands resolve Playwright `1.63.0` explicitly. Once the automation-worker package is introduced, Playwright must move into that workspace's committed dependency graph/lockfile and browser E2E CI must install the matching Chromium build before tests.

`.github/workflows/browser-runtime.yml` verifies the pinned Chromium bootstrap automatically when toolchain/browser-related files change and can also be run manually. Domain-only pull requests therefore do not pay the browser download cost.

## CI policy

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` and:

1. checks out the repository;
2. loads Node from `.nvmrc`;
3. verifies the expected npm version;
4. installs from the lockfile using `npm ci --ignore-scripts`;
5. runs `npm run check`;
6. audits production dependencies at high severity or above.

Baseline CI uses no repository secrets. Local/mock fixtures are the required default for browser and integration testing. Live bookmaker automation must not be added to ordinary CI.

Dependency lifecycle scripts are disabled during baseline CI installation. If a future dependency legitimately requires an install script, document the reason and threat model before relaxing this policy.

## Diagnostics and sensitive data

Logs and artifacts must not contain passwords, MFA/OTP values, CAPTCHA material, cookies, authorization headers, auth/session tokens, browser profile contents, or bookmaker session secrets. `.env*` files are ignored except for an explicitly sanitized `.env.example`.

Browser traces, screenshots, HAR files, videos, or saved profiles must be treated as potentially sensitive once authenticated sessions exist. Do not upload them as CI artifacts by default. A future artifact policy must sanitize or disable such capture before release workflows collect them.

## Packaging and release status

The accepted distribution direction is a local desktop application. Electron packaging/signing is intentionally deferred until the desktop shell, privileged core, and automation worker workspaces exist. Adding packaging earlier would guess package boundaries and could duplicate Chromium/Electron runtime assets contrary to ADR-0001.

A production release is **not ready** until the repository release gates are all satisfied, including unit/integration/E2E/security tests, supported-adapter contract tests, documentation of supported bookmakers/markets and failure behavior, and proof that no reachable path enters a stake or submits a wager.

When desktop packaging work starts, Release/DevOps must define at minimum:

- deterministic Electron and Playwright versions without duplicate Chromium bundles where avoidable;
- platform build matrix and artifact naming;
- code signing/notarization policy where applicable;
- update/distribution mechanism and rollback policy;
- SBOM/dependency inventory and release provenance;
- explicit exclusion of local profiles, cookies, traces, logs, and secrets from packaged artifacts.
