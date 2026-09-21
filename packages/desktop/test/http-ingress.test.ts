import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  AutomaticExecutionOrchestrator,
  type BookmakerAutomationPort,
  type CancelLegRequest,
  type ContinueOddsRequest,
  type LegExecutionRequest,
  type WorkerLegEvent,
} from "../../application/src/index.ts";
import { createWorkerExecutionPreflight } from "../../automation/src/index.ts";
import { DesktopAppController } from "../src/controller.ts";
import {
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
  continueWithObservedOdds(request: ContinueOddsRequest): AsyncIterable<WorkerLegEvent> { return this.ready(request); }
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
      "VERIFYING_ODDS",
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
): Promise<{
  worker: FakeAutomation;
  controller: DesktopAppController;
  server: DirectPairIngressServer;
}> {
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
  const server = await startDirectPairIngressServer({
    controller,
    token: TOKEN,
    port: 0,
    now: () => new Date(NOW),
    maxRequestsPerMinute: 100,
  });
  return { worker, controller, server };
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
