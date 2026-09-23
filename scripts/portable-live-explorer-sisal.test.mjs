import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { windowsLauncherText } from "./build-sisal-live-validation-bundle.mjs";
import {
  PORTABLE_APPROVED_ORIGIN,
  PORTABLE_BOOKMAKER,
  PORTABLE_NODE_VERSION,
  PORTABLE_PLAYWRIGHT_VERSION,
  PORTABLE_START_PATH,
  assertPortableNonCiEnvironment,
  buildPortableExplorerEnvironment,
  parsePortableArguments,
  validatePortableExplorerSummary,
} from "./portable-live-explorer-sisal.mjs";

test("portable runner only exposes live SISAL mode and synthetic smoke", () => {
  assert.equal(parsePortableArguments([]), "live");
  assert.equal(parsePortableArguments(["--synthetic-smoke"]), "synthetic-smoke");

  for (const args of [
    ["admiralbet"],
    ["sisal"],
    ["bet365"],
    ["--bookmaker=sisal"],
    ["--bookmaker=admiralbet"],
    ["--bookmaker=bet365"],
    ["--url=https://www.admiralbet.it"],
    ["--url=https://www.bet365.it"],
    ["--url=https://example.com"],
    ["--synthetic-smoke", "extra"],
  ]) {
    assert.throws(() => parsePortableArguments(args), /locked to SISAL/i);
  }
});

test("portable live mode refuses common CI environments", () => {
  for (const [name, value] of [
    ["CI", "true"],
    ["GITHUB_ACTIONS", "1"],
    ["TF_BUILD", "yes"],
    ["JENKINS_URL", "https://ci.invalid"],
  ]) {
    assert.throws(() => assertPortableNonCiEnvironment({ [name]: value }), /disabled in CI/i);
  }

  assert.doesNotThrow(() =>
    assertPortableNonCiEnvironment({ CI: "false", GITHUB_ACTIONS: "0", CIRCLECI: "no" }),
  );
});

test("portable child environment locks bookmaker, browser path, and removes explorer overrides", () => {
  const bundleRoot = join("C:", "notifyhandler-book012");
  const environment = buildPortableExplorerEnvironment(
    {
      NH_LIVE_EXPLORER_BOOKMAKER: "admiralbet",
      NH_LIVE_EXPLORER_URL: "https://example.com",
      NH_LIVE_EXPLORER_RELAY_URL: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/sisal",
      NH_LIVE_EXPLORER_MAX_ACTIONS: "12",
      NH_LIVE_EXPLORER_DELAY_MS: "750",
      PLAYWRIGHT_BROWSERS_PATH: "C:\\other-browser",
      NODE_OPTIONS: "--inspect",
      KEEP_ME: "yes",
    },
    bundleRoot,
  );

  assert.equal(environment.NH_LIVE_EXPLORER_BOOKMAKER, PORTABLE_BOOKMAKER);
  assert.equal(environment.PLAYWRIGHT_BROWSERS_PATH, join(bundleRoot, "browsers"));
  assert.equal(environment.KEEP_ME, "yes");
  assert.equal(environment.NH_LIVE_EXPLORER_URL, undefined);
  assert.equal(environment.NH_LIVE_EXPLORER_RELAY_URL, "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/sisal");
  assert.equal(environment.NH_LIVE_EXPLORER_MAX_ACTIONS, undefined);
  assert.equal(environment.NH_LIVE_EXPLORER_DELAY_MS, undefined);
  assert.equal(environment.NODE_OPTIONS, undefined);
});

test("Windows launcher exposes no alternate bookmaker or origin selector", () => {
  const launcher = windowsLauncherText();
  assert.match(launcher, /portable-live-explorer\.mjs/);
  assert.doesNotMatch(launcher, /https?:\/\//i);
  assert.doesNotMatch(launcher, /\b(?:admiralbet|bet365)\b/i);
  assert.doesNotMatch(launcher, /NH_LIVE_EXPLORER_(?:BOOKMAKER|URL|MAX_ACTIONS|DELAY_MS)/i);
});

test("portable summary validator only accepts sanitized SISAL BOOK-012 summaries", () => {
  const base = {
    bookmaker: PORTABLE_BOOKMAKER,
    navigationKind: "BOOKMAKER_DIRECT",
    approvedOrigin: PORTABLE_APPROVED_ORIGIN,
    startPath: PORTABLE_START_PATH,
    finalPath: "/scommesse/calcio",
    status: "COMPLETE",
    actionBudget: 10,
    actionsTaken: 2,
    snapshots: [],
    actions: [],
    authorizesProductionMapping: false,
    note: "Sanitized evidence only.",
  };

  assert.deepEqual(validatePortableExplorerSummary(JSON.stringify(base)), base);
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...base,
      blockReason: "RELAY_UNRESOLVED",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...base,
      status: "BLOCKED",
    })),
    /boundary validation/i,
  );

  const relaySummary = {
    ...base,
    navigationKind: "BETUP_RELAY",
    relayOrigin: "https://www.bet-up.it",
    startPath: "/resolved/event/123",
  };
  assert.deepEqual(validatePortableExplorerSummary(JSON.stringify(relaySummary)), relaySummary);

  const invalidRelaySummary = {
    ...relaySummary,
    startPath: "[bet-up-relay]",
    finalPath: "[relay-unresolved]",
    status: "BLOCKED",
    blockReason: "RELAY_INVALID",
    relayInvalidCategory: "TOP_LEVEL_METHOD",
    actionsTaken: 0,
    snapshots: [],
    actions: [],
  };
  const sanitizedRelayFailure = {
    ...sanitizedRelayFailure,
    note: "Relay-aware explorer stopped safely during the shared restricted resolver phase. No relay signal identifier or full relay URL is included in this summary.",
  };
  assert.deepEqual(validatePortableExplorerSummary(JSON.stringify(sanitizedRelayFailure)), sanitizedRelayFailure);
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...sanitizedRelayFailure,
      note: "Internal resolver message: rejected /secret/path",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...sanitizedRelayFailure,
      resolverMessage: "raw rejected path or internal diagnostic",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...sanitizedRelayFailure,
      rawRedirectTarget: "https://example.invalid/secret-path?token=secret",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...sanitizedRelayFailure,
      status: "COMPLETE",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...sanitizedRelayFailure,
      startPath: "/resolved/event/123",
      finalPath: "/event",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...relaySummary,
      status: "BLOCKED",
      blockReason: "RELAY_REDIRECT_LIMIT",
      startPath: "/resolved/event/123",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...sanitizedRelayFailure,
      relayInvalidCategory: undefined,
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...base,
      status: "BLOCKED",
      blockReason: "RELAY_INVALID",
      relayInvalidCategory: "TOP_LEVEL_METHOD",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...sanitizedRelayFailure,
      relayInvalidCategory: "RAW_PATH_/secret",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...relaySummary,
      relayInvalidCategory: "TOP_LEVEL_METHOD",
      blockReason: "RELAY_REDIRECT_LIMIT",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({ ...relaySummary, signalId: "secret-signal" })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({ ...relaySummary, relayUrl: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/sisal" })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...relaySummary,
      note: "Leaked relay id 11111111-2222-4333-8444-555555555555",
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({
      ...relaySummary,
      actions: [{ sequence: 1, interaction: "NAVIGATION", label: "Corner", beforePath: "/11111111-2222-4333-8444-555555555555", afterPath: "/event" }],
    })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({ ...base, bookmaker: "admiralbet" })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({ ...base, approvedOrigin: "https://example.com" })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({ ...base, authorizesProductionMapping: true })),
    /boundary validation/i,
  );
  assert.throws(
    () => validatePortableExplorerSummary(JSON.stringify({ ...base, actionBudget: 13 })),
    /boundary validation/i,
  );
});

test("portable embedded runtime pins match repository source-of-truth pins", async () => {
  const [nodePin, automationPackage] = await Promise.all([
    readFile(new URL("../.nvmrc", import.meta.url), "utf8"),
    readFile(new URL("../packages/automation/package.json", import.meta.url), "utf8").then(JSON.parse),
  ]);

  assert.equal(PORTABLE_NODE_VERSION, nodePin.trim());
  assert.equal(PORTABLE_PLAYWRIGHT_VERSION, automationPackage.dependencies["playwright-core"]);
  assert.equal(PORTABLE_BOOKMAKER, "sisal");
  assert.equal(PORTABLE_APPROVED_ORIGIN, "https://www.sisal.it");
  assert.equal(PORTABLE_START_PATH, "/scommesse-matchpoint/sport/calcio");
});
