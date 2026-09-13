import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  BookmakerAdapter,
  BookmakerPagePort,
  BookmakerReadQuery,
  ElementRef,
  MatchingEvidenceSnapshot,
  ObservedOdds,
  SelectionActivationGate,
  SelectionActivationResult,
} from "../src/contracts.ts";
import { Bet365Adapter } from "../src/bet365.ts";
import { SisalAdapter } from "../src/sisal.ts";

interface NodeState {
  readonly id: string;
  readonly kind: "event" | "market" | "outcome";
  readonly parent?: string;
  readonly attrs: Record<string, string>;
}

class RedirectFixturePage implements BookmakerPagePort {
  queries = 0;
  opened = 0;
  readonly location: { href: string; origin: string };
  readonly nodes: NodeState[];

  constructor(location: { href: string; origin: string }, nodes: NodeState[]) {
    this.location = location;
    this.nodes = nodes;
  }

  async openAllowed() {
    this.opened += 1;
    return { ok: true } as const;
  }

  async currentLocation() {
    return this.location;
  }

  async waitForPageReady() {
    return { ready: true } as const;
  }

  async query(query: BookmakerReadQuery): Promise<readonly ElementRef[]> {
    this.queries += 1;
    const kind =
      query.kind === "event-candidate" ? "event" :
      query.kind === "market-candidate" ? "market" :
      query.kind === "outcome-candidate" ? "outcome" : undefined;
    if (kind === undefined) return [];
    const parent = "within" in query ? query.within.id : undefined;
    return this.nodes
      .filter((node) => node.kind === kind && (parent === undefined || node.parent === parent))
      .map((node) => ({ id: node.id }));
  }

  async readText() {
    return "";
  }

  async readAttribute(ref: ElementRef, name: string) {
    return this.nodes.find((node) => node.id === ref.id)?.attrs[name] ?? null;
  }

  async isVisible() {
    return false;
  }

  async activateNavigationControl() {
    return { ok: true } as const;
  }

  setSelected(ref: ElementRef) {
    const node = this.nodes.find((candidate) => candidate.id === ref.id);
    if (node) node.attrs["aria-pressed"] = "true";
  }
}

class FixtureGate implements SelectionActivationGate {
  calls = 0;
  private readonly page: RedirectFixturePage;

  constructor(page: RedirectFixturePage) {
    this.page = page;
  }

  async activate(request: {
    target: SelectionTarget;
    candidate: ElementRef;
    evidence: MatchingEvidenceSnapshot;
    odds: ObservedOdds;
    acknowledgedObservedOdds?: string;
  }): Promise<SelectionActivationResult> {
    this.calls += 1;
    this.page.setSelected(request.candidate);
    return { kind: "ACTIVATED", selection: { candidate: request.candidate } };
  }
}

function nodes(): NodeState[] {
  return [
    {
      id: "event-1",
      kind: "event",
      attrs: {
        "data-event-participant-a": "Real Madrid",
        "data-event-participant-b": "Rayo Vallecano",
        "data-event-competition": "La Liga",
        "data-event-scheduled-at": "2026-09-12T19:05:00.000Z",
      },
    },
    {
      id: "market-1",
      kind: "market",
      parent: "event-1",
      attrs: {
        "data-market-family": "total",
        "data-market-context": "corners",
        "data-market-line": "11.5",
      },
    },
    {
      id: "outcome-1",
      kind: "outcome",
      parent: "market-1",
      attrs: { "data-outcome-side": "over", "data-odds": "2.08", "aria-pressed": "false" },
    },
  ];
}

function target(bookmaker: "sisal" | "bet365", deepLink: string): SelectionTarget {
  return {
    id: `leg-${bookmaker}`,
    bookmaker,
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
    deepLink,
    provenance: { notificationOptionId: "option-1", sourceOfferId: `offer-${bookmaker}` },
  };
}

async function run(
  adapter: BookmakerAdapter,
  bookmaker: "sisal" | "bet365",
  entry: string,
  location: { href: string; origin: string },
) {
  const page = new RedirectFixturePage(location, nodes());
  const gate = new FixtureGate(page);
  const ctx: AdapterExecutionContext = {
    legId: `leg-${bookmaker}`,
    attemptId: "attempt-1",
    evidenceEpoch: 1,
    browser: page,
    selectionGate: gate,
  };
  const result = await adapter.prepare(ctx, target(bookmaker, entry), {}, new AbortController().signal);
  return { result, page, gate };
}

const cases = [
  {
    bookmaker: "sisal" as const,
    adapter: new SisalAdapter(),
    origin: "https://www.sisal.it",
    entry: "https://www.sisal.it/scommesse-matchpoint/sport/calcio",
  },
  {
    bookmaker: "bet365" as const,
    adapter: new Bet365Adapter(),
    origin: "https://www.bet365.it",
    entry: "https://www.bet365.it/",
  },
];

for (const item of cases) {
  test(`${item.bookmaker}: same-origin credential-bearing final redirect is blocked before matching`, async () => {
    const credentialHref = item.origin.replace("https://", "https://user:secret@");
    const { result, page, gate } = await run(item.adapter, item.bookmaker, item.entry, {
      href: `${credentialHref}/fixture`,
      origin: item.origin,
    });
    assert.equal(result.kind, "FAILED_SAFE");
    assert.equal(page.queries, 0);
    assert.equal(gate.calls, 0);
    if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "BLOCKED_REDIRECT");
  });

  test(`${item.bookmaker}: malformed final href is blocked before matching`, async () => {
    const { result, page, gate } = await run(item.adapter, item.bookmaker, item.entry, {
      href: "not a valid URL",
      origin: item.origin,
    });
    assert.equal(result.kind, "FAILED_SAFE");
    assert.equal(page.queries, 0);
    assert.equal(gate.calls, 0);
    if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "BLOCKED_REDIRECT");
  });

  test(`${item.bookmaker}: clean approved same-origin final location remains accepted`, async () => {
    const { result, gate } = await run(item.adapter, item.bookmaker, item.entry, {
      href: `${item.origin}/fixture`,
      origin: item.origin,
    });
    assert.equal(result.kind, "READY_FOR_USER");
    assert.equal(gate.calls, 1);
  });
}
