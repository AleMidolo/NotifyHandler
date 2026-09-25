# BOOK-030 — Security-approved BET365 WSS hostname evidence procedure

Date: **2026-09-25**  
Security gate: **SEC-009 / #211**  
Downstream task: **BOOK-030 / #210**  
Architecture: **ARCH-011 / ADR-0008**

## Purpose

BOOK-030 may establish the narrowest evidence-backed BET365 WebSocket hostname rule only from a controlled observation of the already source-locked BET365 direct page.

This procedure is for **hostname configuration provenance only**.

It does not authorize a live WSS connection, payload inspection, selector/matching changes, bookmaker support promotion, or production mapping.

## Preconditions

The observation may run only when all of the following are true:

1. BOOK-029's default-deny WSS gateway is integrated.
2. SEC-009 has approved this procedure and the exact observer implementation.
3. QA-008 has explicitly authorized the separately scoped non-CI hostname observation.
4. The source target remains the existing BOOK-024 BET365 source-locked direct URL. No runtime URL override is permitted.
5. The live WSS registry remains unchanged during observation.

## Browser boundary

The observer must:

- use fresh ephemeral headed Chromium;
- reject execution in CI;
- disable downloads and block service workers;
- retain the existing exact BET365 source lock;
- retain the existing public-HTTPS/DNS/private-network request policy for ordinary page traffic;
- expose no click/fill/type/select/upload/evaluate capability;
- automate no login, credential, MFA, CAPTCHA, consent bypass, stake, betslip, payment, wager, or private/protected API workflow;
- use no screenshots, video, trace, HAR, cookies, local/session storage, or authenticated profile.

The observation must use the same fixed navigation/readiness budget already approved for the passive direct-page diagnostic. It must not add retry, reopen, refresh, extra wait, or generic exploration.

## WebSocket observation rule

The WebSocket handler must intercept the **first WebSocket attempt only**.

For that attempted URL it may transiently parse, in memory:

- scheme;
- URL credentials presence;
- port;
- hostname.

It must then enforce:

- scheme exactly `wss:`;
- no URL username/password;
- default TLS port only;
- DNS hostname only, never an IPv4/IPv6 literal;
- canonical public hostname syntax;
- hostname is not loopback/local/internal;
- fail-closed DNS lookup succeeds and every answer is public/non-private.

DNS answers are validation inputs only. They must not be persisted, printed, hashed into the retained artifact, or used to construct a rule.

### Critical no-connect rule

The observer **must not call `connectToServer()`**.

The intercepted socket is closed immediately after hostname validation.

BOOK-030 is not allowed to connect an otherwise-unapproved socket merely to identify it, inspect its handshake, observe payloads, or see whether rendering improves.

## Retained artifact

The observer may retain exactly one record with this conceptual shape:

```ts
type Book030WssHostObservationV1 = Readonly<{
  schemaVersion: "notifyhandler.book030-wss-host-observation.v1";
  bookmaker: "bet365";
  sourceTarget: "BOOK_024_BET365_LOCKED_DIRECT";
  candidateHostname: string;
  publicDnsValidated: true;
  socketConnected: false;
  authorizesPolicy: false;
}>;
```

`candidateHostname` is the only dynamic network identifier that may be retained.

The artifact must not contain:

- full WebSocket URL;
- scheme string beyond the fixed schema contract;
- port;
- path, query, or fragment;
- IP/DNS answers;
- headers;
- cookies;
- Authorization values;
- subprotocol values;
- handshake request/response data;
- payload/message/frame data;
- browser/runtime/DNS exception text;
- page HTML/body/hidden text;
- screenshot/trace/HAR;
- account/session/profile data.

Unknown fields fail validation.

CLI/log failures must use fixed generic text and must not echo the attempted socket URL or hostname.

## Rule derivation

The observation never mutates `BOOKMAKER_WEBSOCKET_RULES` automatically.

After the sanitized observation is produced:

1. BOOK-030 records the exact canonical hostname as evidence.
2. The default proposal is an **exact-host rule**.
3. Security reviews the proposed source change before any live render re-test.
4. QA independently certifies exact-host allow, suffix confusion rejection, public-DNS failure, cancellation, stale-attempt, relay-WSS, privacy, and transaction boundaries.

### Suffix escalation

A suffix rule is not justified by one observed host.

If later controlled observations show genuinely varying BET365-owned hosts, do not infer or auto-learn a suffix. Open an architecture/security amendment with:

- at least two separately approved sanitized hostname observations;
- evidence that the proposed namespace is bookmaker-controlled;
- proof that the suffix is not a public suffix;
- proof that it contains the BET365 namespace label and remains within the approved bookmaker namespace.

Third-party infrastructure should use exact-host rules unless architecture and Security explicitly approve a narrower reviewed namespace.

## Failure behavior

If no qualifying first WSS attempt is observed, DNS validation is uncertain, the attempted socket is insecure, credential-bearing, IP-literal, or otherwise invalid, the run fails safely and retains **no candidate hostname**.

No alternative host may be guessed from page scripts, HTML, DNS aliases, certificates, redirects, network errors, historical logs, or external heuristics.

## Authorization boundary

A valid BOOK-030 hostname observation proves only:

> the source-locked BET365 page attempted a syntactically safe public WSS destination with this canonical hostname during the controlled observation.

It does **not** prove:

- bookmaker ownership by itself;
- necessity for matching;
- correctness of any socket payload;
- target event/market/line/outcome identity;
- feasibility/support;
- production selector validity;
- authorization to connect in a later live run.

The final WSS rule and the later render re-test remain separately gated.
