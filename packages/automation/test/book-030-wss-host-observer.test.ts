import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { HostResolver } from "../src/navigation-policy.ts";
import {
  BOOK_030_SOURCE_TARGET,
  BOOK_030_WSS_HOST_OBSERVATION_SCHEMA,
  assertBook030NoRuntimeTargetOverride,
  assertBook030NonCiEnvironment,
  createBook030FirstSocketObserver,
  validateBook030WssHostObservation,
} from "../src/live-validation/book-030-wss-host-observer.ts";

type ObservationSocket = Parameters<
  ReturnType<typeof createBook030FirstSocketObserver>["handle"]
>[0];

function socket(
  rawUrl: string,
  closed: { count: number },
): ObservationSocket {
  return {
    url: () => rawUrl,
    async close() {
      closed.count += 1;
    },
  };
}

const publicResolver: HostResolver = async () => ["93.184.216.34"];

test("qualifying first WSS retains only the validated canonical hostname artifact", async () => {
  const observer = createBook030FirstSocketObserver(publicResolver);
  const closed = { count: 0 };

  await observer.handle(socket("wss://stream.bet365.test/feed?opaque=secret", closed));

  assert.equal(observer.firstAttemptObserved(), true);
  assert.equal(observer.failedClosed(), false);
  assert.equal(closed.count, 1);
  assert.deepEqual(observer.observation(), {
    schemaVersion: BOOK_030_WSS_HOST_OBSERVATION_SCHEMA,
    bookmaker: "bet365",
    sourceTarget: BOOK_030_SOURCE_TARGET,
    candidateHostname: "stream.bet365.test",
    publicDnsValidated: true,
    socketConnected: false,
    authorizesPolicy: false,
  });

  const serialized = JSON.stringify(observer.observation());
  for (const forbidden of ["/feed", "opaque", "secret", "93.184.216.34", "wss://"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("no WSS attempt fabricates no hostname", () => {
  const observer = createBook030FirstSocketObserver(publicResolver);
  assert.equal(observer.firstAttemptObserved(), false);
  assert.equal(observer.failedClosed(), false);
  assert.equal(observer.observation(), undefined);
});

test("first WSS only is inspected and later attempts cannot replace retained provenance", async () => {
  let resolutions = 0;
  const resolver: HostResolver = async () => {
    resolutions += 1;
    return ["93.184.216.34"];
  };
  const observer = createBook030FirstSocketObserver(resolver);
  const firstClosed = { count: 0 };
  const secondClosed = { count: 0 };

  await observer.handle(socket("wss://first.bet365.test/feed", firstClosed));
  await observer.handle(socket("wss://second.bet365.test/other", secondClosed));

  assert.equal(resolutions, 1);
  assert.equal(firstClosed.count, 1);
  assert.equal(secondClosed.count, 1);
  assert.equal(observer.observation()?.candidateHostname, "first.bet365.test");
});

test("unsafe first WSS forms fail closed and retain no hostname", async () => {
  const cases: readonly [string, HostResolver][] = [
    ["ws://stream.bet365.test/feed", publicResolver],
    ["wss://user:pass@stream.bet365.test/feed", publicResolver],
    ["wss://stream.bet365.test:8443/feed", publicResolver],
    ["wss://127.0.0.1/feed", publicResolver],
    ["wss://[::1]/feed", publicResolver],
    ["wss://localhost/feed", publicResolver],
    ["wss://stream.bet365.test/feed", async () => ["127.0.0.1"]],
    ["wss://stream.bet365.test/feed", async () => ["10.0.0.1"]],
    ["wss://stream.bet365.test/feed", async () => ["169.254.1.5"]],
    ["wss://stream.bet365.test/feed", async () => []],
    ["wss://stream.bet365.test/feed", async () => { throw new Error("dns fixture"); }],
    ["not a websocket url", publicResolver],
  ];

  for (const [rawUrl, resolver] of cases) {
    const observer = createBook030FirstSocketObserver(resolver);
    const closed = { count: 0 };
    await observer.handle(socket(rawUrl, closed));
    assert.equal(observer.firstAttemptObserved(), true, rawUrl);
    assert.equal(observer.failedClosed(), true, rawUrl);
    assert.equal(observer.observation(), undefined, rawUrl);
    assert.equal(closed.count, 1, rawUrl);
  }
});

test("artifact validator rejects unknown fields, altered fixed values, and unsafe hostname forms", () => {
  const valid = {
    schemaVersion: BOOK_030_WSS_HOST_OBSERVATION_SCHEMA,
    bookmaker: "bet365",
    sourceTarget: BOOK_030_SOURCE_TARGET,
    candidateHostname: "stream.bet365.test",
    publicDnsValidated: true,
    socketConnected: false,
    authorizesPolicy: false,
  } as const;

  assert.deepEqual(validateBook030WssHostObservation(valid), valid);
  assert.throws(
    () => validateBook030WssHostObservation({ ...valid, socketUrl: "wss://stream.bet365.test/feed" }),
    /unknown or missing field/,
  );
  assert.throws(
    () => validateBook030WssHostObservation({ ...valid, candidateHostname: "127.0.0.1" }),
    /invalid hostname/,
  );
  assert.throws(
    () => validateBook030WssHostObservation({ ...valid, candidateHostname: "localhost" }),
    /invalid hostname/,
  );
  assert.throws(
    () => validateBook030WssHostObservation({ ...valid, socketConnected: true }),
    /invalid fixed value/,
  );
  assert.throws(
    () => validateBook030WssHostObservation({ ...valid, authorizesPolicy: true }),
    /invalid fixed value/,
  );
});

test("CI refusal and runtime target override guards are fail closed", () => {
  assert.doesNotThrow(() => assertBook030NonCiEnvironment({}));
  for (const key of ["CI", "GITHUB_ACTIONS", "TF_BUILD", "BUILD_BUILDID", "JENKINS_URL"]) {
    assert.throws(
      () => assertBook030NonCiEnvironment({ [key]: "true" }),
      /intentionally disabled in CI/,
    );
  }
  assert.doesNotThrow(() => assertBook030NoRuntimeTargetOverride([]));
  assert.throws(
    () => assertBook030NoRuntimeTargetOverride(["https://www.bet365.it/"]),
    /accepts no runtime target override/,
  );
});

test("BOOK-031 source remains source-locked, bounded, non-interactive, and unable to establish a socket", async () => {
  const source = await readFile(
    new URL("../src/live-validation/book-030-wss-host-observer.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /BOOK_024_TARGETS\.bet365\.url/);
  assert.match(source, /parseApprovedPassiveTarget\(\s*"bet365"/);
  assert.match(source, /const NAVIGATION_TIMEOUT_MS = 20_000/);
  assert.match(source, /waitForPassiveReadiness\(page\)/);
  assert.match(source, /headless: false/);
  assert.match(source, /acceptDownloads: false/);
  assert.match(source, /serviceWorkers: "block"/);
  assert.match(source, /context\.routeWebSocket\("\*\*\/\*"/);
  assert.match(source, /resolveHostAddresses/);
  assert.match(source, /socketConnected: false/);
  assert.match(source, /authorizesPolicy: false/);
  assert.match(source, /BOOK-030 hostname observation failed safely; no hostname artifact was retained/);

  for (const forbidden of [
    "connectToServer",
    ".click(",
    ".fill(",
    ".type(",
    ".selectOption(",
    ".setInputFiles(",
    ".evaluate(",
    ".screenshot(",
    "recordVideo",
    "storageState",
    "BOOKMAKER_WEBSOCKET_RULES",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
