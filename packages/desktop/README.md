# Local desktop application

`@notify-handler/desktop` is the local composition root and user-operable shell between the bookmaker-agnostic application core and the isolated browser-automation worker.

## Development launch

From the repository root:

```sh
npm ci --ignore-scripts
npm run browser:install
npm run desktop:dev
```

The dev command pins Electron `44.3.0` on demand instead of adding Electron to the production dependency lock. The shell starts without bookmaker credentials and performs no bookmaker action until notification input is delivered. Packaging/installers remain a Release / DevOps follow-up.

## Runtime boundary

`createLocalNotifyHandlerRuntime()` constructs the automatic orchestrator, concrete Playwright worker facade, worker-owned preflight, and independent per-leg SISAL/BET365 browser sessions. `createProductionDesktopController()` adds the trusted main-process state/IPC controller and non-sensitive notification-to-first-worker-start latency metrics.

The Electron renderer is sandboxed, uses context isolation, has Node integration and webviews disabled, and receives only a narrow preload bridge. It cannot access Playwright, browser/session objects, filesystem APIs, credentials, cookies/tokens, or generic IPC/browser controls.

Submitting notification input enters the existing automatic path immediately: recommendation index `0` is resolved, preflight runs, and both legs are dispatched without a preview acknowledgement, pair selector, plan confirmation, or Start button. Renderer updates are out-of-band and never gate browser startup.

The renderer shows the exact normalized two-leg target, independent leg state, expected/observed odds, safe failures, and only state-valid recovery controls. Stale leg/attempt commands are rejected in the trusted controller. `READY_FOR_USER` is a manual handoff: authentication, stake entry, review, and final submission remain user actions in the separate bookmaker windows.

Browser E2E tests continue to use synthetic in-memory HTTPS fixture routing and never contact live bookmaker infrastructure.


## Structured direct-pair webhook

When the desktop app is running it also listens on the IPv4 loopback interface only:

`POST http://127.0.0.1:43119/api/v1/notifications/direct-pair`

The port may be changed with `NOTIFYHANDLER_INGRESS_PORT`; the bind address is not configurable and remains `127.0.0.1`. A 256-bit local bearer capability is generated on first launch at the Electron user-data path `direct-pair-ingress-token`. The token file is hardened to mode `0600` on POSIX and to a current-user-only ACL on Windows. The token is for the local NotifyHandler ingress only: do not put it in URLs, payloads, logs, or bookmaker credentials.

Restart-safe replay protection is persisted separately at `direct-pair-ingress-idempotency.json` in the same Electron user-data directory. Tombstones are retained for 24 hours and store only notification id, normalized payload hash, deterministic execution id, reservation timestamp, and pending/accepted state. The file uses the same current-user-only permission hardening. Raw request bodies, deep links, bearer tokens, bookmaker credentials, cookies, and session data are never persisted there.

To rotate the local capability, stop NotifyHandler and restart it once with `NOTIFYHANDLER_ROTATE_INGRESS_TOKEN=1`, then remove that environment variable and update the local sender from the newly written token file. Rotation changes only the local bearer capability; it does not change the structured payload schema or any bookmaker credential.

Example request body:

```json
{
  "schemaVersion": "notifyhandler.direct-pair.v1",
  "notificationId": "surebet-20260921-001",
  "sentAt": "2026-09-21T13:00:00.000Z",
  "event": {
    "participantA": "Real Madrid",
    "participantB": "Rayo Vallecano",
    "competition": "La Liga",
    "scheduledAt": "2026-09-21T19:00:00+02:00"
  },
  "market": {
    "family": "total",
    "context": "corners",
    "period": "full_match",
    "line": "11.5",
    "sourceLabel": "U/O CORNER 11.5"
  },
  "legs": [
    {
      "bookmaker": "sisal",
      "outcome": "over",
      "expectedOdds": "2.90",
      "deepLink": "https://www.sisal.it/<public-direct-match-path>"
    },
    {
      "bookmaker": "bet365",
      "outcome": "under",
      "expectedOdds": "1.61",
      "deepLink": "https://www.bet365.it/<public-direct-match-path>"
    }
  ]
}
```

Send it with `Content-Type: application/json` and `Authorization: Bearer <local-ingress-token>`. The endpoint has a 64 KiB body ceiling, rejects browser-origin/CORS requests, enforces notification freshness plus durable bounded idempotency, and returns only sanitized execution metadata. A same-process exact duplicate returns the existing execution reference without a second start. After NotifyHandler restarts, a still-retained exact replay is rejected with `IDEMPOTENCY_REPLAY_BLOCKED` and zero worker starts because prior browser execution state is not restored. Reusing the same id with different normalized content returns `IDEMPOTENCY_CONFLICT`.

A valid new request persists its pending tombstone before entering the existing automatic two-leg preflight/start path; no renderer confirmation is involved. Corrupt durable idempotency state prevents the listener from starting, and expired tombstones are evicted. A direct link is only navigation input and never replaces event, market, exact-line, outcome, or odds verification.
