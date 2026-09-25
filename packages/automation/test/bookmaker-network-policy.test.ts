import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "playwright-core";

import {
  BOOKMAKER_WEBSOCKET_RULES,
  BookmakerNetworkPolicy,
  createBookmakerNetworkPolicy,
} from "../src/bookmaker-network-policy.ts";
import { domMappingFor } from "../src/dom-mapping.ts";
import { NavigationPolicy } from "../src/navigation-policy.ts";
import { createWorkerPageRuntime } from "../src/page-runtime.ts";

const PUBLIC = async () => ["93.184.216.34"] as const;

function policy(options: Readonly<{
  exactHosts?: readonly string[];
  reviewedHostSuffixes?: readonly string[];
  resolveHostname?: (hostname: string) => Promise<readonly string[]>;
}> = {}): BookmakerNetworkPolicy {
  return new BookmakerNetworkPolicy(
    {
      bookmaker: "sisal",
      topLevelOrigins: ["https://www.sisal.it"],
      websocket: {
        exactHosts: options.exactHosts ?? [],
        reviewedHostSuffixes: options.reviewedHostSuffixes ?? [],
      },
    },
    options.resolveHostname ?? PUBLIC,
  );
}

test("BOOK-029 live bookmaker WSS registry is default-deny with no guessed host", () => {
  assert.deepEqual(BOOKMAKER_WEBSOCKET_RULES.sisal.exactHosts, []);
  assert.deepEqual(BOOKMAKER_WEBSOCKET_RULES.sisal.reviewedHostSuffixes, []);
  assert.deepEqual(BOOKMAKER_WEBSOCKET_RULES.bet365.exactHosts, []);
  assert.deepEqual(BOOKMAKER_WEBSOCKET_RULES.bet365.reviewedHostSuffixes, []);

  const live = createBookmakerNetworkPolicy(
    "bet365",
    ["https://www.bet365.it"],
    PUBLIC,
  );
  assert.equal(
    live.matchesReviewedWebSocketHost("socket.bet365.it"),
    false,
  );
});

test("reviewed exact public WSS host is allowed only from approved bookmaker top-level page", async () => {
  const value = policy({ exactHosts: ["socket.example.com"] });
  assert.deepEqual(
    await value.evaluateWebSocket(
      "wss://socket.example.com/feed",
      "https://www.sisal.it/event",
    ),
    { allowed: true },
  );
  assert.deepEqual(
    await value.evaluateWebSocket(
      "wss://socket.example.com/feed",
      "https://example.com/event",
    ),
    { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" },
  );
});

test("reviewed bookmaker namespace suffix allows exact namespace and subdomains but resists suffix confusion", async () => {
  const value = policy({ reviewedHostSuffixes: ["sisal.it"] });
  assert.deepEqual(
    await value.evaluateWebSocket(
      "wss://stream.sisal.it/feed",
      "https://www.sisal.it/event",
    ),
    { allowed: true },
  );
  assert.deepEqual(
    await value.evaluateWebSocket(
      "wss://sisal.it/feed",
      "https://www.sisal.it/event",
    ),
    { allowed: true },
  );
  assert.deepEqual(
    await value.evaluateWebSocket(
      "wss://evilsisal.it/feed",
      "https://www.sisal.it/event",
    ),
    { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" },
  );
});

test("reviewed suffix cannot escape the bookmaker namespace or expand to a public suffix", () => {
  assert.throws(
    () => policy({ reviewedHostSuffixes: ["example.com"] }),
    /bookmaker namespace label|approved bookmaker origin namespace/,
  );
  assert.throws(
    () => policy({ reviewedHostSuffixes: ["com"] }),
    /canonical DNS namespace/,
  );
  assert.throws(
    () => new BookmakerNetworkPolicy(
      {
        bookmaker: "sisal",
        topLevelOrigins: ["https://www.sisal.co.uk"],
        websocket: {
          exactHosts: [],
          reviewedHostSuffixes: ["co.uk"],
        },
      },
      PUBLIC,
    ),
    /public-suffix expansion is forbidden/,
  );
  assert.doesNotThrow(
    () => new BookmakerNetworkPolicy(
      {
        bookmaker: "sisal",
        topLevelOrigins: ["https://www.sisal.co.uk"],
        websocket: {
          exactHosts: [],
          reviewedHostSuffixes: ["sisal.co.uk"],
        },
      },
      PUBLIC,
    ),
  );
});

test("unapproved, insecure, credential-bearing, non-443 and IP-literal sockets fail closed", async () => {
  const value = policy({ exactHosts: ["socket.example.com"] });
  const cases = [
    ["wss://unapproved.example.com/feed", "BOOKMAKER_WSS_UNAPPROVED"],
    ["ws://socket.example.com/feed", "BOOKMAKER_WSS_INSECURE"],
    ["wss://user:secret@socket.example.com/feed", "BOOKMAKER_WSS_UNAPPROVED"],
    ["wss://socket.example.com:8443/feed", "BOOKMAKER_WSS_UNAPPROVED"],
    ["wss://93.184.216.34/feed", "BOOKMAKER_WSS_UNAPPROVED"],
    ["wss://[2606:2800:220:1:248:1893:25c8:1946]/feed", "BOOKMAKER_WSS_UNAPPROVED"],
  ] as const;

  for (const [url, code] of cases) {
    assert.deepEqual(
      await value.evaluateWebSocket(url, "https://www.sisal.it/event"),
      { allowed: false, code },
      url,
    );
  }
});

test("WSS DNS failure, empty answers, private, loopback and link-local answers fail closed", async () => {
  const addresses = [
    [] as const,
    ["127.0.0.1"] as const,
    ["10.0.0.5"] as const,
    ["169.254.1.1"] as const,
    ["::1"] as const,
    ["fe80::1"] as const,
    ["93.184.216.34", "192.168.1.10"] as const,
  ];

  for (const answer of addresses) {
    const value = policy({
      exactHosts: ["socket.example.com"],
      resolveHostname: async () => answer,
    });
    assert.deepEqual(
      await value.evaluateWebSocket(
        "wss://socket.example.com/feed",
        "https://www.sisal.it/event",
      ),
      { allowed: false, code: "BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED" },
      JSON.stringify(answer),
    );
  }

  const failed = policy({
    exactHosts: ["socket.example.com"],
    resolveHostname: async () => { throw new Error("dns unavailable"); },
  });
  assert.deepEqual(
    await failed.evaluateWebSocket(
      "wss://socket.example.com/feed",
      "https://www.sisal.it/event",
    ),
    { allowed: false, code: "BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED" },
  );
});

test("cancelled attempt never authorizes WSS transport", async () => {
  const value = policy({ exactHosts: ["socket.example.com"] });
  assert.deepEqual(
    await value.evaluateWebSocket(
      "wss://socket.example.com/feed",
      "https://www.sisal.it/event",
      true,
    ),
    { allowed: false, code: "BOOKMAKER_WSS_UNAPPROVED" },
  );
});


interface FakeSocket {
  readonly url: () => string;
  readonly connectToServer: () => void;
  readonly close: (options?: { code?: number; reason?: string }) => Promise<void>;
}

async function runtimeWithSocketPolicy(
  networkPolicy: BookmakerNetworkPolicy,
): Promise<Readonly<{
  handler: (socket: FakeSocket) => Promise<void> | void;
  runtime: Awaited<ReturnType<typeof createWorkerPageRuntime>>;
}>> {
  let socketHandler: ((socket: FakeSocket) => Promise<void> | void) | undefined;
  const fakePage = {
    async route() {},
    async routeWebSocket(_pattern: string, handler: (socket: FakeSocket) => Promise<void> | void) {
      socketHandler = handler;
    },
    on() { return fakePage; },
    isClosed() { return false; },
    url() { return "https://www.sisal.it/event"; },
    mainFrame() { return {}; },
  } as unknown as Page;

  const runtime = await createWorkerPageRuntime({
    page: fakePage,
    policy: new NavigationPolicy(["https://www.sisal.it"], PUBLIC),
    networkPolicy,
    mapping: domMappingFor("sisal"),
  });
  assert.ok(socketHandler);
  return { handler: socketHandler, runtime };
}

test("browser gateway closes unapproved socket and revokes matching capability", async () => {
  const { handler, runtime } = await runtimeWithSocketPolicy(
    createBookmakerNetworkPolicy(
      "sisal",
      ["https://www.sisal.it"],
      PUBLIC,
    ),
  );
  let connects = 0;
  let closes = 0;
  await handler({
    url: () => "wss://socket.example.com/feed",
    connectToServer: () => { connects += 1; },
    close: async () => { closes += 1; },
  });
  assert.equal(connects, 0);
  assert.equal(closes, 1);
  assert.equal(runtime.currentNetworkFailure(), "BOOKMAKER_WSS_UNAPPROVED");
  assert.deepEqual(
    await runtime.port.query({ kind: "event-candidate" }),
    [],
  );
  assert.equal(runtime.isCurrentLocationAllowed(), false);
});

test("browser gateway connects reviewed public WSS without exposing socket data to matching API", async () => {
  const { handler, runtime } = await runtimeWithSocketPolicy(
    policy({ exactHosts: ["socket.example.com"] }),
  );
  let connects = 0;
  let closes = 0;
  await handler({
    url: () => "wss://socket.example.com/feed?opaque=secret",
    connectToServer: () => { connects += 1; },
    close: async () => { closes += 1; },
  });
  assert.equal(connects, 1);
  assert.equal(closes, 0);
  assert.equal(runtime.currentNetworkFailure(), undefined);
  assert.equal(
    "websocket" in (runtime.port as unknown as Record<string, unknown>),
    false,
  );
  assert.equal(
    "socket" in (runtime.port as unknown as Record<string, unknown>),
    false,
  );
});

test("allowed WSS is actively revoked when its attempt is cancelled", async () => {
  const { handler, runtime } = await runtimeWithSocketPolicy(
    policy({ exactHosts: ["socket.example.com"] }),
  );
  runtime.beginAttempt();
  let connects = 0;
  let closes = 0;
  await handler({
    url: () => "wss://socket.example.com/feed",
    connectToServer: () => { connects += 1; },
    close: async () => { closes += 1; },
  });
  assert.equal(connects, 1);
  assert.equal(closes, 0);

  runtime.cancelInFlight();
  assert.equal(closes, 1);
});

test("superseding an attempt revokes its allowed WSS before the new attempt proceeds", async () => {
  const { handler, runtime } = await runtimeWithSocketPolicy(
    policy({ exactHosts: ["socket.example.com"] }),
  );
  runtime.beginAttempt();
  let connects = 0;
  let closes = 0;
  await handler({
    url: () => "wss://socket.example.com/feed",
    connectToServer: () => { connects += 1; },
    close: async () => { closes += 1; },
  });
  assert.equal(connects, 1);

  runtime.beginAttempt();
  assert.equal(closes, 1);
});

test("WSS DNS decision from an old attempt cannot connect after cancellation", async () => {
  let releaseDns: ((addresses: readonly string[]) => void) | undefined;
  const resolver = () => new Promise<readonly string[]>((resolve) => {
    releaseDns = resolve;
  });
  const { handler, runtime } = await runtimeWithSocketPolicy(
    policy({
      exactHosts: ["socket.example.com"],
      resolveHostname: resolver,
    }),
  );
  runtime.beginAttempt();
  let connects = 0;
  let closes = 0;
  const handling = Promise.resolve(handler({
    url: () => "wss://socket.example.com/feed",
    connectToServer: () => { connects += 1; },
    close: async () => { closes += 1; },
  }));

  assert.ok(releaseDns);
  runtime.cancelInFlight();
  releaseDns(["93.184.216.34"]);
  await handling;

  assert.equal(connects, 0);
  assert.equal(closes, 1);
});
