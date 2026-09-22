import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/index.ts";
import type { WorkerPortEvent, WorkerExecutionRequest, SessionLauncher } from "../src/worker-port.ts";
import { createBookmakerAutomationWorker } from "../src/worker-port.ts";
import {
  createFixtureAutomationWorker,
  launchFixtureLegSession,
  type FixtureDocuments,
} from "../src/test-support.ts";
import type { BookmakerLegSession } from "../src/session.ts";

type Bookmaker = "sisal" | "bet365";
const SIGNAL_ID = "11111111-2222-4333-8444-555555555555";
const RELAY_ORIGIN = "https://www.bet-up.it";

function relayUrl(bookmaker: Bookmaker): string {
  return `${RELAY_ORIGIN}/lnk/${SIGNAL_ID}/${bookmaker}`;
}

function finalUrl(bookmaker: Bookmaker, suffix = "event"): string {
  const origin = bookmaker === "sisal" ? "https://www.sisal.it" : "https://www.bet365.it";
  return `${origin}/__notifyhandler_fixture/relay-${suffix}`;
}

function fixtureHtml(
  bookmaker: Bookmaker,
  side: "over" | "under",
  odds: string,
  options: Readonly<{ participantB?: string; auth?: boolean }> = {},
): string {
  const role = `data-nh-${bookmaker}-role`;
  if (options.auth) return `<!doctype html><html><body><div ${role}="auth">Manual bookmaker login</div></body></html>`;
  const participantB = options.participantB ?? "Rayo Vallecano";
  return `<!doctype html><html><body>
    <section ${role}="event"
      data-event-participant-a="Real Madrid"
      data-event-participant-b="${participantB}"
      data-event-competition="La Liga"
      data-event-scheduled-at="2026-09-12T19:05:00.000Z">
      <div ${role}="market"
        data-market-family="total"
        data-market-context="corners"
        data-market-period="full_match"
        data-market-line="11.5">
        <button ${role}="outcome"
          data-outcome-side="${side}"
          data-odds="${odds}"
          aria-pressed="false"
          onclick="this.setAttribute('aria-pressed','true')">${side.toUpperCase()}</button>
      </div>
    </section>
  </body></html>`;
}

function target(bookmaker: Bookmaker): SelectionTarget {
  const side = bookmaker === "sisal" ? "over" : "under";
  return {
    id: `target-${bookmaker}`,
    bookmaker,
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-12T19:00:00.000Z",
      sourceDisplay: "Real Madrid - Rayo Vallecano",
    },
    market: {
      family: "total",
      context: "corners",
      period: "full_match",
      line: "11.5",
      sourceLabel: "U/O CORNER 11.5",
    },
    outcome: { side, sourceLabel: side.toUpperCase() },
    expectedOdds: bookmaker === "sisal" ? "2.08" : "1.95",
    navigation: {
      kind: "BETUP_RELAY",
      url: relayUrl(bookmaker),
      signalId: SIGNAL_ID,
      bookmaker,
    },
    provenance: {
      kind: "structured-direct-pair",
      schemaVersion: "notifyhandler.direct-pair.v2",
      notificationId: "relay-test",
      legIndex: bookmaker === "sisal" ? 0 : 1,
    },
  };
}

function request(bookmaker: Bookmaker, attemptId = "attempt-1"): WorkerExecutionRequest {
  return {
    legId: `leg-${bookmaker}`,
    attemptId,
    evidenceEpoch: 1,
    target: target(bookmaker),
  };
}

async function events(iterable: AsyncIterable<WorkerPortEvent>): Promise<WorkerPortEvent[]> {
  const result: WorkerPortEvent[] = [];
  for await (const item of iterable) result.push(item);
  return result;
}

function terminal(items: readonly WorkerPortEvent[]): WorkerPortEvent {
  const last = items.at(-1);
  assert.ok(last, "Expected at least one worker event.");
  return last;
}

function validFixtures(bookmaker: Bookmaker): FixtureDocuments {
  const side = bookmaker === "sisal" ? "over" : "under";
  const odds = bookmaker === "sisal" ? "2.08" : "1.95";
  const destination = finalUrl(bookmaker);
  return {
    [relayUrl(bookmaker)]: { kind: "redirect", location: destination },
    [destination]: { kind: "html", body: fixtureHtml(bookmaker, side, odds) },
  };
}

for (const bookmaker of ["sisal", "bet365"] as const) {
  test(`${bookmaker}: valid bet-up relay resolves to expected bookmaker and reaches READY_FOR_USER`, async () => {
    const worker = createFixtureAutomationWorker({
      fixtures: { [bookmaker]: validFixtures(bookmaker) },
      navigationTimeoutMs: 1_000,
      relayResolutionTimeoutMs: 100,
    });
    try {
      const result = await events(worker.start(request(bookmaker)));
      assert.equal(terminal(result).state, "READY_FOR_USER");
      assert.equal(result.some((item) => item.failure?.code?.startsWith("RELAY_")), false);
    } finally {
      await worker.closeAll();
    }
  });
}

test("relay metadata cannot satisfy event identity after correct SISAL arrival", async () => {
  const destination = finalUrl("sisal", "wrong-event");
  const worker = createFixtureAutomationWorker({
    fixtures: {
      sisal: {
        [relayUrl("sisal")]: { kind: "redirect", location: destination },
        [destination]: {
          kind: "html",
          body: fixtureHtml("sisal", "over", "2.08", { participantB: "Rayo Majadahonda" }),
        },
      },
    },
    relayResolutionTimeoutMs: 100,
  });
  try {
    const result = await events(worker.start(request("sisal")));
    const last = terminal(result);
    assert.equal(last.state, "FAILED_SAFE");
    assert.equal(last.failure?.code, "EVENT_MISMATCH");
  } finally {
    await worker.closeAll();
  }
});

test("unexpected third-party relay intermediary is blocked before matching", async () => {
  const worker = createFixtureAutomationWorker({
    fixtures: {
      sisal: {
        [relayUrl("sisal")]: { kind: "redirect", location: "https://tracker.example/intermediate" },
      },
    },
    relayResolutionTimeoutMs: 50,
  });
  try {
    const last = terminal(await events(worker.start(request("sisal"))));
    assert.equal(last.state, "FAILED_SAFE");
    assert.equal(last.failure?.code, "RELAY_INTERMEDIARY_BLOCKED");
    assert.equal(last.failure?.activation, "NOT_ATTEMPTED");
  } finally {
    await worker.closeAll();
  }
});

test("relay resolving to another registered bookmaker fails as wrong final bookmaker", async () => {
  const worker = createFixtureAutomationWorker({
    fixtures: {
      sisal: {
        [relayUrl("sisal")]: { kind: "redirect", location: finalUrl("bet365", "wrong-bookmaker") },
      },
    },
    relayResolutionTimeoutMs: 50,
  });
  try {
    const last = terminal(await events(worker.start(request("sisal"))));
    assert.equal(last.state, "FAILED_SAFE");
    assert.equal(last.failure?.code, "RELAY_WRONG_FINAL_BOOKMAKER");
  } finally {
    await worker.closeAll();
  }
});

test("relay revisit exceeds the one-transition budget", async () => {
  const relay = relayUrl("sisal");
  const worker = createFixtureAutomationWorker({
    fixtures: {
      sisal: {
        [relay]: { kind: "redirect", location: relay },
      },
    },
    relayResolutionTimeoutMs: 50,
  });
  try {
    const last = terminal(await events(worker.start(request("sisal"))));
    assert.equal(last.state, "FAILED_SAFE");
    assert.equal(last.failure?.code, "RELAY_REDIRECT_LIMIT");
  } finally {
    await worker.closeAll();
  }
});

test("relay-origin challenge is a relay safe failure, not AUTH_REQUIRED", async () => {
  const worker = createFixtureAutomationWorker({
    fixtures: {
      sisal: {
        [relayUrl("sisal")]: {
          kind: "html",
          body: '<!doctype html><html><body><input type="password" data-nh-relay-challenge></body></html>',
        },
      },
    },
    relayResolutionTimeoutMs: 25,
  });
  try {
    const last = terminal(await events(worker.start(request("sisal"))));
    assert.equal(last.state, "FAILED_SAFE");
    assert.equal(last.failure?.code, "RELAY_CHALLENGE_UNSUPPORTED");
  } finally {
    await worker.closeAll();
  }
});

test("private final-bookmaker DNS is rejected during relay transition", async () => {
  const destination = finalUrl("sisal", "private-dns");
  const worker = createFixtureAutomationWorker({
    fixtures: {
      sisal: {
        [relayUrl("sisal")]: { kind: "redirect", location: destination },
        [destination]: { kind: "html", body: fixtureHtml("sisal", "over", "2.08") },
      },
    },
    resolveHostname: async (hostname) => hostname === "www.sisal.it" ? ["127.0.0.1"] : ["93.184.216.34"],
    relayResolutionTimeoutMs: 50,
  });
  try {
    const last = terminal(await events(worker.start(request("sisal"))));
    assert.equal(last.state, "FAILED_SAFE");
    assert.equal(last.failure?.code, "RELAY_NETWORK_TARGET_BLOCKED");
  } finally {
    await worker.closeAll();
  }
});

test("retry re-resolves the immutable relay instead of trusting the previous final URL", async () => {
  const relay = relayUrl("sisal");
  const wrong = finalUrl("sisal", "retry-wrong");
  const correct = finalUrl("sisal", "retry-correct");
  const worker = createFixtureAutomationWorker({
    fixtures: {
      sisal: {
        [relay]: [
          { kind: "redirect", location: wrong },
          { kind: "redirect", location: correct },
        ],
        [wrong]: {
          kind: "html",
          body: fixtureHtml("sisal", "over", "2.08", { participantB: "Rayo Majadahonda" }),
        },
        [correct]: { kind: "html", body: fixtureHtml("sisal", "over", "2.08") },
      },
    },
    relayResolutionTimeoutMs: 100,
  });
  try {
    const first = terminal(await events(worker.start(request("sisal", "attempt-1"))));
    assert.equal(first.state, "FAILED_SAFE");
    assert.equal(first.failure?.code, "EVENT_MISMATCH");

    const retried = terminal(await events(worker.retry(request("sisal", "attempt-2"))));
    assert.equal(retried.state, "READY_FOR_USER");
  } finally {
    await worker.closeAll();
  }
});

test("manual bookmaker auth resume does not revisit the relay origin", async () => {
  const relay = relayUrl("sisal");
  const destination = finalUrl("sisal", "auth");
  const worker = createFixtureAutomationWorker({
    fixtures: {
      sisal: {
        [relay]: [
          { kind: "redirect", location: destination },
          { kind: "redirect", location: finalUrl("bet365", "must-not-be-used") },
        ],
        [destination]: [
          { kind: "html", body: fixtureHtml("sisal", "over", "2.08", { auth: true }) },
          { kind: "html", body: fixtureHtml("sisal", "over", "2.08", { auth: true }) },
          { kind: "html", body: fixtureHtml("sisal", "over", "2.08") },
        ],
      },
    },
    relayResolutionTimeoutMs: 100,
  });
  try {
    const first = terminal(await events(worker.start(request("sisal", "attempt-auth"))));
    assert.equal(first.state, "AUTH_REQUIRED");

    const resumed = terminal(await events(worker.resumeAfterManualAuth(request("sisal", "attempt-auth"))));
    assert.equal(resumed.state, "READY_FOR_USER");
  } finally {
    await worker.closeAll();
  }
});

test("successful relay resolution revokes later relay-origin navigation from attempt capabilities", async () => {
  const session = await launchFixtureLegSession({
    bookmaker: "sisal",
    fixtures: validFixtures("sisal"),
    resolveHostname: async () => ["93.184.216.34"],
  });
  try {
    const resolution = await session.resolveRelay({
      relayUrl: relayUrl("sisal"),
      timeoutMs: 100,
      signal: new AbortController().signal,
    });
    assert.equal(resolution.kind, "RESOLVED");

    const caps = session.createAttemptCapabilities(3, new AbortController().signal);
    assert.deepEqual(await caps.browser.openAllowed(relayUrl("sisal")), { ok: false });
  } finally {
    await session.close();
  }
});

test("cancellation during relay resolution prevents matching and activation", async () => {
  let enteredResolve!: () => void;
  const entered = new Promise<void>((resolve) => { enteredResolve = resolve; });
  let cancelled = false;

  const fakeSession: BookmakerLegSession = {
    bookmaker: "sisal",
    sessionId: "relay-cancel-session",
    async resolveRelay({ signal }) {
      enteredResolve();
      await new Promise<void>((resolve) => {
        if (signal?.aborted) return resolve();
        signal?.addEventListener("abort", () => resolve(), { once: true });
      });
      return { kind: "FAILED", code: "RELAY_UNRESOLVED", message: "cancelled" };
    },
    createAttemptCapabilities() {
      throw new Error("matching capabilities must not be created after relay cancellation");
    },
    async cancel() { cancelled = true; },
    async close() { cancelled = true; },
  };
  const launcher: SessionLauncher = async () => fakeSession;
  const worker = createBookmakerAutomationWorker({
    sessionLauncher: launcher,
    resolveHostname: async () => ["93.184.216.34"],
  });
  try {
    const pending = events(worker.start(request("sisal", "attempt-cancel")));
    await entered;
    await worker.cancel({ legId: "leg-sisal", attemptId: "attempt-cancel" });
    const result = await pending;
    assert.equal(result.some((item) => item.state === "READY_FOR_USER"), false);
    assert.equal(result.some((item) => item.state === "CANCELLED"), true);
    assert.equal(cancelled, true);
  } finally {
    await worker.closeAll();
  }
});
