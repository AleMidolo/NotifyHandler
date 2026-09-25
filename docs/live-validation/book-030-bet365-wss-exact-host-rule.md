# BOOK-030 — Evidence-backed BET365 exact WSS host rule

Date: **2026-09-25**  
Issue: **BOOK-030 / #210**  
Observer implementation: **BOOK-031 / #221**, merged as `07ba06904cd128f0755f312bf0f0b41fb86a5058`  
Security observer review: **SEC-010 / #222**  
QA observer certification: **QA-009 / #223**  
One-shot execution: **DEVOPS-018 / #224**

## Decision

BOOK-030 proposes exactly one BET365 WebSocket host rule:

```text
premws-pt1.it.365lpodds.com
```

Rule type: **exact host only**.

No reviewed suffix is added.

No sibling, child, parent, public-suffix, or lookalike hostname is authorized by this proposal.

## Provenance

DEVOPS-018 executed the single QA-authorized non-CI headed hostname observation on the merged BOOK-031 source commit.

The retained artifact has schema:

`notifyhandler.book030-wss-host-observation.v1`

and records:

- bookmaker: `bet365`;
- source target: `BOOK_024_BET365_LOCKED_DIRECT`;
- canonical candidate hostname: `premws-pt1.it.365lpodds.com`;
- `publicDnsValidated: true`;
- `socketConnected: false`;
- `authorizesPolicy: false`.

Artifact SHA-256:

`18DDF3841032D98649AB20A2BF6D79A93ED84A5C33693DDC495AC73DC4D036D0`

The observer retained no WebSocket path/query/fragment, IP/DNS answers, headers, cookies, subprotocol, handshake data, payload, runtime error, page content, screenshot, trace, HAR, or authenticated/session data.

The observation itself did not authorize the source rule. This document and the corresponding source change are the separately reviewable BOOK-030 proposal required by the approved procedure.

## Why exact host only

One controlled observation establishes provenance for only one canonical destination hostname.

It does **not** establish that:

- adjacent numbered hosts are required;
- arbitrary subdomains under `365lpodds.com` are required;
- the parent namespace is bookmaker-controlled;
- a suffix rule is operationally necessary;
- the observed socket is sufficient for target rendering or matching.

Therefore BOOK-030 does not add:

- `365lpodds.com`;
- `it.365lpodds.com`;
- any wildcard/suffix rule;
- any inferred sibling such as `premws-pt2.it.365lpodds.com`.

Suffix escalation remains prohibited without the separately documented multi-observation architecture/security process.

## Runtime authorization that remains mandatory

Even for the exact reviewed hostname, the browser gateway still requires:

1. selected bookmaker = BET365;
2. current top-level page origin is approved BET365 HTTPS;
3. socket scheme exactly `wss:`;
4. no URL credentials;
5. default TLS WebSocket port only;
6. DNS hostname, not an IP literal;
7. exact reviewed-host match;
8. non-empty DNS resolution;
9. every resolver result is a syntactically valid IP address;
10. every DNS answer public/non-private/non-loopback/non-link-local;
11. current attempt still live and not cancelled/superseded.

The gateway exposes no socket destination or payload to adapter/core/renderer matching logic.

Cancellation and attempt replacement still revoke allowed sockets.

## Deterministic rule tests

BOOK-030 adds explicit regressions for:

- exact observed hostname matches;
- sibling hostname rejected;
- child-subdomain expansion rejected;
- prefix/suffix confusion rejected;
- appended attacker suffix rejected;
- unrelated BET365-looking hostname rejected;
- wrong top-level origin rejected;
- insecure `ws://` rejected;
- non-default port rejected;
- empty/private/loopback/link-local/mixed DNS answers rejected.

Existing relay-WSS, cancellation, superseded-attempt, capability-isolation, privacy, and transaction-boundary regressions remain mandatory.

## Support/status boundary

This rule proposal does **not**:

- promote BET365 to live `Supported`;
- establish event/market/period/line/side evidence;
- establish a live selector mapping;
- authorize outcome activation in exploratory tooling;
- authorize a BET365 live render re-test.

BET365 remains fixture-backed **Testable** and live **Blocked** for the current narrow target scope until later evidence changes that status through the documented support gates.

## Required downstream review

Before any BET365 live render re-test:

1. Security must approve this exact-host source rule.
2. QA must independently certify the exact-host, suffix-confusion, DNS/public-target, cancellation/stale-attempt, relay-WSS, privacy, and transaction-boundary regressions.
3. Only after both approvals may a separately scoped live render re-test be authorized.

If either review rejects the rule, revert to the default-deny BET365 registry and do not re-run under a guessed or widened policy.
