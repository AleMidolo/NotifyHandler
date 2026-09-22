import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionPlan, SelectionTarget } from "../../domain/src/index.ts";
import type { Page } from "playwright-core";
import { domMappingFor } from "../src/dom-mapping.ts";
import { NavigationPolicy } from "../src/navigation-policy.ts";
import { createWorkerPageRuntime } from "../src/page-runtime.ts";
import { createWorkerExecutionPreflight } from "../src/worker-port.ts";

function target(
  bookmaker: "sisal" | "bet365",
  legIndex: 0 | 1,
  deepLink: string,
): SelectionTarget {
  return {
    id: `target-${bookmaker}`,
    bookmaker,
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-21T17:00:00.000Z",
      sourceDisplay: "Real Madrid - Rayo Vallecano",
    },
    market: { family: "total", context: "corners", period: "full_match", line: "11.5", sourceLabel: "U/O CORNER 11.5" },
    outcome: { side: legIndex === 0 ? "over" : "under", sourceLabel: legIndex === 0 ? "OVER" : "UNDER" },
    expectedOdds: legIndex === 0 ? "2.90" : "1.61",
    deepLink,
    provenance: {
      kind: "structured-direct-pair",
      schemaVersion: "notifyhandler.direct-pair.v1",
      notificationId: "security-dns-001",
      legIndex,
    },
  };
}

function plan(): ExecutionPlan {
  return {
    id: "plan-security-dns",
    notificationId: "security-dns-001",
    recommendedOptionId: "structured-direct-pair",
    createdAt: "2026-09-21T17:00:00.000Z",
    legs: [
      { id: "leg-sisal", target: target("sisal", 0, "https://www.sisal.it/event") },
      { id: "leg-bet365", target: target("bet365", 1, "https://www.bet365.it/event") },
    ],
  };
}

test("structured preflight rejects a direct link when approved hostname resolves private", async () => {
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async (hostname) => hostname === "www.sisal.it" ? ["127.0.0.1"] : ["93.184.216.34"],
  }).validate(plan());

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
    assert.equal(result.failure.legId, "leg-sisal");
  }
});

test("structured preflight accepts exact origins when every resolved address is public", async () => {
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => ["93.184.216.34"],
  }).validate(plan());
  assert.deepEqual(result, { ok: true });
});

test("structured preflight rejects a non-full-match period before browser dispatch", async () => {
  const value = plan();
  const first = value.legs[0];
  const invalid: ExecutionPlan = {
    ...value,
    legs: [
      {
        ...first,
        target: {
          ...first.target,
          market: {
            ...first.target.market,
            period: "first_half" as never,
          },
        },
      },
      value.legs[1],
    ],
  };

  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => ["93.184.216.34"],
  }).validate(invalid);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.code, "INVALID_SELECTION_TARGET");
    assert.equal(result.failure.legId, "leg-sisal");
  }
});

test("structured preflight fails closed on DNS resolution failure", async () => {
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => { throw new Error("resolver unavailable"); },
  }).validate(plan());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
});


test("browser gateway rejects private DNS before Playwright navigation", async () => {
  let gotoCalls = 0;
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const fakePage = {
    async route() {},
    async routeWebSocket() {},
    on(name: string, handler: (...args: unknown[]) => void) { handlers.set(name, handler); return fakePage; },
    isClosed() { return false; },
    async goto() { gotoCalls += 1; },
    url() { return "about:blank"; },
  } as unknown as Page;

  const policy = new NavigationPolicy(["https://www.sisal.it"], async () => ["192.168.1.20"]);
  const runtime = await createWorkerPageRuntime({
    page: fakePage,
    policy,
    mapping: domMappingFor("sisal"),
  });

  assert.deepEqual(await runtime.port.openAllowed("https://www.sisal.it/event"), { ok: false });
  assert.equal(gotoCalls, 0);
});


function v2Target(
  bookmaker: "sisal" | "bet365",
  legIndex: 0 | 1,
  navigation: SelectionTarget["navigation"],
): SelectionTarget {
  return {
    id: "v2-target-" + bookmaker,
    bookmaker,
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-21T17:00:00.000Z",
      sourceDisplay: "Real Madrid - Rayo Vallecano",
    },
    market: { family: "total", context: "corners", period: "full_match", line: "11.5", sourceLabel: "U/O CORNER 11.5" },
    outcome: { side: legIndex === 0 ? "over" : "under" },
    expectedOdds: legIndex === 0 ? "2.90" : "1.61",
    ...(navigation === undefined ? {} : { navigation }),
    provenance: {
      kind: "structured-direct-pair",
      schemaVersion: "notifyhandler.direct-pair.v2",
      notificationId: "security-v2-001",
      legIndex,
    },
  };
}

test("v2 direct navigation uses the same resolved-origin preflight without deepLink projection", async () => {
  const value: ExecutionPlan = {
    id: "plan-v2-direct",
    notificationId: "security-v2-001",
    recommendedOptionId: "direct-pair-v2",
    createdAt: "2026-09-22T12:00:00.000Z",
    legs: [
      { id: "leg-sisal", target: v2Target("sisal", 0, { kind: "BOOKMAKER_DIRECT", url: "https://www.sisal.it/event" }) },
      { id: "leg-bet365", target: v2Target("bet365", 1, { kind: "BOOKMAKER_DIRECT", url: "https://www.bet365.it/event" }) },
    ],
  };
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => ["93.184.216.34"],
  }).validate(value);
  assert.deepEqual(result, { ok: true });
  assert.equal(value.legs[0].target.deepLink, undefined);
});

function relayPlan(signalId = "11111111-2222-4333-8444-555555555555"): ExecutionPlan {
  return {
    id: "plan-v2-relay",
    notificationId: "security-v2-relay-001",
    recommendedOptionId: "direct-pair-v2",
    createdAt: "2026-09-22T12:00:00.000Z",
    legs: [
      {
        id: "leg-sisal",
        target: v2Target("sisal", 0, {
          kind: "BETUP_RELAY",
          url: "https://www.bet-up.it/lnk/" + signalId + "/sisal",
          signalId,
          bookmaker: "sisal",
        }),
      },
      {
        id: "leg-bet365",
        target: v2Target("bet365", 1, {
          kind: "BETUP_RELAY",
          url: "https://www.bet-up.it/lnk/" + signalId + "/bet365",
          signalId,
          bookmaker: "bet365",
        }),
      },
    ],
  };
}

test("v2 relay navigation passes worker preflight when relay DNS is public", async () => {
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => ["93.184.216.34"],
  }).validate(relayPlan());
  assert.deepEqual(result, { ok: true });
});

test("v2 relay preflight fails closed when bet-up DNS resolves private", async () => {
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async (hostname) => hostname === "www.bet-up.it" ? ["127.0.0.1"] : ["93.184.216.34"],
  }).validate(relayPlan());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
    assert.equal(result.failure.legId, "leg-sisal");
  }
});

test("v2 relay preflight revalidates suffix/bookmaker binding", async () => {
  const value = relayPlan();
  const first = value.legs[0].target;
  const navigation = first.navigation;
  assert.equal(navigation?.kind, "BETUP_RELAY");
  if (navigation?.kind !== "BETUP_RELAY") return;
  const invalid: ExecutionPlan = {
    ...value,
    legs: [
      {
        ...value.legs[0],
        target: {
          ...first,
          navigation: { ...navigation, url: navigation.url.replace(/\/sisal$/u, "/bet365") },
        },
      },
      value.legs[1],
    ],
  };
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => ["93.184.216.34"],
  }).validate(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
});

test("v2 relay preflight rejects mixed signal identifiers across the pair", async () => {
  const value = relayPlan();
  const second = value.legs[1].target;
  const navigation = second.navigation;
  assert.equal(navigation?.kind, "BETUP_RELAY");
  if (navigation?.kind !== "BETUP_RELAY") return;
  const otherSignal = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const invalid: ExecutionPlan = {
    ...value,
    legs: [
      value.legs[0],
      {
        ...value.legs[1],
        target: {
          ...second,
          navigation: {
            ...navigation,
            signalId: otherSignal,
            url: "https://www.bet-up.it/lnk/" + otherSignal + "/bet365",
          },
        },
      },
    ],
  };
  const result = await createWorkerExecutionPreflight({
    resolveHostname: async () => ["93.184.216.34"],
  }).validate(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.code, "CONTRACT_VIOLATION");
});
