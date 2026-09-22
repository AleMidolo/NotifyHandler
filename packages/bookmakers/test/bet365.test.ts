import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  BookmakerPagePort,
  BookmakerReadQuery,
  ElementRef,
  MatchingEvidenceSnapshot,
  ObservedOdds,
  SelectionActivationGate,
  SelectionActivationResult,
} from "../src/contracts.ts";
import { Bet365Adapter } from "../src/bet365.ts";

interface NodeState {
  readonly id: string;
  readonly kind: "auth" | "event" | "market" | "outcome";
  readonly parent?: string;
  readonly attrs: Record<string, string>;
  visible?: boolean;
}

class FixturePage implements BookmakerPagePort {
  readonly nodes: NodeState[];
  location = { href: "https://www.bet365.it/", origin: "https://www.bet365.it" };
  opened: string[] = [];

  constructor(nodes: NodeState[], location?: { href: string; origin: string }) {
    this.nodes = nodes;
    if (location) this.location = location;
  }

  async openAllowed(url: string) {
    this.opened.push(url);
    return { ok: true } as const;
  }

  async currentLocation() {
    return this.location;
  }

  async waitForPageReady() {
    return { ready: true } as const;
  }

  async query(query: BookmakerReadQuery): Promise<readonly ElementRef[]> {
    const kind =
      query.kind === "auth-wall" ? "auth" :
      query.kind === "event-candidate" ? "event" :
      query.kind === "market-candidate" ? "market" : "outcome";
    const parent = "within" in query ? query.within.id : undefined;
    return this.nodes
      .filter((node) => node.kind === kind && (parent === undefined || node.parent === parent))
      .map((node) => ({ id: node.id }));
  }

  async readText(ref: ElementRef) {
    return this.node(ref).attrs.text ?? "";
  }

  async readAttribute(ref: ElementRef, name: string) {
    return this.node(ref).attrs[name] ?? null;
  }

  async isVisible(ref: ElementRef) {
    return this.node(ref).visible ?? true;
  }

  async activateNavigationControl() {
    return { ok: true } as const;
  }

  setAttribute(ref: ElementRef, name: string, value: string) {
    this.node(ref).attrs[name] = value;
  }

  private node(ref: ElementRef): NodeState {
    const found = this.nodes.find((node) => node.id === ref.id);
    if (!found) throw new Error(`unknown node ${ref.id}`);
    return found;
  }
}

class FixtureGate implements SelectionActivationGate {
  calls = 0;
  private readonly page: FixturePage;
  private readonly verify: boolean;

  constructor(page: FixturePage, verify = true) {
    this.page = page;
    this.verify = verify;
  }

  async activate(request: {
    target: SelectionTarget;
    candidate: ElementRef;
    evidence: MatchingEvidenceSnapshot;
    odds: ObservedOdds;
    acknowledgedObservedOdds?: string;
  }): Promise<SelectionActivationResult> {
    this.calls += 1;
    assert.equal(request.evidence.origin.status, "MATCHED");
    assert.equal(request.evidence.event.overall.status, "MATCHED");
    assert.equal(request.evidence.market.status, "MATCHED");
    assert.equal(request.evidence.line.status, "MATCHED");
    assert.equal(request.evidence.outcome.status, "MATCHED");
    if (this.verify) this.page.setAttribute(request.candidate, "aria-pressed", "true");
    return { kind: "ACTIVATED", selection: { candidate: request.candidate } };
  }
}

function target(overrides: Partial<SelectionTarget> = {}): SelectionTarget {
  return {
    id: "leg-bet365",
    bookmaker: "bet365",
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-12T19:00:00.000Z",
      sourceDisplay: "Real Madrid - Rayo Vallecano",
    },
    market: { family: "total", context: "corners", period: "full_match", line: "11.5", sourceLabel: "U/O CORNER 11.5" },
    outcome: { side: "under", sourceLabel: "UNDER" },
    expectedOdds: "1.80",
    deepLink: "https://www.bet365.it/#/AC/B1/C1/D100/Efixture/",
    provenance: { notificationOptionId: "option-1", sourceOfferId: "offer-bet365-under" },
    ...overrides,
  };
}

function exactNodes(): NodeState[] {
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
        "data-market-period": "full_match",
        "data-market-line": "11.50",
      },
    },
    {
      id: "outcome-over",
      kind: "outcome",
      parent: "market-1",
      attrs: { "data-outcome-side": "over", "data-odds": "2.08", "aria-pressed": "false" },
    },
    {
      id: "outcome-under",
      kind: "outcome",
      parent: "market-1",
      attrs: { "data-outcome-side": "under", "data-odds": "1.80", "aria-pressed": "false" },
    },
  ];
}

function context(page: FixturePage, gate: FixtureGate, acknowledgedObservedOdds?: string): AdapterExecutionContext {
  return {
    legId: "leg-2",
    attemptId: "attempt-1",
    evidenceEpoch: 1,
    browser: page,
    selectionGate: gate,
    ...(acknowledgedObservedOdds === undefined ? {} : { acknowledgedObservedOdds }),
  };
}

async function prepare(page: FixturePage, gate = new FixtureGate(page), t = target(), acknowledged?: string, signal?: AbortSignal) {
  return new Bet365Adapter().prepare(context(page, gate, acknowledged), t, {}, signal ?? new AbortController().signal);
}

test("prepares an exact BET365 corners selection through the activation gate", async () => {
  const page = new FixturePage(exactNodes());
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "READY_FOR_USER");
  assert.equal(gate.calls, 1);
  if (result.kind === "READY_FOR_USER") {
    assert.equal(result.odds.comparison, "EQUAL");
    assert.equal(result.selection.candidate.id, "outcome-under");
  }
});

test("rejects neighboring BET365 lines without activating", async () => {
  const nodes = exactNodes();
  nodes.find((node) => node.id === "market-1")!.attrs["data-market-line"] = "12.5";
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "LINE_MISMATCH");
});

test("fails safely on duplicate matching BET365 events", async () => {
  const nodes = exactNodes();
  nodes.push({ ...nodes[0]!, id: "event-2", attrs: { ...nodes[0]!.attrs } });
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "EVENT_AMBIGUOUS");
});

test("fails safely when BET365 market context is not present", async () => {
  const nodes = exactNodes();
  nodes.find((node) => node.id === "market-1")!.attrs["data-market-context"] = "goals";
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "MARKET_NOT_FOUND");
});

test("BET365 rejects first-half corners even when family, context, line, side, and odds match", async () => {
  const nodes = exactNodes();
  nodes.find((node) => node.id === "market-1")!.attrs["data-market-period"] = "first_half";
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "MARKET_MISMATCH");
});

test("BET365 fails safely when market period evidence is unavailable", async () => {
  const nodes = exactNodes();
  delete nodes.find((node) => node.id === "market-1")!.attrs["data-market-period"];
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "MARKET_CONTEXT_UNAVAILABLE");
});

test("BET365 changed odds interrupt before activation and accepted odds are rechecked", async () => {
  const nodes = exactNodes();
  nodes.find((node) => node.id === "outcome-under")!.attrs["data-odds"] = "1.82";
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const changed = await prepare(page, gate);
  assert.equal(changed.kind, "ODDS_CHANGED");
  assert.equal(gate.calls, 0);

  const continued = await prepare(page, gate, target(), "1.82");
  assert.equal(continued.kind, "READY_FOR_USER");
  assert.equal(gate.calls, 1);
});

test("BET365 reports manual authentication without activating", async () => {
  const page = new FixturePage([{ id: "login", kind: "auth", attrs: {}, visible: true }, ...exactNodes()]);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "AUTH_REQUIRED");
  assert.equal(gate.calls, 0);
});

test("BET365 rejects unapproved deep-link origins before navigation", async () => {
  const page = new FixturePage(exactNodes());
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate, target({ deepLink: "https://bet-up.it/lnk/opaque/bet365" }));
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(page.opened.length, 0);
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
});

test("BET365 rejects credential-bearing approved-origin URLs before navigation", async () => {
  const page = new FixturePage(exactNodes());
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate, target({ deepLink: "https://user:secret@www.bet365.it/" }));
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(page.opened.length, 0);
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "UNSAFE_OR_UNSUPPORTED_URL");
});

test("BET365 cancellation before matching prevents selection activation", async () => {
  const page = new FixturePage(exactNodes());
  const gate = new FixtureGate(page);
  const controller = new AbortController();
  controller.abort();
  const result = await prepare(page, gate, target(), undefined, controller.signal);
  assert.equal(result.kind, "CANCELLED");
  assert.equal(gate.calls, 0);
});

test("BET365 post-activation verification failure is explicit", async () => {
  const page = new FixturePage(exactNodes());
  const gate = new FixtureGate(page, false);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 1);
  if (result.kind === "FAILED_SAFE") {
    assert.equal(result.failure.code, "SELECTION_VERIFICATION_FAILED");
    assert.equal(result.failure.activation, "ATTEMPTED_NOT_VERIFIED");
  }
});

test("similar but wrong BET365 event never activates", async () => {
  const nodes = exactNodes();
  nodes.find((node) => node.id === "event-1")!.attrs["data-event-participant-b"] = "Rayo Majadahonda";
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "EVENT_MISMATCH");
});

test("wrong BET365 outcome side never activates", async () => {
  const nodes = exactNodes().filter((node) => node.id !== "outcome-under");
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "OUTCOME_NOT_FOUND");
});

test("duplicate requested BET365 outcomes fail as ambiguous", async () => {
  const nodes = exactNodes();
  nodes.push({
    id: "outcome-under-duplicate",
    kind: "outcome",
    parent: "market-1",
    attrs: { "data-outcome-side": "under", "data-odds": "1.80", "aria-pressed": "false" },
  });
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "OUTCOME_AMBIGUOUS");
});

test("BET365 cross-origin redirect is rejected before matching", async () => {
  const page = new FixturePage(exactNodes(), { href: "https://example.invalid/redirect", origin: "https://example.invalid" });
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "BLOCKED_REDIRECT");
});
