# NotifyHandler unsigned Windows alpha

**This is an unsigned Windows x64 alpha for application testing only. It is not a production release and must not be relied on for real-money operation.**

No bookmaker is currently live `Supported`. SISAL and BET365 are fixture-backed `Testable` integrations, which means the deterministic application/adapter flows can be exercised against repository fixtures; this does not imply reliable operation against the live bookmaker sites. Real bookmaker pages may change, be unavailable, or lack enough deterministic evidence, in which case NotifyHandler is expected to stop safely rather than guess.

Authentication remains manual. NotifyHandler does not enter credentials, automate MFA/CAPTCHA, enter stakes, or submit/confirm wagers. Stake entry, final review, and final submission remain the user's responsibility.

## Download and run

1. Download the portable Windows x64 ZIP and its companion `.sha256` file from this prerelease's Assets section.
2. Verify the ZIP SHA-256 checksum against the companion file.
3. Extract the ZIP into a new directory rather than overwriting an existing copy.
4. Launch `NotifyHandler.exe` from the extracted directory.
5. Because this alpha is unsigned, Windows may display an unsigned-app or SmartScreen warning. Do not treat that warning as evidence of production signing; production Authenticode signing remains a separate release gate.

The archive contains the packaged application, dedicated Playwright Chromium runtime, CycloneDX SBOM, per-file checksums, release metadata, and the preview safety/readme information produced by the verified desktop release pipeline. GitHub build provenance is generated for the ZIP by the release workflow.

## Current scope

This alpha is intended to let you try the desktop application, notification parsing/orchestration, fixture-backed browser flow, state/recovery behavior, and packaged runtime. It does not complete Milestone 6 live-bookmaker qualification or Milestone 7 signed production-release readiness.
