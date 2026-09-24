# BOOK-027 — Interpretation of passive-provenance.v1 live diagnostics

Date: **2026-09-24**  
Issue: **#193**  
Qualified execution: **DEVOPS-017/#192**  
Source commit: `7f1e24d37eff82e9807b7d58acd3dc3f438ee945`  
Schema: `passive-provenance.v1`

## Qualified summaries

### BET365

Summary SHA-256:

`9C1CDEDB8460B642011928B9D70394F1FE2A176D1F50DEEF9C57522D947B89D4`

Retained state:

- `BOOKMAKER_DIRECT`;
- requested/final path `/` -> `/`;
- requested fragment present and preserved;
- transport provenance `BLOCKED / WEBSOCKET_ATTEMPT / SOCKET`;
- status `BLOCKED`;
- compatibility block reason `PRIVATE_OR_INTERNAL_DESTINATION`;
- no render or target evidence retained;
- `authorizesProductionMapping: false`.

### SISAL

Summary SHA-256:

`B6AE576E657BCAC2417F899F8EE6B2576DD7512C3DA4C65C2BC6FA0583E21455`

Retained state:

- `BOOKMAKER_DIRECT`;
- exact Portogallo-Galles event route preserved;
- transport provenance `CLEAR`;
- status `COMPLETE`;
- `DOMCONTENTLOADED_CONFIRMED`;
- title participant-pair predicate true;
- title competition predicate true;
- `POPULATED` DOM bucket;
- required target chain false;
- `authorizesProductionMapping: false`.

## BET365 interpretation

The v1 provenance resolves BOOK-025's transport ambiguity: the first policy trigger was a **WebSocket attempt**.

Under the current fail-closed probe, that means only that the page/browser attempted to open a WebSocket and the diagnostic closed it. It does **not** establish:

- the WebSocket destination;
- whether the destination was private/internal;
- whether the socket was authentication, telemetry, live-data, betting-data, or another purpose;
- whether the socket was necessary for the requested event/market;
- any event, competition/time, market, line, side, displayed-odds, feasibility, or support evidence.

The compatibility block reason remains `PRIVATE_OR_INTERNAL_DESTINATION` for historical schema continuity, but BOOK-027 must not describe the bookmaker as having attempted a private/internal destination from this artifact.

The requested BET365 SPA fragment being preserved is navigation provenance only and does not repair the missing deterministic target chain.

Consequences:

- BET365 remains fixture-backed **Testable** and live **Blocked for the current target scope**;
- no production selector mapping is justified;
- the existing WebSocket block must not be relaxed from this evidence;
- no retry of the same diagnostic is justified.

A potentially useful next diagnostic exists only as an **architecture question**, not Bookmaker implementation work: whether a future passive diagnostic may keep the WebSocket blocked exactly as today while continuing bounded render-only observation after the blocked socket. ADR-0006 currently requires transport `CLEAR` before render provenance, so Product must first decide whether that additional BET365-only diagnostic investment is worthwhile and Architecture must approve any amendment.

## SISAL interpretation

The v1 provenance resolves BOOK-025's render ambiguity.

The exact direct event route remained preserved, the document reached DOMContentLoaded, and the main document is not an empty shell: its DOM population bucket is `POPULATED`. The title metadata also contains the target participant pair and competition.

However, those title booleans are diagnostic metadata only. They do not establish the production event identity.

At the reviewed passive observation point:

- participant A is absent from the searched DOM;
- participant B is absent from the searched DOM;
- scheduled time is absent;
- broad corner context is absent;
- total-corners market identity is absent;
- full-match context is absent;
- exact line 6.5 is absent;
- requested UNDER side at the line is absent;
- expected odds 4.25 are absent;
- there are no displayed-odds candidates.

The artifact reports competition/date text as present and visible, but the retained snippets show that these matches are **not bound to Portogallo-Galles**:

- competition comes from an unrelated `Turchia-Francia | Nations League` item;
- date matches come from unrelated basketball/editorial/Nations League content.

Therefore those positives cannot be used as target competition/date evidence for production matching.

This is stronger than the earlier BOOK-024 ambiguity: the reviewed top-level document is populated, but the target betting-chain predicates are not present there at the fixed passive observation point.

Consequences:

- SISAL remains fixture-backed **Testable** and live **Blocked for the current target scope**;
- title/path metadata does not authorize a live mapping;
- unrelated competition/date snippets must not satisfy matching dimensions;
- no production selector mapping is justified;
- retrying the same passive diagnostic, adding waits, or broadening passive text collection is not evidence-backed.

## Feasibility conclusion

Neither bookmaker reaches `Feasible for implementation`.

BOOK-027 creates **no Bookmaker implementation issue** because the live evidence does not justify selector mapping, production activation, WebSocket allowance, broader passive capability, or interactive expansion.

The current Portogallo-Galles BET365/SISAL pair therefore remains unsuitable as the first live-supported pair under the existing evidence.

## Next step

PRODUCT-029/#194 owns the next Milestone-6 decision.

Product should decide whether to:

1. continue BET365-specific diagnostic investment by first asking Architecture whether bounded render-only observation may continue after a blocked `WEBSOCKET_ATTEMPT` while the socket itself remains blocked and no destination data is retained; and/or
2. source a new current/future direct-link target for SISAL or another bookmaker so the second leg exposes an evidence-backed deterministic chain.

Any future diagnostic amendment requires Architecture, a separately scoped Bookmaker implementation issue, Security review, QA certification, and a separately authorized non-CI live run.

## Boundaries preserved

BOOK-027 authorizes none of the following:

- WebSocket allowance;
- DNS/origin/protocol relaxation;
- longer waits, retries, larger action budget, or generic discovery;
- Betup fallback;
- private/protected API use;
- hidden/raw page-content retention;
- click/fill/type/outcome activation in the passive probe;
- credential/MFA/CAPTCHA automation;
- stake/betslip/payment/wager capability;
- support or production-mapping promotion from provenance/title/path evidence.
