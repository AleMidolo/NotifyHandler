# Unsigned alpha prerelease operations

The public alpha channel is a durable GitHub **prerelease** built from the same verified Windows x64 preview pipeline used for release-readiness testing. It does not weaken live-bookmaker qualification or signed-production requirements.

## Version and tag scheme

Alpha tags use:

`v<package-version>-alpha.<positive integer>`

The first public alpha is configured in `.github/alpha-release.json` as:

`v0.0.0-alpha.1`

A later alpha increments only the prerelease ordinal for the same package version, or uses the next reviewed package version. Production tags remain exactly `v<package-version>` and are reserved for the separate signed production path. An alpha tag therefore cannot consume or masquerade as a production tag.

## Publication trigger

`.github/alpha-release.json` is the explicit publication marker. A reviewed change to that file merged to `main` triggers `.github/workflows/desktop-release.yml`.

The workflow first runs the existing Windows x64 release gates on the exact merge commit:

- locked dependency installation;
- `npm run check`;
- production dependency audit;
- deterministic automation and desktop Chromium suites;
- locked Electron and Playwright Chromium installation;
- portable bundle build;
- CycloneDX SBOM generation;
- sensitive-content/bundle verification and per-file checksums;
- packaged no-notification smoke test;
- archive SHA-256 generation;
- GitHub build provenance attestation.

Only after that job succeeds does a separate publish job receive `contents: write`. It downloads the ZIP and `.sha256` companion from the same workflow run, verifies the archive checksum again, validates the configured prerelease tag against the root `package.json` version, refuses to replace an existing tag/release, and creates a GitHub prerelease targeted at the exact verified source SHA.

Alpha tags are excluded from the generic `v*` tag build trigger to prevent release creation from recursively starting another desktop build. Production-style tags continue to use the existing tag-triggered preview/release-readiness path.

## Published assets

The prerelease contains:

- the portable Windows x64 ZIP;
- the companion ZIP SHA-256 file.

The ZIP itself contains the generated CycloneDX SBOM, per-file `SHA256SUMS.txt`, release metadata, and preview safety/readme information. GitHub artifact provenance is generated for the ZIP by the build job.

## Safety and support labeling

Every alpha prerelease uses `docs/alpha-prerelease-notes.md`. The notes must state that the build is unsigned, Windows x64 only, non-production, and not suitable for real-money operation. No bookmaker may be called live `Supported` unless the support document for the exact revision says so. Fixture-backed SISAL/BET365 remain `Testable` only until live qualification succeeds.

Authentication, MFA/CAPTCHA handling, stake entry, final review, and wager submission remain outside automation. The alpha publication path changes distribution only; it does not expand browser, authentication, or transaction capabilities.
