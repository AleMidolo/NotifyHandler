# Structured direct-pair ingestion v2

Status: **Accepted architecture contract for Milestone 6**

This specification extends the structured machine-to-machine contract with a typed navigation candidate so real upstream `bet-up.it` relay links can be accepted without changing the guarantees of `notifyhandler.direct-pair.v1`.

`notifyhandler.direct-pair.v1` remains supported and frozen as the direct-bookmaker-link contract in `specs/structured-ingestion-v1.md`.

## 1. Protocol identifier

A v2 payload declares:

```json
{
  "schemaVersion": "notifyhandler.direct-pair.v2"
}
```

Unknown versions are rejected. A v1 payload is never reinterpreted as v2 and a failed v2 payload is never retried as v1.

## 2. Payload

V2 preserves the event/market/timing semantics and exactly-two-leg invariant of v1, including required `market.period: "full_match"`, but replaces each leg's untyped `deepLink` with a typed navigation candidate.

Conceptually:

```ts
type DirectPairNotificationV2 = Readonly<{
  schemaVersion: "notifyhandler.direct-pair.v2";
  notificationId: string;
  sentAt: string;
  event: {
    participantA: string;
    participantB: string;
    competition?: string;
    scheduledAt?: string;
    sourceDisplay?: string;
  };
  market: {
    family: string;
    context?: string;
    period: "full_match";
    line?: string;
    sourceLabel?: string;
  };
  legs: readonly [DirectPairLegV2, DirectPairLegV2];
}>;

type DirectPairLegV2 = Readonly<{
  bookmaker: BookmakerId;
  outcome: string;
  expectedOdds: string;
  navigation:
    | {
        kind: "bookmaker-direct";
        url: string;
      }
    | {
        kind: "betup-relay";
        url: string;
      };
}>;
```

The explicit two legs remain authoritative. There is no recommendation chooser or alternate-pair fallback.

## 3. Backwards compatibility

V1 remains valid for producers that can supply a bookmaker-origin direct match URL.

V2 is required when a leg uses a supported relay URL. V2 may also carry a typed direct-bookmaker navigation candidate.

The application may support v1 and v2 on the same loopback endpoint because `schemaVersion` selects the validator deterministically.

V1 semantics are not widened to accept relay origins.

## 4. Bet-up relay grammar

A `betup-relay` candidate must satisfy all of the following before any browser navigation:

- scheme exactly `https:`;
- normalized origin exactly `https://www.bet-up.it`;
- no username or password;
- no query string;
- no fragment;
- path exactly:

```text
/lnk/<signal-uuid>/<bookmaker-suffix>
```

where:

- `signal-uuid` is one canonical UUID-shaped value using the `8-4-4-4-12` hexadecimal form; it is normalized to lower case for comparison/diagnostics;
- `bookmaker-suffix` is lower-case ASCII and must resolve through a version-controlled relay-suffix registry;
- the resolved suffix bookmaker must equal the leg's canonical `bookmaker`;
- the bookmaker must also be supported by the current application/adapter registry before execution starts.

Examples of observed suffixes include `bet365`, `sisal`, `lottomatica`, `eplay24`, `admiralbet`, and `domusbet`. Recognizing a suffix does not imply an adapter exists or that the bookmaker is live `Supported`.

If both legs use `betup-relay`, their normalized signal UUID values must be equal. A mismatch is a plan validation failure because one structured pair must not silently combine legs from two different upstream signals.

The relay signal UUID is never interpreted as a credential, account identifier, bookmaker event id, or matching-evidence id.

## 5. Navigation candidate normalization

The core normalizes v2 navigation into a typed internal value:

```ts
type NavigationTarget =
  | Readonly<{
      kind: "BOOKMAKER_DIRECT";
      url: HttpsUrl;
    }>
  | Readonly<{
      kind: "BETUP_RELAY";
      url: HttpsUrl;
      signalId: string;
      bookmaker: BookmakerId;
    }>;
```

A worker/adapter must not infer relay behavior from a raw URL string alone. The typed kind is part of the immutable selection target.

## 6. Validation ownership

### Application/core preflight

Before execution creation the application validates:

- supported v2 schema;
- existing freshness/idempotency/request rules from v1/ARCH-004;
- exactly two distinct supported bookmaker legs;
- market/outcome/odds semantics, including required full-match market period;
- navigation candidate type;
- direct-bookmaker candidate under the existing v1 URL policy, or relay candidate under the exact grammar above;
- relay suffix/bookmaker binding;
- same relay signal UUID across both relay legs when both are relays.

The application does **not** follow the relay, resolve the final bookmaker URL, or count relay metadata as bookmaker evidence.

### Worker/browser gateway

Network resolution is owned by a dedicated restricted relay-resolution stage inside the browser-automation worker/gateway because it is browser navigation behavior and must share the existing session, DNS/private-target defenses, request interception, cancellation, and origin policy.

The application must not resolve relays using an unrestricted HTTP client and then pass an arbitrary final URL to the worker.

## 7. Restricted relay-resolution algorithm

For `BETUP_RELAY`:

1. start a fresh leg browser attempt with no positive matching evidence;
2. immediately before navigation, revalidate relay URL syntax/origin and resolved addresses;
3. reject when any resolved relay-host address is loopback, link-local, private/internal, multicast, otherwise forbidden, or resolution is uncertain under the shared fail-closed network policy;
4. open the exact validated relay URL through normal browser navigation;
5. permit only a direct top-level transition from the exact relay origin to an origin already registered for the leg's expected bookmaker adapter;
6. reject any unreviewed third-party intermediary origin;
7. before allowing the expected-bookmaker request, apply the same DNS/private-target validation to that target;
8. once the first allowed expected-bookmaker top-level request is reached, relay resolution completes and normal adapter navigation/matching policy takes over;
9. re-check the current/final origin before matching starts.

The resolver does not expose arbitrary navigation, raw Playwright objects, shell access, generic JavaScript evaluation, credentials, or transaction capabilities.

## 8. Redirect/navigation budget

The default relay policy is deliberately narrow:

- initial document origin must be exactly `https://www.bet-up.it`;
- only one cross-origin relay transition is authorized: `bet-up.it -> expected bookmaker adapter origin`;
- no affiliate/tracker/URL-shortener/other intermediary origin is allowed;
- a second visit/reload/loop at the relay origin before bookmaker arrival is treated as unresolved/looping unless an explicit later ADR approves a reviewed pattern;
- after the expected bookmaker origin is reached, subsequent navigation is governed only by that adapter's existing approved-origin policy and evidence-epoch rules;
- every later top-level origin is still revalidated.

This policy supports HTTP redirect, meta/client-side navigation, or script-driven top-level navigation only when the actual next top-level request is the expected bookmaker origin. It does not authorize arbitrary page scripting.

## 9. DNS/private-target policy

The relay origin and every top-level redirect/navigation target are subject to the existing fail-closed resolved-address policy.

A host is rejected when any address selected/returned for the validated navigation is forbidden under the shared network policy.

During the relay-resolution phase, the browser gateway should also block relay-page requests to loopback/private/internal targets where technically enforceable; Security owns concrete interception hardening.

DNS uncertainty or inability to apply the required policy is a safe failure, not a reason to skip validation.

## 10. Final bookmaker binding

A relay is resolved successfully only when the browser reaches an origin registered to the **same bookmaker specified by the leg**.

The path suffix is only an early consistency check. It is not proof that the relay actually resolves to that bookmaker.

If a `/sisal` relay resolves to BET365, or any relay resolves to an unapproved origin, execution fails before matching.

The resolved URL is runtime navigation state. It must not replace the immutable target bookmaker/event/market/outcome intent.

## 11. Evidence epochs

Relay resolution is a pre-evidence navigation phase.

- no event/market/line/outcome/odds dimension may be `MATCHED` while the current origin is the relay origin;
- reaching the expected bookmaker origin creates/advances to a fresh evidence epoch before matching begins;
- every subsequent redirect, refresh, manual-login completion, reopen, or material page replacement uses the existing evidence invalidation rules;
- relay path/suffix/signal UUID never enter `MatchingEvidenceSnapshot` as positive identity evidence.

The SelectionActivationGate is unchanged and can authorize activation only from current bookmaker-page evidence.

## 12. Authentication/challenge behavior

The relay is expected to be credential-free.

If `bet-up.it` itself requires login, MFA, CAPTCHA, another access challenge, or a consent flow that cannot be traversed by the approved bounded navigation policy, return a relay-resolution safe failure. NotifyHandler must not ask the user to authenticate to the relay and must not automate the challenge.

If relay resolution succeeds to an approved bookmaker origin and the bookmaker then requires login, the existing `AUTH_REQUIRED` manual-bookmaker-auth flow applies. Resume creates fresh evidence and revalidates the bookmaker origin/target exactly as before.

## 13. Safe failures

Relay-specific failures occur before final selection activation and therefore use `activation: "NOT_ATTEMPTED"`.

Normative failure codes are defined in `docs/error-model.md`, including:

- malformed or unsupported relay URL;
- relay suffix/bookmaker mismatch;
- relay signal mismatch across a two-relay pair;
- blocked relay network target;
- unexpected intermediary origin;
- wrong final bookmaker origin;
- relay loop/limit/unresolved timeout;
- unsupported relay authentication/challenge state.

A relay that resolves to the correct bookmaker but the wrong/stale event proceeds to ordinary deterministic matching and then fails with the existing event/market/line/outcome/odds taxonomy.

## 14. Cancellation and retry

Cancellation applies during relay resolution.

After cancellation:

- no further relay or bookmaker top-level navigation is initiated for that attempt;
- late browser callbacks cannot begin matching or activate a selection.

Retry/reopen creates a fresh attempt and reruns relay validation/resolution from the immutable candidate. It does not reuse a previously resolved final URL as trusted state.

## 15. Diagnostics/privacy

Permitted relay diagnostics include:

- navigation kind;
- relay origin;
- canonical bookmaker suffix/id;
- a non-reversible or truncated hash of the signal UUID when correlation is needed;
- hop/transition count;
- failure code;
- sanitized final bookmaker origin/path category;
- timings.

Do not persist/log by default:

- the full relay URL;
- the full signal UUID;
- query/fragment data;
- Authorization headers/local-ingress token;
- resolved final URL when it can contain sensitive parameters;
- cookies/session storage/authenticated HTML.

The immutable runtime plan may retain the URL only as long as required to execute/retry the current plan under the existing persistence policy.

## 16. Required tests

Structured-v2 tests must include:

1. valid relay grammar + suffix/bookmaker agreement;
2. malformed relay path;
3. query/fragment/userinfo rejection;
4. unknown suffix;
5. suffix/leg-bookmaker mismatch;
6. two relay legs with different signal UUIDs;
7. private/internal relay DNS result;
8. valid relay -> expected bookmaker;
9. relay -> unexpected third-party intermediary;
10. relay -> wrong bookmaker;
11. relay loop/revisit/transition-limit failure;
12. private/internal final-bookmaker DNS result;
13. relay auth/challenge safe failure;
14. correct bookmaker arrival followed by wrong event -> ordinary event safe failure;
15. direct-bookmaker v2 candidate retains existing direct-link rules;
16. v1 direct-bookmaker payload still behaves unchanged;
17. relay path/suffix never counts as positive identity evidence;
18. cancellation during relay resolution prevents later matching/activation;
19. diagnostics omit full relay URL/signal UUID and secrets;
20. zero stake/wager/credential/bypass capability expansion.


## 17. Market-period preservation

V2 requires `market.period: "full_match"` for the current protocol and must preserve it into each immutable `SelectionTarget.market.period`.

Relay resolution does not supply or repair market-period evidence. After expected-bookmaker arrival, the adapter must independently establish full-match period before market identity can become `MATCHED`.

A first-half/other-period page candidate remains a normal deterministic market mismatch even if the relay, event, line, side, and odds otherwise look correct.
