import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  BookmakerPagePort,
  ElementRef,
  MatchingEvidenceSnapshot,
  ObservedOdds,
  SelectionActivationGate,
  SelectionActivationResult,
  SisalReadQuery,
} from "../src/contracts.ts";
import { SisalAdapter } from "../src/sisal.ts";

class RejectOnlyPage implements BookmakerPagePort {
  opened: string[] = [];

  async openAllowed(url: string) {
    this.opened.push(url);
    return { ok: true } as const;
  }

  async currentLocation() {
    return { href: "https://www.sisal.it/", origin: "https://www.sisal.it" };
  }

  async waitForPageReady() {
    return { ready: true } as const;
  }

  async query(_query: SisalReadQuery): Promise<readonly ElementRef[]> {
    return [];
  }

  async readText(_ref: ElementRef) {
    return "";
  }

  async readAttribute(_ref: ElementRef, _name: string) {
    return null;
  }

  async isVisible(_ref: ElementRef) {
    return false;
  }

  async activateNavigationControl() {
    return { ok: true } as const;
  }
}

class NeverActivateGate implements SelectionActivationGate {
  calls = 0;

  async activate(_request: {
    target: SelectionTarget;
    candidate: ElementRef;
    evidence: MatchingEvidenceSnapshot;
    odds: ObservedOdds;
    acknowledgedObservedOdds?: string;
  }): Promise<SelectionActivationResult> {
    this.calls += 1;
    throw new Error("selection activation must not be reachable for rejected navigation");
  }
}

function target(deepLink: string): SelectionTarget {
  return {
    id: "leg-sisal-security",
    bookmaker: "sisal",
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
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
    deepLink,
    provenance: {
      notificationOptionId: "option-1",
      sourceOfferId: "offer-sisal-over",
    },
  };
}

function context(page: BookmakerPagePort, selectionGate: SelectionActivationGate): AdapterExecutionContext {
  return {
    legId: "leg-1",
    attemptId: "attempt-1",
    evidenceEpoch: 1,
    browser: page,
    selectionGate,
  };
}

for (const deepLink of [
  "https://user@www.sisal.it/scommesse-matchpoint/sport/calcio",
  "https://user:secret@www.sisal.it/scommesse-matchpoint/sport/calcio",
]) {
  test(`rejects credential-bearing SISAL deep link before browser navigation: ${deepLink}`, async () => {
    const page = new RejectOnlyPage();
    const gate = new NeverActivateGate();
    const result = await new SisalAdapter().prepare(
      context(page, gate),
      target(deepLink),
      {},
      new AbortController().signal,
    );

    assert.equal(result.kind, "FAILED_SAFE");
    assert.equal(page.opened.length, 0);
    assert.equal(gate.calls, 0);
    if (result.kind === "FAILED_SAFE") {
      assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
      assert.equal(result.failure.stage, "NAVIGATION");
    }
  });
}
