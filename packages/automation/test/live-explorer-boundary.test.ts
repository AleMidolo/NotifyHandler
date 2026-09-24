import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertRequiredRelayMode,
  classifyPublicControl,
  runInteractiveLiveExplorer,
  sanitizeExplorerEvidencePath,
  sanitizeExplorerEvidenceText,
  type PublicControlDescriptor,
} from "../src/live-validation/interactive-explorer.ts";

const ADMIRAL_ORIGIN = "https://www.admiralbet.it";
const CURRENT_URL = `${ADMIRAL_ORIGIN}/scommesse`;

function descriptor(
  overrides: Partial<PublicControlDescriptor>,
): PublicControlDescriptor {
  return {
    tag: "button",
    label: "Mercati",
    currentUrl: CURRENT_URL,
    approvedOrigin: ADMIRAL_ORIGIN,
    childInteractiveCount: 0,
    ...overrides,
  };
}

test("interactive explorer allows only relevant same-origin public navigation", () => {
  assert.deepEqual(
    classifyPublicControl(
      descriptor({
        tag: "a",
        label: "Calcio",
        href: "/scommesse/calcio/event/123",
      }),
    ),
    {
      kind: "ALLOW",
      interaction: "NAVIGATION",
      reasonCode: "SAFE_SAME_ORIGIN_NAVIGATION",
      priority: 65,
    },
  );

  for (const href of [
    "https://example.com/scommesse/calcio/event/123",
    "https://user@www.admiralbet.it/scommesse/calcio/event/123",
    "http://www.admiralbet.it/scommesse/calcio/event/123",
  ]) {
    assert.deepEqual(
      classifyPublicControl(descriptor({ tag: "a", label: "Calcio", href })),
      { kind: "DENY", reasonCode: "UNAPPROVED_NAVIGATION" },
    );
  }

  assert.deepEqual(
    classifyPublicControl(
      descriptor({ tag: "a", label: "Termini", href: "/termini-condizioni" }),
    ),
    { kind: "DENY", reasonCode: "IRRELEVANT_NAVIGATION" },
  );
});

test("interactive explorer allows explicit public market expansion controls", () => {
  const expansion = classifyPublicControl(
    descriptor({
      label: "Altri mercati",
      ariaExpanded: "false",
      ariaControls: "market-panel-42",
    }),
  );
  assert.equal(expansion.kind, "ALLOW");
  if (expansion.kind === "ALLOW") {
    assert.equal(expansion.interaction, "EXPANSION");
    assert.equal(expansion.reasonCode, "SAFE_PUBLIC_EXPANSION");
  }

  const cornerTab = classifyPublicControl(
    descriptor({ tag: "role-tab", label: "Corner", role: "tab" }),
  );
  assert.equal(cornerTab.kind, "ALLOW");
});

test("interactive explorer rejects outcome and odds controls even when structurally clickable", () => {
  for (const input of [
    descriptor({ label: "Over 11.5 1.90", ariaControls: "selection" }),
    descriptor({ label: "Under 11.5", ariaExpanded: "false" }),
    descriptor({ label: "1.92" }),
    descriptor({ tag: "role-tab", label: "Over 2.5 1.88", role: "tab" }),
    descriptor({ label: "Esito vincente" }),
  ]) {
    assert.deepEqual(classifyPublicControl(input), {
      kind: "DENY",
      reasonCode: "OUTCOME_OR_ODDS_CONTROL",
    });
  }
});

test("interactive explorer defaults structurally clickable but semantically ambiguous tabs and summaries to deny", () => {
  for (const input of [
    descriptor({ tag: "role-tab", label: "1", role: "tab" }),
    descriptor({ tag: "role-tab", label: "X", role: "tab" }),
    descriptor({ tag: "role-tab", label: "Real Madrid", role: "tab" }),
    descriptor({ tag: "summary", label: "Selection", role: undefined }),
  ]) {
    assert.equal(
      classifyPublicControl(input).kind,
      "DENY",
      `ambiguous structural control must fail closed: ${input.label}`,
    );
  }
});

test("interactive explorer rejects auth, transaction, and consent controls", () => {
  const forbidden = [
    "Accedi",
    "Registrati",
    "Apri schedina",
    "Puntata 10 EUR",
    "Deposita",
    "Prelievo",
    "Cash out",
    "Conferma scommessa",
    "Scommetti",
    "Place bet",
  ];
  for (const label of forbidden) {
    assert.deepEqual(classifyPublicControl(descriptor({ label, ariaExpanded: "false" })), {
      kind: "DENY",
      reasonCode: "FORBIDDEN_CONTROL",
    });
  }

  assert.deepEqual(
    classifyPublicControl(descriptor({ label: "Preferenze cookie", ariaExpanded: "false" })),
    { kind: "DENY", reasonCode: "CONSENT_CONTROL" },
  );
});

test("interactive explorer defaults ambiguous controls to deny", () => {
  assert.deepEqual(classifyPublicControl(descriptor({ label: "Continua" })), {
    kind: "DENY",
    reasonCode: "AMBIGUOUS_CONTROL",
  });
});

test("interactive explorer redacts UUID-shaped identifiers from retained evidence", () => {
  const signalId = "d87c2b5a-7b46-4827-8ea5-45c0810aee7c";
  assert.equal(
    sanitizeExplorerEvidenceText(`Mercato ${signalId} corners`),
    "Mercato [uuid] corners",
  );
  assert.equal(
    sanitizeExplorerEvidencePath(
      `https://www.bet365.it/event/${signalId}/corners?source=relay`,
      "https://www.bet365.it",
    ),
    "/event/[uuid]/corners",
  );
});

test("interactive explorer rejects unsafe configuration before Chromium launch", async () => {
  await assert.rejects(
    runInteractiveLiveExplorer({
      bookmaker: "admiralbet",
      url: "https://example.com/scommesse",
    }),
    /only accepts credential-free HTTPS URLs/,
  );
  await assert.rejects(
    runInteractiveLiveExplorer({ bookmaker: "admiralbet", maxActions: 13 }),
    /maxActions must be an integer between 1 and 12/,
  );
  await assert.rejects(
    runInteractiveLiveExplorer({ bookmaker: "admiralbet", delayMs: 100 }),
    /delayMs must be an integer between 750 and 5000/,
  );
});

test("QA-required relay preflight rejects direct mode before Chromium launch", () => {
  assert.throws(
    () => assertRequiredRelayMode({ bookmaker: "bet365" }),
    /requires BETUP_RELAY navigation/u,
  );
  assert.throws(
    () => assertRequiredRelayMode({
      bookmaker: "bet365",
      url: "https://www.bet365.it/hub/it-it/football",
    }),
    /requires BETUP_RELAY navigation/u,
  );
  assert.throws(
    () => assertRequiredRelayMode({
      bookmaker: "bet365",
      relayUrl: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/sisal",
    }),
    /requires exact https:\/\/www\.bet-up\.it\/lnk\/.*\/bet365/u,
  );
  assert.doesNotThrow(
    () => assertRequiredRelayMode({
      bookmaker: "bet365",
      relayUrl: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/bet365",
    }),
  );
  assert.doesNotThrow(
    () => assertRequiredRelayMode({
      bookmaker: "sisal",
      relayUrl: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/sisal",
    }),
  );
});

test("relay-aware explorer rejects invalid relay grammar and bookmaker suffix before Chromium launch", async () => {
  await assert.rejects(
    runInteractiveLiveExplorer({
      bookmaker: "sisal",
      relayUrl: "https://www.bet-up.it/lnk/not-a-uuid/sisal",
    }),
    /requires exact https:\/\/www\.bet-up\.it\/lnk\/.*\/sisal/u,
  );
  await assert.rejects(
    runInteractiveLiveExplorer({
      bookmaker: "sisal",
      relayUrl: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/bet365",
    }),
    /requires exact https:\/\/www\.bet-up\.it\/lnk\/.*\/sisal/u,
  );
  await assert.rejects(
    runInteractiveLiveExplorer({
      bookmaker: "admiralbet",
      relayUrl: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/admiralbet",
    }),
    /restricted to SISAL and BET365/u,
  );
  await assert.rejects(
    runInteractiveLiveExplorer({
      bookmaker: "bet365",
      url: "https://www.bet365.it/hub/it-it/football",
      relayUrl: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/bet365",
    }),
    /either a bookmaker URL or a bet-up relay URL/u,
  );
});

test("interactive explorer source keeps the evidence collector outside sensitive browser capabilities", async () => {
  const source = await readFile(
    new URL("../src/live-validation/interactive-explorer.ts", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    ".fill(",
    ".type(",
    ".check(",
    ".selectOption(",
    ".setInputFiles(",
    ".cookies(",
    "storageState",
    "screenshot",
    "tracing",
    ".evaluate(",
  ]) {
    assert.equal(source.includes(forbidden), false, `unexpected sensitive capability token: ${forbidden}`);
  }

  const preflightCall = source.indexOf("assertRequiredRelayMode(options);");
  const explorerCall = source.indexOf("runInteractiveLiveExplorer(options);");
  assert.ok(preflightCall >= 0, "relay preflight call must exist");
  assert.ok(explorerCall > preflightCall, "relay preflight must run before explorer/browser launch");

  assert.match(source, /chromium\.launch\(\{ headless: false \}\)/);
  assert.match(source, /const MAX_ACTIONS = 12/);
  assert.match(source, /const MIN_DELAY_MS = 750/);
  assert.match(source, /new NavigationPolicy\(\[approvedOrigin\]\)/);
  assert.match(source, /createWorkerPageRuntime\(/);
  assert.match(source, /runtime\.resolveRelay\(/);
  assert.match(source, /relayInvalidCategory: resolution\.invalidCategory/);
  assert.doesNotMatch(source, /resolution\.message/);
  assert.match(source, /relayOrigin: BETUP_RELAY_ORIGIN/);
  assert.match(source, /\[bet-up-relay\]/);
  assert.equal(source.includes("signalId:"), false);
  assert.match(source, /isInternalHostname\(parsed\.hostname\)/);
  assert.match(source, /authorizesProductionMapping: false/);
});

test("interactive explorer must not click navigation anchors because page handlers can mutate betting state", async () => {
  const source = await readFile(
    new URL("../src/live-validation/interactive-explorer.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /revalidated\.decision\.interaction === "NAVIGATION"/);
  assert.match(source, /page\.goto\(/);
});
