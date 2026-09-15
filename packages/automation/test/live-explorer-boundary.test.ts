import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifyPublicControl,
  runInteractiveLiveExplorer,
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

  assert.match(source, /chromium\.launch\(\{ headless: false \}\)/);
  assert.match(source, /const MAX_ACTIONS = 12/);
  assert.match(source, /const MIN_DELAY_MS = 750/);
  assert.match(source, /new NavigationPolicy\(\[target\.origin\]\)/);
  assert.match(source, /isInternalHostname\(parsed\.hostname\)/);
  assert.match(source, /authorizesProductionMapping: false/);
  assert.match(source, /next\.locator\.click\(\{ timeout: 5_000 \}\)/);
});
