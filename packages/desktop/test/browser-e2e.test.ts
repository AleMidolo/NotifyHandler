import assert from "node:assert/strict";
import test from "node:test";
import type { BookmakerId } from "../../domain/src/index.ts";
import { createWorkerExecutionPreflight, type PlaywrightBookmakerAutomationWorker } from "../../automation/src/index.ts";
import { createFixtureAutomationWorker, type FixtureDocuments } from "../../automation/src/test-support.ts";
import { composeLocalNotifyHandlerRuntime, type LocalNotifyHandlerRuntime } from "../src/index.ts";

const SISAL_URL = "https://www.sisal.it/__notifyhandler_fixture/app-e2e";
const BET365_URL = "https://www.bet365.it/__notifyhandler_fixture/app-e2e";
type FixtureBookmaker = "sisal" | "bet365";

function fixtureHtml(bookmaker: FixtureBookmaker, side: "over" | "under", odds: string, options: Readonly<{ auth?: boolean; participantB?: string; marketContext?: string; marketPeriod?: string; line?: string; verifySelection?: boolean }> = {}): string {
  const role = `data-nh-${bookmaker}-role`;
  if (options.auth) return `<!doctype html><html><body><div ${role}="auth">Manual login required</div></body></html>`;
  const participantB = options.participantB ?? "Rayo Vallecano";
  const marketContext = options.marketContext ?? "corners";
  const marketPeriod = options.marketPeriod ?? "full_match";
  const line = options.line ?? "11.5";
  const selectedHandler = options.verifySelection === false ? "" : `onclick="this.setAttribute('aria-pressed','true')"`;
  return `<!doctype html><html><body><section ${role}="event" data-event-participant-a="Real Madrid" data-event-participant-b="${participantB}" data-event-competition="La Liga" data-event-scheduled-at="2026-09-12T19:05:00.000Z"><div ${role}="market" data-market-family="total" data-market-context="${marketContext}" data-market-period="${marketPeriod}" data-market-line="${line}"><button ${role}="outcome" data-outcome-side="${side}" data-odds="${odds}" aria-pressed="false" ${selectedHandler}>${side.toUpperCase()}</button></div></section></body></html>`;
}

function docs(bookmaker: FixtureBookmaker, side: "over" | "under", odds: string, options: Parameters<typeof fixtureHtml>[3] = {}): FixtureDocuments {
  const url = bookmaker === "sisal" ? SISAL_URL : BET365_URL;
  return { [url]: { kind: "html", body: fixtureHtml(bookmaker, side, odds, options) } };
}

function canonicalNotification(sisalUrl = SISAL_URL, bet365Url = BET365_URL): string {
  return `📊 **SEGNALE SUREBET (ROI: 3.53%)**\n━━━━━━━━━━━━━━━━━━\n⚽️ **Evento:** ⚽️ Real Madrid - Rayo Vallecano\n🏆 **Competizione:** La Liga\n📅 **Data e Ora:** 12/09/2026 - 21:00\n📝 **Mercato:** \`U/O CORNER 11.5\`\n━━━━━━━━━━━━━━━━━━\n📝 **Esito OVER**:\n   • 🔗 [SISAL](${sisalUrl}) @ 2.08\n📝 **Esito UNDER**:\n   • 🔗 [BET365](${bet365Url}) @ 1.95\n💡 **Opzioni consigliate**:\n   • SISAL OVER 11.5 + BET365 UNDER 11.5`;
}

function unsupportedNotification(): string {
  return `Evento: Real Madrid - Rayo Vallecano\nCompetizione: La Liga\nData e Ora: 12/09/2026 - 21:00\nMercato: U/O CORNER 11.5\nEsito OVER:\nLOTTOMATICA @ 2.08\nEsito UNDER:\nBET365 @ 1.95\nOpzioni consigliate:\nLOTTOMATICA OVER 11.5 + BET365 UNDER 11.5`;
}

function appRuntime(worker: PlaywrightBookmakerAutomationWorker): LocalNotifyHandlerRuntime {
  return composeLocalNotifyHandlerRuntime(worker, createWorkerExecutionPreflight(), { sourceUtcOffsetMinutes: 120, now: () => new Date("2026-09-13T09:45:00.000Z") });
}
function legId(runtime: LocalNotifyHandlerRuntime, bookmaker: BookmakerId): string {
  const leg = runtime.orchestrator.getState().legs?.find((candidate) => candidate.bookmaker === bookmaker);
  assert.ok(leg, `Expected ${bookmaker} leg.`);
  return leg.legId;
}

test("notification auto-starts separate SISAL/BET365 Chromium sessions to READY_FOR_USER", async () => {
  const launches: string[] = [];
  const worker = createFixtureAutomationWorker({ fixtures: { sisal: docs("sisal", "over", "2.08"), bet365: docs("bet365", "under", "1.95") }, navigationTimeoutMs: 2_000, onLaunch: (bookmaker) => launches.push(bookmaker) });
  const runtime = appRuntime(worker);
  try {
    const initial = await runtime.orchestrator.receiveNotification(canonicalNotification());
    assert.equal(initial.plan?.recommendedOptionId, "option-1");
    const state = await runtime.orchestrator.waitForIdle();
    assert.equal(state.status, "READY_FOR_USER");
    assert.deepEqual([...launches].sort(), ["bet365", "sisal"]);
    assert.deepEqual(state.legs?.map((leg) => leg.state), ["READY_FOR_USER", "READY_FOR_USER"]);
  } finally { await runtime.close(); }
});

test("one browser leg can fail safely while the other remains ready", async () => {
  const worker = createFixtureAutomationWorker({ fixtures: { sisal: docs("sisal", "over", "2.08"), bet365: docs("bet365", "under", "1.95", { marketContext: "goals" }) }, navigationTimeoutMs: 2_000 });
  const runtime = appRuntime(worker);
  try {
    await runtime.orchestrator.receiveNotification(canonicalNotification());
    const state = await runtime.orchestrator.waitForIdle();
    assert.equal(state.status, "PARTIAL");
    assert.equal(state.legs?.find((leg) => leg.bookmaker === "sisal")?.state, "READY_FOR_USER");
    const bet365 = state.legs?.find((leg) => leg.bookmaker === "bet365");
    assert.equal(bet365?.state, "FAILED_SAFE");
    assert.equal(bet365?.failure?.code, "MARKET_NOT_FOUND");
  } finally { await runtime.close(); }
});

test("manual-auth pause/resume is isolated to the affected browser leg", async () => {
  const worker = createFixtureAutomationWorker({ fixtures: { sisal: { [SISAL_URL]: [{ kind: "html", body: fixtureHtml("sisal", "over", "2.08", { auth: true }) }, { kind: "html", body: fixtureHtml("sisal", "over", "2.08") }] }, bet365: docs("bet365", "under", "1.95") }, navigationTimeoutMs: 2_000 });
  const runtime = appRuntime(worker);
  try {
    await runtime.orchestrator.receiveNotification(canonicalNotification());
    let state = await runtime.orchestrator.waitForIdle();
    const sisalId = legId(runtime, "sisal");
    assert.equal(state.legs?.find((leg) => leg.bookmaker === "sisal")?.state, "AUTH_REQUIRED");
    assert.equal(state.legs?.find((leg) => leg.bookmaker === "bet365")?.state, "READY_FOR_USER");
    state = await runtime.orchestrator.resumeAfterManualAuth(sisalId);
    assert.equal(state.status, "READY_FOR_USER");
    assert.equal(state.legs?.find((leg) => leg.bookmaker === "sisal")?.evidenceEpoch, 1);
  } finally { await runtime.close(); }
});

test("browser E2E carries price as informational telemetry without an acknowledgement action", async () => {
  const worker = createFixtureAutomationWorker({ fixtures: { sisal: docs("sisal", "over", "2.08"), bet365: docs("bet365", "under", "1.95") }, navigationTimeoutMs: 2_000 });
  const runtime = appRuntime(worker);
  try {
    await runtime.orchestrator.receiveNotification(canonicalNotification());
    const state = await runtime.orchestrator.waitForIdle();
    const sisal = state.legs?.find((leg) => leg.bookmaker === "sisal");
    assert.equal(sisal?.state, "READY_FOR_USER");
    assert.equal(sisal?.observedOdds?.observed, "2.08");
    assert.equal(state.status, "READY_FOR_USER");
    assert.equal("continueWithObservedOdds" in runtime.orchestrator, false);
  } finally { await runtime.close(); }
});

test("reopen replaces the failed browser session and uses a fresh attempt", async () => {
  const launches: string[] = [];
  const worker = createFixtureAutomationWorker({ fixtures: { sisal: [docs("sisal", "over", "2.08", { participantB: "Rayo Majadahonda" }), docs("sisal", "over", "2.08")], bet365: docs("bet365", "under", "1.95") }, navigationTimeoutMs: 2_000, onLaunch: (bookmaker) => launches.push(bookmaker) });
  const runtime = appRuntime(worker);
  try {
    await runtime.orchestrator.receiveNotification(canonicalNotification());
    let state = await runtime.orchestrator.waitForIdle();
    const sisalId = legId(runtime, "sisal");
    assert.equal(state.legs?.find((leg) => leg.bookmaker === "sisal")?.state, "FAILED_SAFE");
    state = await runtime.orchestrator.reopen(sisalId);
    assert.equal(state.legs?.find((leg) => leg.bookmaker === "sisal")?.state, "READY_FOR_USER");
    assert.equal(state.legs?.find((leg) => leg.bookmaker === "sisal")?.attemptNumber, 2);
    assert.equal(launches.filter((bookmaker) => bookmaker === "sisal").length, 2);
    assert.equal(state.legs?.find((leg) => leg.bookmaker === "bet365")?.state, "READY_FOR_USER");
  } finally { await runtime.close(); }
});

test("unsafe primary deep link fails preflight with zero browser starts", async () => {
  let launchCount = 0;
  const worker = createFixtureAutomationWorker({ fixtures: {}, onLaunch: () => { launchCount += 1; } });
  const runtime = appRuntime(worker);
  try {
    const state = await runtime.orchestrator.receiveNotification(canonicalNotification("https://evil.example/event", BET365_URL));
    assert.equal(state.status, "PREFLIGHT_FAILED");
    assert.equal(state.preflightFailure?.code, "UNSAFE_OR_UNSUPPORTED_URL");
    assert.equal(launchCount, 0);
  } finally { await runtime.close(); }
});

test("unsupported primary bookmaker fails preflight with zero browser starts", async () => {
  let launchCount = 0;
  const worker = createFixtureAutomationWorker({ fixtures: {}, onLaunch: () => { launchCount += 1; } });
  const runtime = appRuntime(worker);
  try {
    const state = await runtime.orchestrator.receiveNotification(unsupportedNotification());
    assert.equal(state.status, "PREFLIGHT_FAILED");
    assert.equal(state.preflightFailure?.code, "UNSUPPORTED_BOOKMAKER");
    assert.equal(launchCount, 0);
  } finally { await runtime.close(); }
});
