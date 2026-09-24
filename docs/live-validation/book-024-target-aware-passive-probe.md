# BOOK-024 — Target-aware passive direct-page evidence probe

Date: **2026-09-24**  
Issue: **#177**  
Depends on: BOOK-023/#170 direct-link conclusion

## Purpose

BOOK-024 adds a separate passive diagnostic for the exact BET365 and SISAL direct pages used by the Portogallo-Galles signal.

It does **not** broaden the BOOK-012 interactive explorer. It performs zero page actions and exists only to inspect target-relevant visible evidence after the initial direct navigation and the existing bounded readiness delay.

Authoritative target:

- event: Portogallo - Galles;
- competition: Nations League;
- scheduled local time: 24/09/2026 20:45;
- pre-match football;
- full-match total corners;
- line 6.5;
- BET365 OVER, expected odds 1.14;
- SISAL UNDER, expected odds 4.25.

## Source-locked URLs

- BET365: `https://www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/`
- SISAL: `https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles`

The diagnostic CLI accepts only the bookmaker name. It does not accept a runtime live URL override. The exported probe function has no URL or headless override either: it always uses the exact source-locked target, enforces the non-CI gate internally, and launches headed Chromium.

BET365 navigation uses the full source-locked URL including its SPA fragment. Retained output does not store the fragment itself; it records only:

- whether the requested URL contained a fragment;
- whether the final page URL retained the exact requested fragment.

The fragment is navigation state only and never positive matching evidence.

## Passive evidence model

After `domcontentloaded`, the probe uses the existing 20-second navigation timeout and a fixed 1-second readiness delay. It does not add retries or longer timeouts.

It queries only bounded visible text matching the authoritative target. For each signal it keeps at most three sanitized snippets, each at most 220 characters.

Signals:

- participant A;
- participant B;
- competition;
- scheduled date;
- scheduled time;
- broad corner-family context;
- explicit total-corners market text;
- explicit full-match context;
- exact line;
- requested side bound near the exact line;
- expected odds;
- bounded decimal-odds candidates observed in target-relevant contexts.

A broad `CORNER` category is intentionally separate from explicit `total_corners` identity. Broad corner context alone cannot satisfy the market, period, line, side, or odds dimensions.

The structured `dimensionsObserved` object is diagnostic only. `requiredChainObserved` means that every pre-activation evidence dimension was visible in the bounded passive sample; it does not authorize production selectors or selection activation.

Every summary hard-codes:

```text
authorizesProductionMapping: false
```

## Sanitization and privacy

Retained snippets:

- collapse whitespace;
- redact UUID-shaped values;
- redact email-shaped values;
- redact visible URLs;
- redact long opaque tokens;
- are capped at 220 characters;
- are capped at three samples per target signal.

The probe does not retain:

- full HTML;
- full page text;
- screenshots;
- traces;
- HAR;
- cookies;
- storage/session state;
- credentials;
- form values;
- authenticated page captures;
- private/protected API responses.

The browser context is fresh/ephemeral, blocks service workers, disables downloads, closes popups, and reuses the existing exact-origin navigation boundary. Every routed HTTP(S) request is independently required to be public HTTPS with fail-closed DNS/private-address validation before it is allowed to continue. BOOK-024 exposes no WebSocket surface: attempted WebSockets are closed and the diagnostic fails safely.

## Transaction and access boundary

The BOOK-024 source contains no click/fill/type/check/select/upload capability. CLI failures emit only a fixed generic message rather than forwarding Playwright/runtime error text, so the source-locked BET365 fragment or another dynamic target cannot be echoed through failure logs. It cannot:

- activate an outcome;
- add a selection to a betslip;
- enter or change a stake;
- submit or confirm a wager;
- enter credentials;
- automate MFA/CAPTCHA;
- dismiss/bypass access controls;
- access protected/private bookmaker APIs.

Visible password/auth, CAPTCHA/anti-bot, access restriction, consent, unsafe redirect, private/internal target, or page-close conditions stop the diagnostic safely.

## Deterministic verification

The non-browser boundary suite verifies:

- exact source-locked URLs;
- unsafe URL rejection before launch;
- BET365 fragment input preservation;
- bounded/redacted evidence schema;
- absence of interaction and sensitive artifact capabilities;
- fixed existing timeout/readiness bounds;
- non-CI live command boundary;
- permanent non-authorizing output.

The pinned Chromium fixture suite verifies:

- BET365 SPA/hash route survives navigation and target labels visible after bounded hydration can be observed passively;
- BET365 generic landing remains insufficient;
- SISAL exact event/competition/time/full-match total-corners/line/side/odds fixture is captured as bounded passive evidence;
- SISAL broad CORNER-only near-miss cannot infer full target identity;
- wrong time, period, line, or side keeps the chain incomplete;
- changed odds are observable as diagnostic evidence without becoming expected-odds evidence.

## Live execution gate

**Do not perform a new live BOOK-024 bookmaker run from this implementation PR.**

After merge:

1. SEC-007/#178 reviews the passive evidence/privacy/navigation boundary.
2. QA-006/#179 certifies deterministic regressions.
3. Only if both approve may Release/DevOps execute at most one BET365 and one SISAL non-CI passive diagnostic run, with no timeout/action-budget tuning.

No Betup fallback or generic homepage discovery is part of BOOK-024.
