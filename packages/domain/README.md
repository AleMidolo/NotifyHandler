# `@notify-handler/domain`

Transport-neutral surebet notification parsing, normalization, validation, recommendation resolution, and immutable two-leg execution-plan construction.

## Scope

This package owns no browser or bookmaker DOM behavior. It has no runtime dependencies and deliberately has no APIs for credentials, MFA/CAPTCHA, stake entry, or bet submission.

The initial implemented market taxonomy is intentionally narrow: football total corners over/under (`U/O CORNER(S)`, `OVER/UNDER CORNER(S)`, or `TOTAL CORNER(S)`) with an explicit positive line. Unsupported markets fail with a typed error rather than being guessed.

Supported bookmaker names are explicit aliases for SISAL, BET365, LOTTOMATICA, EPLAY24, and ADMIRALBET. Unknown names are preserved as unsupported offers but cannot resolve into an executable recommendation.

Recommended pair lines must contain exactly two `+`-separated legs, one `OVER` and one `UNDER`. Optional explicit odds (`@ 2.90`) and line values are validated against the source offer/market. Informational stake amounts are recognized only when labelled `Puntata`, `Stake`, `Importo`, or written with `€`/`EUR`; they remain on the parsed recommendation and are never copied into `ExecutionPlan` or `SelectionTarget`.

## Date/time policy

`DD/MM/YYYY - HH:mm` is parsed and calendar-validated without consulting the host timezone. The source local date/time is always preserved. A normalized UTC instant is produced only when the caller supplies an explicit `sourceUtcOffsetMinutes`; otherwise `SelectionTarget.event.scheduledAt` is omitted rather than guessed.

## Development

The package is intentionally independent of the repository-level package manager decision owned by Release/DevOps.

With Node 22+ and TypeScript available:

```sh
cd packages/domain
npm test
npm run typecheck
```

The tests use Node's built-in test runner and local sanitized notification fixtures only. No test contacts a bookmaker.
