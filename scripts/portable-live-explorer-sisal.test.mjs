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
