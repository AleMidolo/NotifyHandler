# BOOK-031 — Source-locked BET365 WSS hostname observer

Date: **2026-09-25**  
Issue: **BOOK-031 / #221**  
Implementation PR: **#225**  
Parent: **BOOK-030 / #210**  
Security review: **SEC-010 / #222**  
QA gate: **QA-009 / #223**  
Execution gate: **DEVOPS-018 / #224**

## Purpose

BOOK-031 implements the hostname-only observation tool required by the SEC-009-approved BOOK-030 evidence procedure.

The implementation does **not** perform a real bookmaker run and does not change the live WebSocket allowlist.

Its only eventual live purpose is to establish provenance for the canonical hostname of the **first** WebSocket attempt made by the existing BOOK-024 source-locked BET365 direct page during one separately authorized non-CI run.

## Source lock and timing

The observer imports the existing BOOK-024 BET365 target and re-validates it through the existing source-lock parser.

There is no runtime URL argument or environment override.

The browser timing stays aligned with the approved passive direct-page diagnostic:

- navigation timeout: **20 seconds**;
- readiness delay: **1 second**;
- existing bounded DOM-content-loaded confirmation only;
- no retry, reopen, refresh, extra wait, or generic exploration.

## Browser boundary

The observer:

- launches fresh headed Chromium;
- rejects CI;
- disables downloads;
- blocks service workers;
- uses an ephemeral browser context;
- preserves public-HTTPS/DNS/private-network checks for ordinary page traffic;
- closes extra pages;
- exposes no click/fill/type/select/upload/evaluate workflow;
- performs no auth, credential, MFA, CAPTCHA, stake, betslip, payment, wager, or private/protected API action.

No screenshot, trace, HAR, video, cookie, storage, or authenticated-profile capture is created.

## First-WebSocket-only behavior

The WebSocket route is installed on the single source-locked page, not on the browser context, so a popup/extra page cannot supply the retained first-socket provenance. Extra pages are still closed fail-closed.

The diagnostic handler receives only the route capabilities needed to:

- read the attempted URL transiently;
- close the intercepted socket.

For the first attempt it checks, in memory:

- scheme exactly `wss:`;
- no URL credentials;
- default TLS port;
- DNS hostname rather than IP literal;
- canonical public hostname syntax;
- non-internal/non-loopback hostname;
- successful DNS lookup with at least one result;
- every DNS result is an IP address and public/non-private.

DNS answers are discarded immediately after validation.

Later WebSocket attempts are closed without inspecting or retaining their destination.

The diagnostic does not expose a method for establishing the intercepted socket.

## Retained artifact

A successful observation can retain exactly:

```json
{
  "schemaVersion": "notifyhandler.book030-wss-host-observation.v1",
  "bookmaker": "bet365",
  "sourceTarget": "BOOK_024_BET365_LOCKED_DIRECT",
  "candidateHostname": "<canonical-hostname>",
  "publicDnsValidated": true,
  "socketConnected": false,
  "authorizesPolicy": false
}
```

The validator rejects missing/unknown fields and altered fixed values.

No path, query, fragment, URL, IP address, header, cookie, authorization data, subprotocol, handshake, payload, runtime error, or page content can be retained in this artifact.

CLI failure output is fixed generic text and contains no attempted hostname or socket URL.

## Deterministic verification

Repository tests cover:

- qualifying first WSS -> validated sanitized artifact;
- no WSS -> no hostname fabrication;
- second/later WSS cannot replace first-attempt provenance;
- insecure WebSocket;
- credential-bearing URL;
- non-default port;
- IPv4/IPv6 literal;
- localhost/internal target;
- loopback/private/link-local DNS result;
- empty or failed DNS lookup;
- unknown artifact fields;
- altered fixed values;
- source-lock/no runtime override;
- CI refusal;
- fixed timing and headed mode;
- absence of interaction and socket-establishment capabilities.

Pinned Chromium tests exercise the actual `routeWebSocket` interception path against synthetic WebSocket attempts only.

## Command

After SEC-010 and QA-009 approval, DEVOPS-018 may execute exactly:

```bash
npm run live:book030:local
```

on the exact certified source commit in a qualifying non-CI headed environment.

Do **not** run this command against BET365 before QA-009 explicitly authorizes the single observation.

## Handoff

1. Merge BOOK-031 only after deterministic/pinned-browser/package gates are green.
2. SEC-010 reviews the exact implementation head.
3. QA-009 independently certifies the observer and may authorize at most one real observation.
4. DEVOPS-018 executes exactly one qualifying observation.
5. BOOK-030 interprets only the validated sanitized artifact.
6. Any proposed exact-host rule still requires separate Security/QA approval before a BET365 render re-test.

One observation does not justify a suffix rule and does not change BET365 support status.
