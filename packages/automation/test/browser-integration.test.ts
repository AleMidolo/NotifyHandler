import assert from "node:assert/strict";
import test from "node:test";
import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  BookmakerAdapter,
  MatchingEvidenceSnapshot,
} from "../../bookmakers/src/contracts.ts";
import { Bet365Adapter } from "../../bookmakers/src/bet365.ts";
import { SisalAdapter } from "../../bookmakers/src/sisal.ts";
import { launchFixtureLegSession, type FixtureDocuments } from "../src/test-support.ts";

const SISAL_URL = "https://www.sisal.it/__notifyhandler_fixture/event";
const BET365_URL = "https://www.bet365.it/__notifyhandler_fixture/event";

type Bookmaker = "sisal" | "bet365";

function rolePrefix(bookmaker: Bookmaker): string {
  return `data-nh-${bookmaker}-role`;
}

function fixtureHtml(bookmaker: Bookmaker, options: Readonly<{
  auth?: boolean;
  participantB?: string;
  competition?: string;
  scheduledAt?: string;
  marketContext?: string;
  marketPeriod?: string;
  line?: string;
  outcomeSide?: string;
  odds?: string;
  duplicateEvent?: boolean;
  verifySelection?: boolean;
  replaceOutcomeOnMarketClick?: boolean;
}> = {}): string {
  const role = rolePrefix(bookmaker);
  if (options.auth) {
    return `<!doctype html><html><body><div ${role}="auth">Manual login required</div></body></html>`;
  }

  const participantB = options.participantB ?? "Rayo Vallecano";
  const competition = options.competition ?? "La Liga";
  const scheduledAt = options.scheduledAt ?? "2026-09-12T19:05:00.000Z";
  const marketContext = options.marketContext ?? "corners";
  const marketPeriod = options.marketPeriod ?? "full_match";
  const line = options.line ?? "11.5";
  const outcomeSide = options.outcomeSide ?? "over";
  const odds = options.odds ?? "2.08";
  const selectedHandler = options.verifySelection === false ? "" : `onclick="this.setAttribute('aria-pressed','true')"`;
  const replaceHandler = options.replaceOutcomeOnMarketClick
    ? `onclick="document.querySelector('[${role}=outcome]').outerHTML='<button ${role}=outcome data-outcome-side=over data-odds=2.08 aria-pressed=false>replacement</button>'"`
    : "";

  const event = (id: string): string => `
    <section id="${id}" ${role}="event"
      data-event-participant-a="Real Madrid"
      data-event-participant-b="${participantB}"
      data-event-competition="${competition}"
      data-event-scheduled-at="${scheduledAt}">
      <div ${role}="market" ${replaceHandler}
        data-market-family="total"
        data-market-context="${marketContext}"
        data-market-period="${marketPeriod}"
        data-market-line="${line}">
        <button ${role}="outcome" data-outcome-side="${outcomeSide}" data-odds="${odds}" aria-pressed="false" ${selectedHandler}>OVER</button>
      </div>
    </section>`;

  return `<!doctype html><html><body>${event("event-1")}${options.duplicateEvent ? event("event-2") : ""}</body></html>`;
}

function target(bookmaker: Bookmaker, deepLink: string): SelectionTarget {
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
    market: {
      family: "total",
      context: "corners",
      period: "full_match",
      line: "11.5",
      sourceLabel: "U/O CORNER 11.5",
    },
    outcome: { side: "over", sourceLabel: "OVER" },
    expectedOdds: "2.08",
    deepLink,
    provenance: {
      notificationOptionId: "option-1",
      sourceOfferId: `offer-${bookmaker}`,
    },
  };
}

function adapter(bookmaker: Bookmaker): BookmakerAdapter {
  return bookmaker === "sisal" ? new SisalAdapter() : new Bet365Adapter();
}

async function prepare(bookmaker: Bookmaker, fixtures: FixtureDocuments, options: Readonly<{
  epoch?: number;
  signal?: AbortSignal;
}> = {}) {
  const session = await launchFixtureLegSession({ bookmaker, fixtures, navigationTimeoutMs: 2_000 });
  const controller = options.signal === undefined ? new AbortController() : undefined;
  const signal = options.signal ?? controller!.signal;
  const epoch = options.epoch ?? 1;
  const capabilities = session.createAttemptCapabilities(epoch, signal);
  const ctx: AdapterExecutionContext = {
    legId: `leg-${bookmaker}`,
    attemptId: `attempt-${epoch}`,
    evidenceEpoch: epoch,
    browser: capabilities.browser,
    selectionGate: capabilities.selectionGate,
  };

  try {
    const result = await adapter(bookmaker).prepare(ctx, target(bookmaker, bookmaker === "sisal" ? SISAL_URL : BET365_URL), {}, signal);
    return { result, session };
  } catch (error) {
    await session.close();
    throw error;
  }
}

for (const item of [
  { bookmaker: "sisal" as const, url: SISAL_URL },
  { bookmaker: "bet365" as const, url: BET365_URL },
]) {
  test(`${item.bookmaker}: real Chromium worker prepares exact synthetic fixture`, async () => {
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body: fixtureHtml(item.bookmaker) },
    });
    try {
      assert.equal(result.kind, "READY_FOR_USER");
      if (result.kind === "READY_FOR_USER") {
        assert.equal(result.odds.comparison, "EQUAL");
        assert.equal(result.evidence.event.overall.status, "MATCHED");
      }
    } finally {
      await session.close();
    }
  });

  test(`${item.bookmaker}: duplicate event fails safely through the real page port`, async () => {
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body: fixtureHtml(item.bookmaker, { duplicateEvent: true }) },
    });
    try {
      assert.equal(result.kind, "FAILED_SAFE");
      if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "EVENT_AMBIGUOUS");
    } finally {
      await session.close();
    }
  });

  test(`${item.bookmaker}: wrong market context fails before selection activation`, async () => {
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body: fixtureHtml(item.bookmaker, { marketContext: "goals" }) },
    });
    try {
      assert.equal(result.kind, "FAILED_SAFE");
      if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "MARKET_NOT_FOUND");
    } finally {
      await session.close();
    }
  });

  test(`${item.bookmaker}: first-half market period fails before selection activation`, async () => {
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body: fixtureHtml(item.bookmaker, { marketPeriod: "first_half" }) },
    });
    try {
      assert.equal(result.kind, "FAILED_SAFE");
      if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "MARKET_MISMATCH");
    } finally {
      await session.close();
    }
  });

  test(`${item.bookmaker}: missing market period evidence fails before selection activation`, async () => {
    const body = fixtureHtml(item.bookmaker).replace(' data-market-period="full_match"', "");
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body },
    });
    try {
      assert.equal(result.kind, "FAILED_SAFE");
      if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "MARKET_CONTEXT_UNAVAILABLE");
    } finally {
      await session.close();
    }
  });

  test(`${item.bookmaker}: neighboring line fails before selection activation`, async () => {
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body: fixtureHtml(item.bookmaker, { line: "10.5" }) },
    });
    try {
      assert.equal(result.kind, "FAILED_SAFE");
      if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "LINE_MISMATCH");
    } finally {
      await session.close();
    }
  });

  test(`${item.bookmaker}: wrong outcome fails before selection activation`, async () => {
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body: fixtureHtml(item.bookmaker, { outcomeSide: "under" }) },
    });
    try {
      assert.equal(result.kind, "FAILED_SAFE");
      if (result.kind === "FAILED_SAFE") assert.equal(result.failure.code, "OUTCOME_NOT_FOUND");
    } finally {
      await session.close();
    }
  });

  test(`${item.bookmaker}: changed odds remain telemetry while exact selection prepares`, async () => {
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body: fixtureHtml(item.bookmaker, { odds: "2.10" }) },
    });
    try {
      assert.equal(result.kind, "READY_FOR_USER");
      if (result.kind === "READY_FOR_USER") {
        assert.equal(result.odds?.status, "OBSERVED");
        assert.equal(result.odds?.comparison, "HIGHER");
        assert.equal(result.odds?.observed, "2.1");
      }
    } finally {
      await session.close();
    }
  });

  test(`${item.bookmaker}: post-selection verification failure is explicit`, async () => {
    const { result, session } = await prepare(item.bookmaker, {
      [item.url]: { kind: "html", body: fixtureHtml(item.bookmaker, { verifySelection: false }) },
    });
    try {
      assert.equal(result.kind, "FAILED_SAFE");
      if (result.kind === "FAILED_SAFE") {
        assert.equal(result.failure.code, "SELECTION_VERIFICATION_FAILED");
        assert.equal(result.failure.activation, "ATTEMPTED_NOT_VERIFIED");
      }
    } finally {
      await session.close();
    }
  });
}

test("manual-auth resume performs a fresh browser validation pass", async () => {
  const session = await launchFixtureLegSession({
    bookmaker: "sisal",
    fixtures: {
      [SISAL_URL]: [
        { kind: "html", body: fixtureHtml("sisal", { auth: true }) },
        { kind: "html", body: fixtureHtml("sisal", { participantB: "Rayo Majadahonda" }) },
      ],
    },
    navigationTimeoutMs: 2_000,
  });

  try {
    const firstSignal = new AbortController().signal;
    const firstCaps = session.createAttemptCapabilities(1, firstSignal);
    const firstContext: AdapterExecutionContext = {
      legId: "leg-sisal",
      attemptId: "attempt-auth",
      evidenceEpoch: 1,
      browser: firstCaps.browser,
      selectionGate: firstCaps.selectionGate,
    };
    const first = await new SisalAdapter().prepare(firstContext, target("sisal", SISAL_URL), {}, firstSignal);
    assert.equal(first.kind, "AUTH_REQUIRED");

    const resumedSignal = new AbortController().signal;
    const resumedCaps = session.createAttemptCapabilities(2, resumedSignal);
    const resumedContext: AdapterExecutionContext = {
      legId: "leg-sisal",
      attemptId: "attempt-resume",
      evidenceEpoch: 2,
      browser: resumedCaps.browser,
      selectionGate: resumedCaps.selectionGate,
    };
    const resumed = await new SisalAdapter().prepare(resumedContext, target("sisal", SISAL_URL), {}, resumedSignal);
    assert.equal(resumed.kind, "FAILED_SAFE");
    if (resumed.kind === "FAILED_SAFE") assert.equal(resumed.failure.code, "EVENT_MISMATCH");
  } finally {
    await session.close();
  }
});

test("unsafe redirect is blocked inside the Chromium worker before matching", async () => {
  const { result, session } = await prepare("bet365", {
    [BET365_URL]: { kind: "redirect", location: "https://example.invalid/phish" },
  });
  try {
    assert.equal(result.kind, "FAILED_SAFE");
    if (result.kind === "FAILED_SAFE") {
      assert.ok(["BLOCKED_REDIRECT", "UNSAFE_OR_UNSUPPORTED_URL"].includes(result.failure.code));
      assert.equal(result.failure.activation, "NOT_ATTEMPTED");
    }
  } finally {
    await session.close();
  }
});

test("cancellation interrupts a delayed navigation and cannot become READY_FOR_USER", async () => {
  const session = await launchFixtureLegSession({
    bookmaker: "sisal",
    fixtures: {
      [SISAL_URL]: { kind: "html", body: fixtureHtml("sisal"), delayMs: 500 },
    },
    navigationTimeoutMs: 2_000,
  });
  const controller = new AbortController();
  const caps = session.createAttemptCapabilities(7, controller.signal);
  const ctx: AdapterExecutionContext = {
    legId: "leg-sisal",
    attemptId: "attempt-cancel",
    evidenceEpoch: 7,
    browser: caps.browser,
    selectionGate: caps.selectionGate,
  };

  try {
    const pending = new SisalAdapter().prepare(ctx, target("sisal", SISAL_URL), {}, controller.signal);
    setTimeout(() => controller.abort(), 30);
    const result = await pending;
    assert.equal(result.kind, "CANCELLED");
  } finally {
    await session.close();
  }
});

test("stale element reference cannot be activated after fixture DOM replacement", async () => {
  const session = await launchFixtureLegSession({
    bookmaker: "bet365",
    fixtures: {
      [BET365_URL]: { kind: "html", body: fixtureHtml("bet365", { replaceOutcomeOnMarketClick: true }) },
    },
  });
  const signal = new AbortController().signal;
  const caps = session.createAttemptCapabilities(9, signal);

  try {
    assert.equal((await caps.browser.openAllowed(BET365_URL)).ok, true);
    const events = await caps.browser.query({ kind: "event-candidate" });
    assert.equal(events.length, 1);
    const markets = await caps.browser.query({ kind: "market-candidate", within: events[0]! });
    assert.equal(markets.length, 1);
    const outcomes = await caps.browser.query({ kind: "outcome-candidate", within: markets[0]! });
    assert.equal(outcomes.length, 1);
    const staleOutcome = outcomes[0]!;

    assert.equal((await caps.browser.activateNavigationControl({ ref: markets[0]!, purpose: "DISCLOSE_MARKET" })).ok, true);

    const evidence: MatchingEvidenceSnapshot = {
      evidenceEpoch: 9,
      origin: { status: "MATCHED", reasonCode: "TEST" },
      event: {
        participants: { status: "MATCHED", reasonCode: "TEST" },
        competition: { status: "MATCHED", reasonCode: "TEST" },
        scheduledTime: { status: "MATCHED", reasonCode: "TEST" },
        overall: { status: "MATCHED", reasonCode: "TEST" },
      },
      market: { status: "MATCHED", reasonCode: "TEST" },
      line: { status: "MATCHED", reasonCode: "TEST" },
      outcome: { status: "MATCHED", reasonCode: "TEST", normalizedObserved: [staleOutcome.id] },
    };
    const activation = await caps.selectionGate.activate({
      target: target("bet365", BET365_URL),
      candidate: staleOutcome,
      evidence,
    });
    assert.equal(activation.kind, "FAILED");
  } finally {
    await session.close();
  }
});

test("two bookmaker legs use independent Chromium sessions and both remain usable", async () => {
  const [sisal, bet365] = await Promise.all([
    launchFixtureLegSession({ bookmaker: "sisal", fixtures: { [SISAL_URL]: { kind: "html", body: fixtureHtml("sisal") } } }),
    launchFixtureLegSession({ bookmaker: "bet365", fixtures: { [BET365_URL]: { kind: "html", body: fixtureHtml("bet365") } } }),
  ]);

  try {
    assert.notEqual(sisal.sessionId, bet365.sessionId);
    const sisalSignal = new AbortController().signal;
    const bet365Signal = new AbortController().signal;
    const sisalCaps = sisal.createAttemptCapabilities(1, sisalSignal);
    const bet365Caps = bet365.createAttemptCapabilities(1, bet365Signal);

    const sisalContext: AdapterExecutionContext = {
      legId: "leg-sisal",
      attemptId: "attempt-sisal",
      evidenceEpoch: 1,
      browser: sisalCaps.browser,
      selectionGate: sisalCaps.selectionGate,
    };
    const bet365Context: AdapterExecutionContext = {
      legId: "leg-bet365",
      attemptId: "attempt-bet365",
      evidenceEpoch: 1,
      browser: bet365Caps.browser,
      selectionGate: bet365Caps.selectionGate,
    };

    const [sisalResult, bet365Result] = await Promise.all([
      new SisalAdapter().prepare(sisalContext, target("sisal", SISAL_URL), {}, sisalSignal),
      new Bet365Adapter().prepare(bet365Context, target("bet365", BET365_URL), {}, bet365Signal),
    ]);
    assert.equal(sisalResult.kind, "READY_FOR_USER");
    assert.equal(bet365Result.kind, "READY_FOR_USER");
  } finally {
    await Promise.all([sisal.close(), bet365.close()]);
  }
});
