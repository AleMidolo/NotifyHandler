# Passive direct-page diagnostic provenance v2

Status: **Accepted architecture contract for Milestone 6**

V2 supersedes `passive-provenance.v1` for new passive live diagnostics after ARCH-011.

V1 remains valid historical evidence and must not be reinterpreted.

V2 changes only WebSocket transport semantics. Render-state minimization, source lock, timing, interaction, privacy, and non-authorizing rules remain as strict as v1.

## 1. Schema version

```ts
diagnosticSchemaVersion: "passive-provenance.v2";
```

Unknown versions/fields/enums fail artifact validation.

## 2. Transport provenance

Conceptually:

```ts
type PassiveTransportProvenanceV2 =
  | Readonly<{
      state: "CLEAR";
      websocket:
        | "NONE_OBSERVED"
        | "ALLOWED_REVIEWED_WSS_OBSERVED";
    }>
  | Readonly<{
      state: "BLOCKED";
      trigger:
        | "PUBLIC_HTTPS_TARGET_REJECTED"
        | "DISALLOWED_PROTOCOL";
      scope: "TOP_LEVEL" | "SUBRESOURCE";
    }>
  | Readonly<{
      state: "BLOCKED";
      trigger:
        | "INSECURE_WEBSOCKET"
        | "UNAPPROVED_WEBSOCKET"
        | "WEBSOCKET_PUBLIC_TARGET_REJECTED";
      scope: "SOCKET";
    }>;
```

An allowed reviewed WSS **does not** make the diagnostic `BLOCKED`.

## 3. WSS authorization

The diagnostic uses exactly the same bookmaker network policy as the browser gateway.

An allowed socket must satisfy `specs/bookmaker-network-policy.md`.

The diagnostic must not contain a looser or separate socket allowlist.

## 4. First blocked trigger

For terminal transport failures, retain only the first blocked trigger.

Allowed WSS observation is a boolean-like finite fact, not a request trace or count.

Do not retain the number/order of socket attempts.

## 5. Render provenance

Render provenance may be collected when:

1. transport state remains `CLEAR`, including when `ALLOWED_REVIEWED_WSS_OBSERVED`;
2. exact source-locked final route is preserved;
3. no auth/CAPTCHA/anti-bot/access/consent block is present.

Use the same v1 render shape:

- DOMContentLoaded confirmed/not-confirmed;
- participant-pair/competition title booleans only;
- target `domPresent` / `visibleObservedWithinBound`;
- fixed `EMPTY | SPARSE | POPULATED` DOM population bucket.

No extra wait is authorized to give WSS more time.

## 6. Retention prohibition

In addition to v1 prohibitions, do not retain:

- socket URL/hostname/IP/port/path/query/fragment;
- WebSocket Origin/header data;
- handshake metadata;
- payload/messages;
- socket counts;
- dynamic socket errors.

## 7. Non-authorizing invariant

Allowed or blocked WSS provenance:

- is not event/market/period/line/side evidence;
- does not authorize production mapping/support;
- does not authorize selection activation;
- does not authorize allowlist expansion;
- does not authorize retries or timing changes.

`authorizesProductionMapping` remains literal `false`.

## 8. Required regressions

1. no socket observed -> CLEAR/NONE_OBSERVED;
2. reviewed public WSS -> CLEAR/ALLOWED_REVIEWED_WSS_OBSERVED and render collection may continue;
3. unapproved WSS -> BLOCKED/UNAPPROVED_WEBSOCKET;
4. private/unsafe WSS -> BLOCKED/WEBSOCKET_PUBLIC_TARGET_REJECTED;
5. `ws://` -> BLOCKED/INSECURE_WEBSOCKET;
6. existing HTTPS public-target rejection unchanged;
7. existing disallowed ordinary protocol rejection unchanged;
8. blocked trigger remains first-trigger-only;
9. no socket destination/payload/count appears in summary;
10. existing v1 render-state privacy/allowlist invariants remain;
11. no timeout/readiness/action capability change;
12. no matching/activation/transaction capability change.

## 9. Live gate

Implementation + Security + QA approval are required before any new BET365 live run.

Architecture approval alone authorizes no live execution.
