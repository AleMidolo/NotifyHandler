import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExactVersion,
  assertNonCiEnvironment,
  originForBookmaker,
  parseRunnerBookmaker,
} from "./run-live-explorer.mjs";

test("local live explorer runner accepts only one supported bookmaker", () => {
  assert.equal(parseRunnerBookmaker(["admiralbet"]), "admiralbet");
  assert.equal(parseRunnerBookmaker(["sisal"]), "sisal");
  assert.equal(parseRunnerBookmaker(["bet365"]), "bet365");

  for (const args of [[], ["unknown"], ["admiralbet", "sisal"]]) {
    assert.throws(() => parseRunnerBookmaker(args), /Usage: npm run live:explore:local/);
  }
});

test("local live explorer runner fails closed in CI environments", () => {
  for (const signal of ["CI", "GITHUB_ACTIONS", "TF_BUILD", "BUILD_BUILDID", "JENKINS_URL", "BUILDKITE", "CIRCLECI"]) {
    assert.throws(
      () => assertNonCiEnvironment({ [signal]: "true" }),
      /intentionally disabled in CI/,
    );
  }

  assert.doesNotThrow(() => assertNonCiEnvironment({ CI: "false", GITHUB_ACTIONS: "0" }));
  assert.doesNotThrow(() => assertNonCiEnvironment({}));
});

test("local live explorer runner requires exact repository toolchain versions", () => {
  assert.doesNotThrow(() => assertExactVersion("Node.js", "v24.21.0", "24.21.0"));
  assert.doesNotThrow(() => assertExactVersion("npm", "11.19.0", "11.19.0"));
  assert.throws(() => assertExactVersion("Node.js", "24.22.0", "24.21.0"), /24\.21\.0 is required/);
  assert.throws(() => assertExactVersion("npm", "11.20.0", "11.19.0"), /11\.19\.0 is required/);
});

test("local live explorer runner keeps bookmaker origins hard-coded", () => {
  assert.equal(originForBookmaker("admiralbet"), "https://www.admiralbet.it");
  assert.equal(originForBookmaker("sisal"), "https://www.sisal.it");
  assert.equal(originForBookmaker("bet365"), "https://www.bet365.it");
  assert.throws(() => originForBookmaker("example"), /Unsupported bookmaker/);
});
