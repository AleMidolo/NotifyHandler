import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  AutomaticExecutionOrchestrator,
  type BookmakerAutomationPort,
  type CancelLegRequest,
  type type LegExecutionRequest,
  type WorkerLegEvent,
} from "../../application/src/index.ts";
import { createWorkerExecutionPreflight } from "../../automation/src/index.ts";
import { DesktopAppController } from "../src/controller.ts";
import {
  hardenLocalIngressTokenPermissions,
  loadOrCreateLocalIngressToken,
  rotateLocalIngressToken,
  startDirectPairIngressServer,
  type DirectPairIngressServer,
} from "../src/http-ingress.ts";

const TOKEN = "T".repeat(43);
const NOW = new Date("2026-09-21T13:02:00.000Z");

function payload() {
  return {
    schemaVersion: "notifyhandler.direct-pair.v1",
    notificationId: "surebet-http-001",
    sentAt: "2026-09-21T13:00:00.000Z",
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-21T19:00:00+02:00",
    },
    market: {
      family: "total",
      context: "corners",
      period: "full_match",
      line: "11.5",
      sourceLabel: "U/O CORNER 11.5",
    },
    legs: [
      {
        bookmaker: "sisal",
        outcome: "over",
        expectedOdds: "2.90",
        deepLink: "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/real-rayo",
      },
      {
        bookmaker: "bet365",
        outcome: "under",
        expectedOdds: "1.61",
        deepLink: "https://www.bet365.it/#/AC/B1/C1/D100/Efixture/",
      },
    ],
  };
}

function event(request: LegExecutionRequest, state: WorkerLegEvent["state"]): WorkerLegEvent {
  return {
    legId: request.legId,
    attemptId: request.attemptId,
    evidenceEpoch: request.evidenceEpoch,
    state,
  };
}

class FakeAutomation implements BookmakerAutomationPort {
  readonly starts: LegExecutionRequest[] = [];
  readonly cancellations: CancelLegRequest[] = [];

  start(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent> {
    this.starts.push(request);
    return this.ready(request);
  }
  resumeAfterManualAuth(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent> { return this.ready(request); }
  retry(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent> { return this.ready(request); }
  reopen(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent> { return this.ready(request); }
  async cancel(request: CancelLegRequest): Promise<void> { this.cancellations.push(request); }

  private async *ready(request: LegExecutionRequest): AsyncIterable<WorkerLegEvent> {
    const states: WorkerLegEvent["state"][] = [
      "OPENING",
      "WAITING_FOR_PAGE",
      "MATCHING_EVENT",
      "MATCHING_MARKET",
      "MATCHING_LINE",
      "MATCHING_OUTCOME",
      "ACTIVATING_SELECTION",
      "VERIFYING_SELECTION",
      "SELECTION_PREPARED",
      "READY_FOR_USER",
    ];
    for (const state of states) yield event(request, state);
  }
}

async function fixture(
  resolveHostname: (hostname: string) => Promise<readonly string[]> = async () => ["93.184.216.34"],
  idempotencyFilePath?: string,
): Promise<{
  worker: FakeAutomation;
  controller: DesktopAppController;
  server: DirectPairIngressServer;
}> {
  const ownedStateDir = idempotencyFilePath === undefined
    ? mkdtempSync(join(tmpdir(), "notifyhandler-ingress-idempotency-"))
    : null;
  const statePath = idempotencyFilePath ?? join(ownedStateDir!, "state.json");
  const worker = new FakeAutomation();
  const orchestrator = new AutomaticExecutionOrchestrator(
    worker,
    createWorkerExecutionPreflight({ resolveHostname }),
    { now: () => new Date(NOW) },
  );
  const controller = new DesktopAppController(
    { orchestrator, async close() {} },
    { nowMs: () => NOW.getTime() },
  );

  try {
    const rawServer = await startDirectPairIngressServer({
      controller,
      token: TOKEN,
      idempotencyFilePath: statePath,
      port: 0,
      now: () => new Date(NOW),
      maxRequestsPerMinute: 100,
    });
    const server: DirectPairIngressServer = {
      ...rawServer,
      async close(): Promise<void> {
        try {
          await rawServer.close();
        } finally {
          if (ownedStateDir !== null) rmSync(ownedStateDir, { recursive: true, force: true });
        }
      },
    };
    return { worker, controller, server };
  } catch (error) {
    await controller.close();
    if (ownedStateDir !== null) rmSync(ownedStateDir, { recursive: true, force: true });
    throw error;
  }
}

async function postWithHost(server: DirectPairIngressServer, hostHeader: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: server.host,
      port: server.port,
      path: "/api/v1/notifications/direct-pair",
      method: "POST",
      headers: {
        Host: hostHeader,
        "Content-Type": "application/json",
        Authorization: "Bearer " + TOKEN,
      },
    }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });
    request.once("error", reject);
    request.end(JSON.stringify(payload()));
  });
}

async function post(
  server: DirectPairIngressServer,
  body: string,
  options: { token?: string; contentType?: string; origin?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": options.contentType ?? "application/json",
    Authorization: "Bearer " + (options.token ?? TOKEN),
  };
  if (options.origin !== undefined) headers.Origin = options.origin;
  return fetch(server.endpoint, { method: "POST", headers, body });
}

test("authenticated structured request converges on the existing two-leg automatic orchestrator", async () => {
  const { worker, controller, server } = await fixture();
  try {
    const response = await post(server, JSON.stringify(payload()));
    assert.equal(server.host, "127.0.0.1");
    assert.equal(response.status, 202);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.accepted, true);
    assert.equal(body.duplicate, false);
    assert.equal(body.notificationId, "surebet-http-001");
    assert.equal(typeof body.executionId, "string");
    assert.equal(worker.starts.length, 2);
    assert.deepEqual(worker.starts.map((request) => request.target.bookmaker), ["sisal", "bet365"]);
    assert.equal(worker.starts[0]?.target.deepLink, payload().legs[0].deepLink);
    assert.equal(worker.starts[1]?.target.deepLink, payload().legs[1].deepLink);
    await controller.runtime.orchestrator.waitForIdle();
    assert.equal(controller.getSnapshot().execution.status, "READY_FOR_USER");
    assert.equal(JSON.stringify(body).includes("www.sisal.it"), false);
    assert.equal(JSON.stringify(body).includes(TOKEN), false);
  } finally {
    await server.close();
    await controller.close();
  }
});

test("exact duplicate is idempotent while a changed payload with the same id conflicts", async () => {
  const { worker, controller, server } = await fixture();
  try {
    const first = await post(server, JSON.stringify(payload()));
    assert.equal(first.status, 202);
    const duplicate = await post(server, JSON.stringify(payload()));
    assert.equal(duplicate.status, 202);
    const duplicateBody = await duplicate.json() as Record<string, unknown>;
    assert.equal(duplicateBody.duplicate, true);
    assert.equal(worker.starts.length, 2);

    const changed = payload();
    changed.legs[0].expectedOdds = "3.00";
    const conflict = await post(server, JSON.stringify(changed));
    assert.equal(conflict.status, 409);
    assert.equal(worker.starts.length, 2);
  } finally {
    await server.close();
    await controller.close();
  }
});

test("durable idempotency blocks restart replay and same-id mutation without storing request secrets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "notifyhandler-ingress-restart-"));
  const stateFile = join(dir, "idempotency.json");
  let firstContext: Awaited<ReturnType<typeof fixture>> | null = null;
  let secondContext: Awaited<ReturnType<typeof fixture>> | null = null;
  try {
    firstContext = await fixture(undefined, stateFile);
    const first = await post(firstContext.server, JSON.stringify(payload()));
    assert.equal(first.status, 202);
    const firstBody = await first.json() as Record<string, unknown>;
    assert.equal(firstBody.accepted, true);
    assert.equal(firstContext.worker.starts.length, 2);
    await firstContext.server.close();
    await firstContext.controller.close();
    firstContext = null;

    const persisted = readFileSync(stateFile, "utf8");
    const parsed = JSON.parse(persisted) as {
      version: number;
      records: Array<Record<string, unknown>>;
    };
    assert.equal(parsed.version, 1);
    assert.equal(parsed.records.length, 1);
    assert.deepEqual(Object.keys(parsed.records[0] ?? {}).sort(), [
      "executionId",
      "notificationId",
      "payloadHash",
      "recordedAtMs",
      "state",
    ]);
    assert.equal(parsed.records[0]?.state, "accepted");
    assert.equal(persisted.includes(TOKEN), false);
    assert.equal(persisted.includes("www.sisal.it"), false);
    assert.equal(persisted.includes("www.bet365.it"), false);
    assert.equal(persisted.includes("Real Madrid"), false);
    if (process.platform !== "win32") {
      assert.equal(statSync(stateFile).mode & 0o777, 0o600);
    }

    secondContext = await fixture(undefined, stateFile);
    const replay = await post(secondContext.server, JSON.stringify(payload()));
    assert.equal(replay.status, 409);
    const replayBody = await replay.json() as {
      error?: { code?: unknown };
    };
    assert.equal(replayBody.error?.code, "IDEMPOTENCY_REPLAY_BLOCKED");
    assert.equal(secondContext.worker.starts.length, 0);

    const changed = payload();
    changed.legs[0].expectedOdds = "3.00";
    const conflict = await post(secondContext.server, JSON.stringify(changed));
    assert.equal(conflict.status, 409);
    const conflictBody = await conflict.json() as {
      error?: { code?: unknown };
    };
    assert.equal(conflictBody.error?.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(secondContext.worker.starts.length, 0);
  } finally {
    if (firstContext !== null) {
      await firstContext.server.close();
      await firstContext.controller.close();
    }
    if (secondContext !== null) {
      await secondContext.server.close();
      await secondContext.controller.close();
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("corrupt durable idempotency state fails closed before the listener starts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "notifyhandler-ingress-corrupt-"));
  const stateFile = join(dir, "idempotency.json");
  try {
    writeFileSync(stateFile, "{not-json", { encoding: "utf8", mode: 0o600 });
    await assert.rejects(
      fixture(undefined, stateFile),
      /idempotency state is corrupt JSON/u,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stale durable idempotency tombstones are evicted on startup", async () => {
  const dir = mkdtempSync(join(tmpdir(), "notifyhandler-ingress-stale-"));
  const stateFile = join(dir, "idempotency.json");
  let firstContext: Awaited<ReturnType<typeof fixture>> | null = null;
  let secondContext: Awaited<ReturnType<typeof fixture>> | null = null;
  try {
    firstContext = await fixture(undefined, stateFile);
    const first = await post(firstContext.server, JSON.stringify(payload()));
    assert.equal(first.status, 202);
    await firstContext.server.close();
    await firstContext.controller.close();
    firstContext = null;

    const state = JSON.parse(readFileSync(stateFile, "utf8")) as {
      version: number;
      records: Array<Record<string, unknown>>;
    };
    assert.equal(state.records.length, 1);
    state.records[0]!.recordedAtMs = 0;
    writeFileSync(stateFile, JSON.stringify(state) + "\n", { encoding: "utf8", mode: 0o600 });

    secondContext = await fixture(undefined, stateFile);
    const pruned = JSON.parse(readFileSync(stateFile, "utf8")) as {
      records: Array<Record<string, unknown>>;
    };
    assert.equal(pruned.records.length, 0);
    assert.equal(secondContext.worker.starts.length, 0);
  } finally {
    if (firstContext !== null) {
      await firstContext.server.close();
      await firstContext.controller.close();
    }
    if (secondContext !== null) {
      await secondContext.server.close();
      await secondContext.controller.close();
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("authentication, JSON/media bounds, and browser-origin policy fail before execution", async () => {
  const { worker, controller, server } = await fixture();
  try {
    const unauthorized = await post(server, "{not-json", { token: "X".repeat(43) });
    assert.equal(unauthorized.status, 401);

    const malformed = await post(server, "{not-json");
    assert.equal(malformed.status, 400);

    const unsupportedMedia = await post(server, JSON.stringify(payload()), { contentType: "text/plain" });
    assert.equal(unsupportedMedia.status, 415);

    const browserOrigin = await post(server, JSON.stringify(payload()), { origin: "https://example.com" });
    assert.equal(browserOrigin.status, 403);

    const invalidHost = await postWithHost(server, "localhost:" + server.port);
    assert.equal(invalidHost, 403);

    const oversized = await post(server, JSON.stringify({ value: "x".repeat(70_000) }));
    assert.equal(oversized.status, 413);
    assert.equal(worker.starts.length, 0);
  } finally {
    await server.close();
    await controller.close();
  }
});

test("same-bookmaker, unsupported-worker, and unsafe-link payloads produce zero navigation", async () => {
  const cases = [
    (() => {
      const value = payload();
      value.legs[1].bookmaker = "sisal";
      return value;
    })(),
    (() => {
      const value = payload();
      value.legs[1].bookmaker = "lottomatica";
      return value;
    })(),
    (() => {
      const value = payload();
      value.legs[0].deepLink = "https://evil.example/event";
      return value;
    })(),
    (() => {
      const value = payload();
      value.legs[0].deepLink = "https://user:secret@www.sisal.it/event";
      return value;
    })(),
  ];

  for (const body of cases) {
    const { worker, controller, server } = await fixture();
    try {
      const response = await post(server, JSON.stringify(body));
      assert.equal(response.status, 422);
      assert.equal(worker.starts.length, 0);
    } finally {
      await server.close();
      await controller.close();
    }
  }
});

test("legacy manual text input remains available alongside HTTP structured ingress", async () => {
  const worker = new FakeAutomation();
  const orchestrator = new AutomaticExecutionOrchestrator(
    worker,
    createWorkerExecutionPreflight(),
    {
      sourceUtcOffsetMinutes: 120,
      now: () => new Date("2026-09-11T18:30:00.000Z"),
    },
  );
  const controller = new DesktopAppController(
    { orchestrator, async close() {} },
    { nowMs: () => NOW.getTime() },
  );
  const text = [
    "Evento: Real Madrid - Rayo Vallecano",
    "Competizione: La Liga",
    "Data e Ora: 12/09/2026 - 21:00",
    "Mercato: U/O CORNER 11.5",
    "Esito OVER:",
    "- [SISAL](https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/fixture) @ 2.90",
    "Esito UNDER:",
    "- [BET365](https://www.bet365.it/#/AC/B1/C1/D100/Efixture/) @ 1.61",
    "Opzioni consigliate:",
    "- SISAL OVER 11.5 + BET365 UNDER 11.5",
  ].join("\n");
  try {
    await controller.receiveNotification(text);
    assert.equal(worker.starts.length, 2);
    assert.equal(orchestrator.getState().plan?.recommendedOptionId, "option-1");
  } finally {
    await controller.close();
  }
});


test("local ingress token is 256-bit base64url, stable across loads, and explicitly rotatable", () => {
  const dir = mkdtempSync(join(tmpdir(), "notifyhandler-ingress-token-"));
  const file = join(dir, "token");
  try {
    const first = loadOrCreateLocalIngressToken(file);
    const second = loadOrCreateLocalIngressToken(file);
    assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
    assert.equal(second, first);
    assert.equal(readFileSync(file, "utf8").trim(), first);

    if (process.platform !== "win32") {
      assert.equal(statSync(file).mode & 0o777, 0o600);
    }

    const rotated = rotateLocalIngressToken(file);
    assert.match(rotated, /^[A-Za-z0-9_-]{43}$/u);
    assert.notEqual(rotated, first);
    assert.equal(readFileSync(file, "utf8").trim(), rotated);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("private DNS answer fails structured ingress preflight with zero worker starts", async () => {
  const { worker, controller, server } = await fixture(async (hostname) =>
    hostname === "www.sisal.it" ? ["10.0.0.7"] : ["93.184.216.34"]
  );
  try {
    const response = await post(server, JSON.stringify(payload()));
    assert.equal(response.status, 422);
    assert.equal(worker.starts.length, 0);
  } finally {
    await server.close();
    await controller.close();
  }
});


test("Windows token hardening removes unrelated explicit ACEs", { skip: process.platform !== "win32" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "notifyhandler-ingress-acl-"));
  const file = join(dir, "token");
  try {
    loadOrCreateLocalIngressToken(file);

    const grant = spawnSync(
      "icacls",
      [file, "/grant", "*S-1-1-0:F"],
      { encoding: "utf8", windowsHide: true, shell: false },
    );
    assert.equal(grant.status, 0, grant.stderr || grant.stdout);

    hardenLocalIngressTokenPermissions(file);

    const inspect = spawnSync(
      "icacls",
      [file],
      { encoding: "utf8", windowsHide: true, shell: false },
    );
    assert.equal(inspect.status, 0, inspect.stderr || inspect.stdout);
    assert.equal(
      /(?:Everyone|S-1-1-0):\(F\)/iu.test(inspect.stdout),
      false,
      "current-user-only hardening must remove a pre-existing explicit Everyone ACE",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


function payloadV2Direct(notificationId = "surebet-http-v2-direct-001") {
  return {
    schemaVersion: "notifyhandler.direct-pair.v2",
    notificationId,
    sentAt: "2026-09-21T13:00:00.000Z",
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-21T19:00:00+02:00",
    },
    market: {
      family: "total",
      context: "corners",
      period: "full_match",
      line: "11.5",
      sourceLabel: "U/O CORNER 11.5",
    },
    legs: [
      {
        bookmaker: "sisal",
        outcome: "over",
        expectedOdds: "2.90",
        navigation: {
          kind: "bookmaker-direct",
          url: "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/real-rayo",
        },
      },
      {
        bookmaker: "bet365",
        outcome: "under",
        expectedOdds: "1.61",
        navigation: {
          kind: "bookmaker-direct",
          url: "https://www.bet365.it/#/AC/B1/C1/D100/Efixture/",
        },
      },
    ],
  };
}

function payloadV2Relay(notificationId = "surebet-http-v2-relay-001") {
  const value = payloadV2Direct(notificationId);
  const signal = "11111111-2222-4333-8444-555555555555";
  value.legs[0].navigation = {
    kind: "betup-relay",
    url: "https://www.bet-up.it/lnk/" + signal + "/sisal",
  };
  value.legs[1].navigation = {
    kind: "betup-relay",
    url: "https://www.bet-up.it/lnk/" + signal + "/bet365",
  };
  return value;
}

test("HTTP ingress accepts v2 typed direct candidates through the existing automatic path", async () => {
  const { worker, controller, server } = await fixture();
  try {
    const response = await post(server, JSON.stringify(payloadV2Direct()));
    assert.equal(response.status, 202);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.accepted, true);
    assert.equal(worker.starts.length, 2);
    assert.deepEqual(worker.starts.map((request) => request.target.navigation?.kind), [
      "BOOKMAKER_DIRECT",
      "BOOKMAKER_DIRECT",
    ]);
    assert.equal(worker.starts[0]?.target.deepLink, undefined);
    assert.equal(worker.starts[1]?.target.deepLink, undefined);
  } finally {
    await server.close();
    await controller.close();
  }
});

test("HTTP ingress accepts relay schema and forwards typed relay targets to the worker", async () => {
  const { worker, controller, server } = await fixture();
  try {
    const response = await post(server, JSON.stringify(payloadV2Relay()));
    assert.equal(response.status, 202);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.accepted, true);
    assert.equal(worker.starts.length, 2);
    assert.deepEqual(worker.starts.map((request) => request.target.navigation?.kind), [
      "BETUP_RELAY",
      "BETUP_RELAY",
    ]);
    assert.equal(worker.starts[0]?.target.deepLink, undefined);
    assert.equal(worker.starts[1]?.target.deepLink, undefined);
  } finally {
    await server.close();
    await controller.close();
  }
});

test("idempotency namespace is shared across v1 and v2 schema versions", async () => {
  const { worker, controller, server } = await fixture();
  try {
    const first = payload();
    first.notificationId = "cross-schema-id";
    const accepted = await post(server, JSON.stringify(first));
    assert.equal(accepted.status, 202);
    assert.equal(worker.starts.length, 2);

    const v2 = payloadV2Direct("cross-schema-id");
    const conflict = await post(server, JSON.stringify(v2));
    assert.equal(conflict.status, 409);
    const body = await conflict.json() as { error?: { code?: unknown } };
    assert.equal(body.error?.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(worker.starts.length, 2);
  } finally {
    await server.close();
    await controller.close();
  }
});

test("malformed v2 relay fails before worker start and never falls back to v1", async () => {
  const { worker, controller, server } = await fixture();
  try {
    const value = payloadV2Relay("bad-v2-relay");
    value.legs[0].navigation.url += "?unexpected=1";
    const response = await post(server, JSON.stringify(value));
    assert.equal(response.status, 422);
    assert.equal(worker.starts.length, 0);
  } finally {
    await server.close();
    await controller.close();
  }
});
