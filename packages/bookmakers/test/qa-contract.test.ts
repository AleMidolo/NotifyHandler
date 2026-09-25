import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  BookmakerPagePort,
  ElementRef,
  MatchingEvidenceSnapshot,
  SelectionActivationGate,
  SelectionActivationResult,
  SisalReadQuery,
} from "../src/contracts.ts";
import { SisalAdapter } from "../src/sisal.ts";

interface NodeState {
  readonly id: string;
  readonly kind: "auth" | "event" | "market" | "outcome";
  readonly parent?: string;
  readonly attrs: Record<string, string>;
  visible?: boolean;
}

class QaFixturePage implements BookmakerPagePort {
  readonly nodes: NodeState[];
  location = {
    href: "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/fixture",
    origin: "https://www.sisal.it",
  };
  opened: string[] = [];
  onReadAttribute?: (ref: ElementRef, name: string) => void;

  constructor(nodes: NodeState[]) {
    this.nodes = nodes;
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

  async query(query: SisalReadQuery): Promise<readonly ElementRef[]> {
    const kind =
      query.kind === "auth-wall"
        ? "auth"
        : query.kind === "event-candidate"
          ? "event"
          : query.kind === "market-candidate"
            ? "market"
            : "outcome";
    const parent = "within" in query ? query.within.id : undefined;
    return this.nodes
      .filter((node) => node.kind === kind && (parent === undefined || node.parent === parent))
      .map((node) => ({ id: node.id }));
  }

  async readText(ref: ElementRef) {
    return this.node(ref).attrs.text ?? "";
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

  setAttribute(ref: ElementRef, name: string, value: string) {
    this.node(ref).attrs[name] = value;
  }

  private node(ref: ElementRef) {
    const found = this.nodes.find((node) => node.id === ref.id);
    if (!found) throw new Error(`unknown node ${ref.id}`);
    return found;
  }
}

class QaGate implements SelectionActivationGate {
  calls = 0;
  readonly candidates: string[] = [];
  private readonly page: QaFixturePage;

  constructor(page: QaFixturePage) {
    this.page = page;
  }

  async activate(request: {
    target: SelectionTarget;
    candidate: ElementRef;
    evidence: MatchingEvidenceSnapshot;
  }): Promise<SelectionActivationResult> {
    this.calls += 1;
    this.candidates.push(request.candidate.id);
    assert.equal(request.evidence.origin.status, "MATCHED");
    assert.equal(request.evidence.event.overall.status, "MATCHED");
    assert.equal(request.evidence.market.status, "MATCHED");
    assert.equal(request.evidence.line.status, "MATCHED");
    assert.equal(request.evidence.outcome.status, "MATCHED");
    this.page.setAttribute(request.candidate, "aria-pressed", "true");
    return { kind: "ACTIVATED", selection: { candidate: request.candidate } };
  }
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
    market: {
      family: "total",
      context: "corners",
      period: "full_match",
      line: "11.5",
      sourceLabel: "U/O CORNER 11.5",
    },
    outcome: { side: "over", sourceLabel: "OVER" },
    expectedOdds: "2.08",
    deepLink: "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/fixture",
    provenance: { notificationOptionId: "option-1", sourceOfferId: "offer-sisal-over" },
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
      attrs: {
        "data-outcome-side": "over",
        "data-odds": "2.08",
        "aria-pressed": "false",
      },
    },
  ];
}

function makeContext(page: QaFixturePage, gate: QaGate): AdapterExecutionContext {
  return {
    legId: "leg-qa",
    attemptId: "attempt-qa",
    evidenceEpoch: 11,
    browser: page,
    selectionGate: gate,
  };
}

async function prepare(
  page: QaFixturePage,
  gate = new QaGate(page),
  signal = new AbortController().signal,
) {
  return new SisalAdapter().prepare(makeContext(page, gate), target(), {}, signal);
}

function find(nodes: NodeState[], id: string): NodeState {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`missing fixture node ${id}`);
  return node;
}

test("wrong competition context cannot activate a selection", async () => {
  const nodes = exactNodes();
  find(nodes, "event-1").attrs["data-event-competition"] = "Serie A";
  const page = new QaFixturePage(nodes);
  const gate = new QaGate(page);
  const result = await prepare(page, gate);

  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "EVENT_MISMATCH");
});

test("event time outside the shared 15-minute tolerance cannot activate", async () => {
  const nodes = exactNodes();
  find(nodes, "event-1").attrs["data-event-scheduled-at"] = "2026-09-12T19:16:00.000Z";
  const page = new QaFixturePage(nodes);
  const gate = new QaGate(page);
  const result = await prepare(page, gate);

  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "EVENT_MISMATCH");
});

test("first-half period near-miss cannot activate even with the same corners line", async () => {
  const nodes = exactNodes();
  find(nodes, "market-1").attrs["data-market-period"] = "first_half";
  const page = new QaFixturePage(nodes);
  const gate = new QaGate(page);
  const result = await prepare(page, gate);

  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "MARKET_MISMATCH");
});

test("missing market period evidence is non-authorizing", async () => {
  const nodes = exactNodes();
  delete find(nodes, "market-1").attrs["data-market-period"];
  const page = new QaFixturePage(nodes);
  const gate = new QaGate(page);
  const result = await prepare(page, gate);

  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "MARKET_CONTEXT_UNAVAILABLE");
});

test("duplicate exact-line market candidates are ambiguous and never activate", async () => {
  const nodes = exactNodes();
  nodes.push({
    id: "market-duplicate",
    kind: "market",
    parent: "event-1",
    attrs: {
      "data-market-family": "total",
      "data-market-context": "corners",
      "data-market-period": "full_match",
      "data-market-line": "11.5",
    },
  });
  const page = new QaFixturePage(nodes);
  const gate = new QaGate(page);
  const result = await prepare(page, gate);

  assert.equal(result.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "LINE_AMBIGUOUS");
});

test("higher and lower displayed odds remain informational and do not interrupt activation", async () => {
  for (const [raw, comparison] of [["2.10", "HIGHER"], ["2.00", "LOWER"]] as const) {
    const nodes = exactNodes();
    find(nodes, "outcome-over").attrs["data-odds"] = raw;
    const page = new QaFixturePage(nodes);
    const gate = new QaGate(page);
    const result = await prepare(page, gate);
    assert.equal(result.kind, "READY_FOR_USER");
    assert.equal(gate.calls, 1);
    if (result.kind === "READY_FOR_USER") {
      assert.equal(result.odds?.status, "OBSERVED");
      assert.equal(result.odds?.comparison, comparison);
    }
  }
});

test("missing and invalid displayed odds remain non-blocking telemetry", async () => {
  for (const raw of [undefined, "invalid"] as const) {
    const nodes = exactNodes();
    const outcome = find(nodes, "outcome-over");
    if (raw === undefined) delete outcome.attrs["data-odds"];
    else outcome.attrs["data-odds"] = raw;
    const page = new QaFixturePage(nodes);
    const gate = new QaGate(page);
    const result = await prepare(page, gate);
    assert.equal(result.kind, "READY_FOR_USER");
    assert.equal(gate.calls, 1);
    if (result.kind === "READY_FOR_USER") {
      assert.equal(result.odds?.status, raw === undefined ? "UNAVAILABLE" : "INVALID");
    }
  }
});

test("manual-auth resume performs a fresh full validation pass", async () => {
  const nodes = exactNodes();
  nodes.unshift({ id: "login", kind: "auth", attrs: {}, visible: true });
  const page = new QaFixturePage(nodes);
  const gate = new QaGate(page);

  const paused = await prepare(page, gate);
  assert.equal(paused.kind, "AUTH_REQUIRED");
  assert.equal(gate.calls, 0);

  find(nodes, "login").visible = false;
  find(nodes, "market-1").attrs["data-market-line"] = "10.5";

  const resumed = await prepare(page, gate);
  assert.equal(resumed.kind, "FAILED_SAFE");
  assert.equal(gate.calls, 0);
  if (resumed.kind === "FAILED_SAFE") assert.equal(resumed.failure.code, "LINE_MISMATCH");
});

test("cancellation observed during matching cannot lead to later activation", async () => {
  const nodes = exactNodes();
  const page = new QaFixturePage(nodes);
  const gate = new QaGate(page);
  const controller = new AbortController();
  let aborted = false;
  page.onReadAttribute = (ref, name) => {
    if (!aborted && ref.id === "event-1" && name === "data-event-participant-a") {
      aborted = true;
      controller.abort();
    }
  };

  const result = await prepare(page, gate, controller.signal);

  assert.notEqual(result.kind, "READY_FOR_USER");
  assert.equal(gate.calls, 0);
});

test("public adapter object exposes no credential, stake, or wager-submission operations", () => {
  const names = new Set<string>();
  let prototype: object | null = SisalAdapter.prototype;
  while (prototype && prototype !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(prototype)) names.add(name.toLocaleLowerCase("en-US"));
    prototype = Object.getPrototypeOf(prototype);
  }

  const forbidden = [
    "credential",
    "password",
    "login",
    "mfa",
    "otp",
    "captcha",
    "stake",
    "placebet",
    "submitbet",
    "confirmbet",
    "finalizebet",
    "deposit",
    "withdraw",
    "cashout",
  ];

  for (const token of forbidden) {
    assert.equal(
      [...names].some((name) => name.includes(token)),
      false,
      `adapter prototype unexpectedly exposes forbidden capability token: ${token}`,
    );
  }
});
