import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  BookmakerPagePort,
  ElementRef,
  SelectionActivationGate,
  SisalReadQuery,
} from "../src/contracts.ts";
import { SisalAdapter } from "../src/sisal.ts";

const EVENT: ElementRef = { id: "event-1" };
const MARKET: ElementRef = { id: "market-1" };
const OUTCOME: ElementRef = { id: "outcome-over" };

function selectionTarget(): SelectionTarget {
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
    market: {
      family: "total",
      context: "corners",
      line: "11.5",
      sourceLabel: "U/O CORNER 11.5",
    },
    outcome: { side: "over", sourceLabel: "OVER" },
    expectedOdds: "2.08",
    deepLink: "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/fixture",
    provenance: { notificationOptionId: "option-1", sourceOfferId: "offer-sisal-over" },
  };
}

test("cancellation racing an in-flight final activation never reports READY_FOR_USER", async () => {
  const controller = new AbortController();
  let gateCalls = 0;
  const attributes: Record<string, Record<string, string>> = {
    [EVENT.id]: {
      "data-event-participant-a": "Real Madrid",
      "data-event-participant-b": "Rayo Vallecano",
      "data-event-competition": "La Liga",
      "data-event-scheduled-at": "2026-09-12T19:05:00.000Z",
    },
    [MARKET.id]: {
      "data-market-family": "total",
      "data-market-context": "corners",
      "data-market-line": "11.50",
    },
    [OUTCOME.id]: {
      "data-outcome-side": "over",
      "data-odds": "2.08",
      "aria-pressed": "false",
    },
  };

  const page: BookmakerPagePort = {
    async openAllowed() {
      return { ok: true };
    },
    async currentLocation() {
      return {
        href: "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/fixture",
        origin: "https://www.sisal.it",
      };
    },
    async waitForPageReady() {
      return { ready: true };
    },
    async query(query: SisalReadQuery) {
      if (query.kind === "auth-wall") return [];
      if (query.kind === "event-candidate") return [EVENT];
      if (query.kind === "market-candidate") return [MARKET];
      return [OUTCOME];
    },
    async readText() {
      return "";
    },
    async readAttribute(ref, name) {
      return attributes[ref.id]?.[name] ?? null;
    },
    async isVisible() {
      return true;
    },
    async activateNavigationControl() {
      return { ok: true };
    },
  };

  const gate: SelectionActivationGate = {
    async activate(request) {
      gateCalls += 1;
      attributes[request.candidate.id]!["aria-pressed"] = "true";
      controller.abort();
      return { kind: "ACTIVATED", selection: { candidate: request.candidate } };
    },
  };

  const ctx: AdapterExecutionContext = {
    legId: "leg-1",
    attemptId: "attempt-1",
    evidenceEpoch: 7,
    browser: page,
    selectionGate: gate,
  };

  const result = await new SisalAdapter().prepare(ctx, selectionTarget(), {}, controller.signal);

  assert.equal(gateCalls, 1);
  assert.equal(result.kind, "FAILED_SAFE");
  if (result.kind === "FAILED_SAFE") {
    assert.equal(result.failure.code, "SELECTION_VERIFICATION_FAILED");
    assert.equal(result.failure.stage, "SELECTION_VERIFICATION");
    assert.equal(result.failure.activation, "ATTEMPTED_NOT_VERIFIED");
    assert.equal(result.failure.recoverability, "USER_REVIEW");
    assert.equal(result.failure.evidenceEpoch, 7);
  }
});
