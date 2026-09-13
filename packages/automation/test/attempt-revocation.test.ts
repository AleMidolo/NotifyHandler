import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  ElementRef,
  MatchingEvidenceSnapshot,
  ObservedOdds,
} from "../../bookmakers/src/contracts.ts";
import { SisalAdapter } from "../../bookmakers/src/sisal.ts";
import { launchFixtureLegSession } from "../src/test-support.ts";

const URL = "https://www.sisal.it/__notifyhandler_fixture/revocation";

function html(): string {
  return `<!doctype html><html><body>
    <section data-nh-sisal-role="event"
      data-event-participant-a="Real Madrid"
      data-event-participant-b="Rayo Vallecano"
      data-event-competition="La Liga"
      data-event-scheduled-at="2026-09-12T19:05:00.000Z">
      <div data-nh-sisal-role="market"
        data-market-family="total"
        data-market-context="corners"
        data-market-line="11.5">
        <button data-nh-sisal-role="outcome"
          data-outcome-side="over"
          data-odds="2.08"
          aria-pressed="false"
          onclick="this.setAttribute('aria-pressed','true')">OVER</button>
      </div>
    </section>
  </body></html>`;
}

function target(): SelectionTarget {
  return {
    id: "leg-sisal",
    bookmaker: "sisal",
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-12T19:00:00.000Z",
      sourceDisplay: "Real Madrid - Rayo Vallecano",
    },
    market: { family: "total", context: "corners", line: "11.5", sourceLabel: "U/O CORNER 11.5" },
    outcome: { side: "over", sourceLabel: "OVER" },
    expectedOdds: "2.08",
    deepLink: URL,
    provenance: { notificationOptionId: "option-1", sourceOfferId: "offer-sisal" },
  };
}

function evidence(epoch: number, candidate: ElementRef): MatchingEvidenceSnapshot {
  return {
    evidenceEpoch: epoch,
    origin: { status: "MATCHED", reasonCode: "TEST" },
    event: {
      participants: { status: "MATCHED", reasonCode: "TEST" },
      competition: { status: "MATCHED", reasonCode: "TEST" },
      scheduledTime: { status: "MATCHED", reasonCode: "TEST" },
      overall: { status: "MATCHED", reasonCode: "TEST" },
    },
    market: { status: "MATCHED", reasonCode: "TEST" },
    line: { status: "MATCHED", reasonCode: "TEST" },
    outcome: { status: "MATCHED", reasonCode: "TEST", normalizedObserved: [candidate.id] },
  };
}

const odds: ObservedOdds = { expected: "2.08", observed: "2.08", comparison: "EQUAL" };

async function outcomeRef(browser: AdapterExecutionContext["browser"]): Promise<ElementRef> {
  const events = await browser.query({ kind: "event-candidate" });
  assert.equal(events.length, 1);
  const markets = await browser.query({ kind: "market-candidate", within: events[0]! });
  assert.equal(markets.length, 1);
  const outcomes = await browser.query({ kind: "outcome-candidate", within: markets[0]! });
  assert.equal(outcomes.length, 1);
  return outcomes[0]!;
}

async function openAttempt(browser: AdapterExecutionContext["browser"]): Promise<ElementRef> {
  assert.equal((await browser.openAllowed(URL)).ok, true);
  assert.equal((await browser.waitForPageReady({ timeoutMs: 2_000 })).ready, true);
  return outcomeRef(browser);
}

test("superseded attempt gate is rejected and cannot mutate selected state", async () => {
  const session = await launchFixtureLegSession({ bookmaker: "sisal", fixtures: { [URL]: { kind: "html", body: html() } } });
  try {
    const attemptA = session.createAttemptCapabilities(1, new AbortController().signal);
    const oldOutcome = await openAttempt(attemptA.browser);
    const attemptB = session.createAttemptCapabilities(2, new AbortController().signal);

    const activation = await attemptA.selectionGate.activate({
      target: target(),
      candidate: oldOutcome,
      evidence: evidence(1, oldOutcome),
      odds,
    });
    assert.deepEqual(activation, { kind: "REJECTED", reasonCode: "ATTEMPT_SUPERSEDED" });

    const currentOutcome = await outcomeRef(attemptB.browser);
    assert.equal(await attemptB.browser.readAttribute(currentOutcome, "aria-pressed"), "false");
  } finally {
    await session.close();
  }
});

test("superseded page capability fails closed against the replacement attempt page", async () => {
  const session = await launchFixtureLegSession({ bookmaker: "sisal", fixtures: { [URL]: { kind: "html", body: html() } } });
  try {
    const attemptA = session.createAttemptCapabilities(3, new AbortController().signal);
    const oldOutcome = await openAttempt(attemptA.browser);
    const attemptB = session.createAttemptCapabilities(4, new AbortController().signal);

    assert.deepEqual(await attemptA.browser.query({ kind: "event-candidate" }), []);
    assert.equal(await attemptA.browser.readAttribute(oldOutcome, "data-odds"), null);
    assert.equal((await attemptA.browser.openAllowed(URL)).ok, false);
    assert.equal((await attemptA.browser.activateNavigationControl({ ref: oldOutcome, purpose: "DISCLOSE_MARKET" })).ok, false);

    const currentOutcome = await outcomeRef(attemptB.browser);
    assert.equal(await attemptB.browser.readAttribute(currentOutcome, "data-odds"), "2.08");
  } finally {
    await session.close();
  }
});

test("fresh replacement attempt still completes after prior capabilities are revoked", async () => {
  const session = await launchFixtureLegSession({ bookmaker: "sisal", fixtures: { [URL]: { kind: "html", body: html() } } });
  try {
    const attemptA = session.createAttemptCapabilities(5, new AbortController().signal);
    await openAttempt(attemptA.browser);

    const signal = new AbortController().signal;
    const attemptB = session.createAttemptCapabilities(6, signal);
    const ctx: AdapterExecutionContext = {
      legId: "leg-sisal",
      attemptId: "attempt-6",
      evidenceEpoch: 6,
      browser: attemptB.browser,
      selectionGate: attemptB.selectionGate,
    };
    const result = await new SisalAdapter().prepare(ctx, target(), {}, signal);
    assert.equal(result.kind, "READY_FOR_USER");
  } finally {
    await session.close();
  }
});

test("cancelled attempt cannot activate after a replacement attempt starts", async () => {
  const session = await launchFixtureLegSession({ bookmaker: "sisal", fixtures: { [URL]: { kind: "html", body: html() } } });
  try {
    const controllerA = new AbortController();
    const attemptA = session.createAttemptCapabilities(7, controllerA.signal);
    const oldOutcome = await openAttempt(attemptA.browser);
    controllerA.abort();

    const attemptB = session.createAttemptCapabilities(8, new AbortController().signal);
    const activation = await attemptA.selectionGate.activate({
      target: target(),
      candidate: oldOutcome,
      evidence: evidence(7, oldOutcome),
      odds,
    });
    assert.deepEqual(activation, { kind: "REJECTED", reasonCode: "ATTEMPT_SUPERSEDED" });

    const currentOutcome = await outcomeRef(attemptB.browser);
    assert.equal(await attemptB.browser.readAttribute(currentOutcome, "aria-pressed"), "false");
  } finally {
    await session.close();
  }
});
