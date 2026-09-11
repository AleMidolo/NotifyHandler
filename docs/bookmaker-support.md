# Bookmaker support

Bookmaker support is incremental and must conform to the shared adapter contract. A bookmaker is not considered supported merely because a page can be opened or a DOM selector can be clicked.

## Support states

- **Candidate** — desired product target; feasibility not yet validated.
- **Designing** — adapter behavior/matching strategy under investigation.
- **Implementing** — active implementation issue/PR exists.
- **Testable** — deterministic local/mock contract and regression tests exist.
- **Supported** — adapter satisfies contract, safety tests, and release criteria for the documented scope.
- **Blocked** — integration cannot currently meet technical, safety, or permitted-access requirements.

## Initial candidates

| Bookmaker | Priority | Status | Notes |
| --- | --- | --- | --- |
| SISAL | 1 | Candidate | Proposed first adapter; confirm feasibility after architecture contract. |
| BET365 | 2 | Candidate | Proposed second adapter/pair with SISAL; confirm feasibility and allowed interaction model. |
| LOTTOMATICA | 3 | Candidate | Add after first pair stabilizes. |
| EPLAY24 | 4 | Candidate | Add after first pair stabilizes. |
| ADMIRALBET | 5 | Candidate | Add after first pair stabilizes. |

Priorities may change when technical feasibility, permitted access, notification prevalence, or regression complexity provides evidence for a better order.

## Minimum adapter capabilities

A supported adapter must implement the shared architecture contract and be able to:
- validate/open supported bookmaker URLs or entry points;
- report manual-login requirement without handling credentials;
- locate event candidates;
- verify event identity using available context;
- locate the requested market family;
- verify the exact line/threshold;
- locate/verify the requested side or outcome;
- read current displayed odds where technically available;
- compare expected and observed odds using shared policy;
- select only after all required identity checks pass;
- return structured evidence, states, and failure reasons;
- support cancellation/retry semantics defined by architecture.

## Required tests before `Supported`

At minimum, each adapter needs deterministic tests/fixtures for:
- exact successful match;
- wrong event with similar participant names;
- wrong competition/date context where relevant;
- same market family but wrong neighboring line;
- correct line but wrong side/outcome;
- missing market/outcome;
- changed odds;
- page/load timeout or changed page structure;
- login-required state;
- duplicate/ambiguous candidate match;
- transaction-boundary protection: no stake or submit action exists.

## Live-site interaction policy

Testing should favor local/sanitized fixtures and permitted normal browser interaction. Do not add code that bypasses CAPTCHA, authentication controls, rate limits, geo restrictions, anti-bot measures, or protected APIs.

If normal permitted interaction cannot support safe deterministic selection, mark the bookmaker or affected flow `Blocked` rather than weakening the matching or security model.

## Scope granularity

Support may be scoped by sport, market type, page flow, or pre-match/live mode. Do not label an adapter generically `Supported` if only a narrower scope has been validated. Document limitations explicitly in this file and adapter documentation.
