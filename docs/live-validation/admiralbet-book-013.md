# BOOK-013 — ADMIRALBET interactive revalidation

Date: **2026-09-15**  
Scope: Italian public ADMIRALBET sports-betting surface, pre-match football, full-match total-corners over/under with an exact numeric line.

## Decision

**Interactive revalidation outcome: Pending execution.**

BOOK-013 depends on an actual run of the merged BOOK-012 controlled interactive explorer against credential-free `https://www.admiralbet.it`. That acceptance experiment has **not** completed in this agent execution environment, so this record does not classify ADMIRALBET as newly `Feasible for implementation` or newly `Blocked` from interactive evidence.

The previously established BOOK-011 support state remains authoritative until BOOK-012 produces a sanitized result.

## Why this remains pending

QA correctly identified that normal public browsing/search evidence is not a substitute for the BOOK-012 experiment required by issue #62. The key unanswered question is whether the approved explorer can safely navigate/expand the public `Calci D Angolo` surface and either:

- expose the deterministic pre-activation chain, or
- stop with a defined BOOK-012 safe-stop / no-eligible-expansion result.

This agent attempted to obtain a runnable environment. The available execution container has Chromium installed, but it cannot resolve external hosts and has no configured outbound proxy. `playwright-core` is also not installed locally, and package/repository download is unavailable because external DNS/network access fails. No access-control, anti-bot, geo, CAPTCHA, or network restriction was bypassed.

Therefore no BOOK-012 live transcript is claimed or fabricated.

## Supplementary public observation

Current public ADMIRALBET pre-match pages provide stronger non-interactive evidence than BOOK-011. In particular, a football competition surface exposes:

- competition context and scheduled event rows;
- participants and event times;
- ordinary market families and displayed prices;
- a distinct pre-match market-family control labelled `Calci D Angolo`.

This observation is useful for targeting the future explorer run, but it is **not** an interactive acceptance result and does not change support state by itself.

## Required BOOK-012 result

A compliant headed run must use only the merged BOOK-012 boundary:

- exact credential-free `https://www.admiralbet.it` origin;
- fresh ephemeral headed Chromium context;
- classifier-approved same-origin navigation;
- narrowly qualified non-transactional expansion controls only;
- no outcome/odd activation;
- no login, MFA, CAPTCHA handling, credentials/session capture, cookies/storage capture, screenshots/traces, private/protected API inspection, stake entry, or wager submission;
- fixed action/rate budget and normal safe-stop behavior.

The persisted evidence must be limited to BOOK-012's sanitized JSON result.

The acceptance decision after that run is:

- **Feasible for implementation** only if sanitized evidence deterministically establishes `event → competition/time → full-match total-corners market → exact line → OVER/UNDER side → displayed odds`; otherwise
- **Blocked** with the exact BOOK-012 safe-stop or missing identity dimensions.

Selected-state behavior remains outside this feasibility experiment and belongs to the later restricted production activation path.

## Current repository consequence

- Issue #62 remains open.
- No ADMIRALBET production adapter/worker mapping or implementation issue is created.
- `docs/bookmaker-support.md` remains at the last proven BOOK-011 state.
- BOOK-014 / #63 must remain blocked until #62 has an actual BOOK-012 result.
- A release/DevOps task should provide a controlled non-CI execution environment for the BOOK-012 live explorer without weakening its safety boundary.
