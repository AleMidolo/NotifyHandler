import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  BookmakerPagePort,
  BookmakerReadQuery,
  ElementRef,
  MatchingEvidenceSnapshot,
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
  location = { href: "https://www.bet365.it/fixture", origin: "https://www.bet365.it" };
  onReadAttribute?: (ref: ElementRef, name: string) => void;

  constructor(nodes = exactNodes()) {
    this.nodes = nodes;
  }

  async openAllowed() {
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

  async readText() {
    return "";
  }

  async readAttribute(ref: ElementRef, name: string) {
    this.onReadAttribute?.(ref, name);
    return this.node(ref).attrs[name] ?? null;
  }

  async isVisible(ref: ElementRef) {
    return this.node(ref).visible ?? true;
  }

  async activateNavigationControl() {
    return { ok: true } as const;
  }

  setAttribute(id: string, name: string, value: string | undefined) {
    const node = this.nodes.find((candidate) => candidate.id === id);
    if (!node) throw new Error(`unknown node ${id}`);
    if (value === undefined) delete node.attrs[name];
    else node.attrs[name] = value;
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

  constructor(page: FixturePage) {
    this.page = page;
  }

  async activate(request: {
    target: SelectionTarget;
    candidate: ElementRef;
    evidence: MatchingEvidenceSnapshot;
  }): Promise<SelectionActivationResult> {
    this.calls += 1;
    this.page.setAttribute(request.candidate.id, "aria-pressed", "true");
    return { kind: "ACTIVATED", selection: { candidate: request.candidate } };
  }
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
        "data-market-line": "11.5",
      },
    },
    {
      id: "outcome-over",
      kind: "outcome",
      parent: "market-1",
      attrs: { "data-outcome-side": "over", "data-odds": "2.08", "aria-pressed": "false" },
    },
  ];
}

function target(): SelectionTarget {
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
    outcome: { side: "over", sourceLabel: "OVER" },
    expectedOdds: "2.08",
    deepLink: "https://www.bet365.it/fixture",
    provenance: { notificationOptionId: "option-1", sourceOfferId: "offer-bet365" },
  };
}

function context(page: FixturePage, gate: FixtureGate): AdapterExecutionContext {
  return {
    legId: "leg-bet365",
    attemptId: "attempt-1",
    evidenceEpoch: 3,
    browser: page,
    selectionGate: gate,
  };
}

async function prepare(
  page: FixturePage,
  gate = new FixtureGate(page),
  signal = new AbortController().signal,
) {
  return new Bet365Adapter().prepare(context(page, gate), target(), {}, signal);
}

test("BET365 rejects contradictory competition context before activation", async () => {
  const page = new FixturePage();
  page.setAttribute("event-1", "data-event-competition", "Copa del Rey");
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "EVENT_MISMATCH");
});

test("BET365 rejects contradictory event time before activation", async () => {
  const page = new FixturePage();
  page.setAttribute("event-1", "data-event-scheduled-at", "2026-09-12T22:00:00.000Z");
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "EVENT_MISMATCH");
});

test("BET365 rejects duplicate exact-line candidates as ambiguous", async () => {
  const nodes = exactNodes();
  nodes.push({
    id: "market-duplicate",
    kind: "market",
    parent: "event-1",
    attrs: {
      "data-market-family": "total",
      "data-market-context": "corners",
      "data-market-period": "full_match",
      "data-market-line": "11.50",
    },
  });
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);
  const result = await prepare(page, gate);
  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "LINE_AMBIGUOUS");
});

test("BET365 missing and changed displayed odds remain non-blocking", async () => {
  for (const raw of [undefined, "2.12"] as const) {
    const page = new FixturePage();
    page.setAttribute("outcome-over", "data-odds", raw);
    const gate = new FixtureGate(page);
    const result = await prepare(page, gate);
    assert.equal(result.kind, "READY_FOR_USER");
    assert.equal(gate.calls, 1);
    if (result.kind === "READY_FOR_USER") {
      assert.equal(result.odds?.status, raw === undefined ? "UNAVAILABLE" : "OBSERVED");
      if (raw !== undefined) assert.equal(result.odds?.comparison, "HIGHER");
    }
  }
});

test("BET365 resumes after auth with fresh full matching rather than stale evidence", async () => {
  const nodes = exactNodes();
  nodes.unshift({ id: "auth", kind: "auth", attrs: {}, visible: true });
  const page = new FixturePage(nodes);
  const gate = new FixtureGate(page);

  const first = await prepare(page, gate);
  assert.equal(first.kind, "AUTH_REQUIRED");
  assert.equal(gate.calls, 0);

  nodes.find((node) => node.id === "auth")!.visible = false;
  page.setAttribute("event-1", "data-event-participant-b", "Rayo Majadahonda");
  const resumed = await prepare(page, gate);
  assert.equal(resumed.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (resumed.kind === "FAILED_SAFE") assert.equal(resumed.failure.code, "EVENT_MISMATCH");
});

test("BET365 cancellation observed during matching prevents activation", async () => {
  const page = new FixturePage();
  const gate = new FixtureGate(page);
  const controller = new AbortController();
  page.onReadAttribute = (ref, name) => {
    if (ref.id === "market-1" && name === "data-market-line") controller.abort();
  };

  const result = await prepare(page, gate, controller.signal);
  assert.equal(result.kind, "CANCELLED");
  assert.equal(gate.calls, 0);
});

test("BET365 adapter exposes no credential, challenge, stake, payment, or wager submission capability", () => {
  const names = new Set<string>();
  let prototype: object | null = Bet365Adapter.prototype;
  while (prototype && prototype !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(prototype)) names.add(name);
    prototype = Object.getPrototypeOf(prototype) as object | null;
  }

  for (const forbidden of [
    "credential",
    "username",
    "password",
    "mfa",
    "otp",
    "captcha",
    "stake",
    "deposit",
    "payment",
    "submitbet",
    "placebet",
    "wager",
  ]) {
    assert.equal(
      [...names].some((name) => name.toLowerCase().replace(/[^a-z]/g, "").includes(forbidden)),
      false,
      `forbidden adapter capability exposed: ${forbidden}`,
    );
  }
});
