import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExactVersion,
  assertNonCiEnvironment,
  assertRelayDiagnosticRunnerPreflight,
  originForBookmaker,
  parseRunnerBookmaker,
  npmVersionInvocation,
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

test("local relay diagnostic preflight fails closed before network prerequisites", () => {
  assert.throws(
    () => assertRelayDiagnosticRunnerPreflight("bet365", { NH_LIVE_EXPLORER_REQUIRE_RELAY: "1" }),
    /requires NH_LIVE_EXPLORER_RELAY_URL before any browser\/network activity/i,
  );
  assert.throws(
    () => assertRelayDiagnosticRunnerPreflight("bet365", {
      NH_LIVE_EXPLORER_REQUIRE_RELAY: "1",
      NH_LIVE_EXPLORER_URL: "https://www.bet365.it/hub/it-it/football",
      NH_LIVE_EXPLORER_RELAY_URL: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/bet365",
    }),
    /forbids NH_LIVE_EXPLORER_URL/i,
  );
  assert.throws(
    () => assertRelayDiagnosticRunnerPreflight("bet365", {
      NH_LIVE_EXPLORER_REQUIRE_RELAY: "1",
      NH_LIVE_EXPLORER_RELAY_URL: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/sisal",
    }),
    /canonical BETUP_RELAY input for bet365/i,
  );
  assert.doesNotThrow(
    () => assertRelayDiagnosticRunnerPreflight("bet365", {
      NH_LIVE_EXPLORER_REQUIRE_RELAY: "1",
      NH_LIVE_EXPLORER_RELAY_URL: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/bet365",
    }),
  );
  assert.doesNotThrow(() => assertRelayDiagnosticRunnerPreflight("bet365", {}));
});

test("local live explorer runner keeps bookmaker origins hard-coded", () => {
  assert.equal(originForBookmaker("admiralbet"), "https://www.admiralbet.it");
  assert.equal(originForBookmaker("sisal"), "https://www.sisal.it");
  assert.equal(originForBookmaker("bet365"), "https://www.bet365.it");
  assert.throws(() => originForBookmaker("example"), /Unsupported bookmaker/);
});


test("local live explorer runner invokes npm through cmd.exe on Windows", () => {
  assert.deepEqual(
    npmVersionInvocation("win32", { ComSpec: "C:\\Windows\\System32\\cmd.exe" }),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd --version"],
    },
  );
  assert.deepEqual(npmVersionInvocation("linux", {}), {
    command: "npm",
    args: ["--version"],
  });
});
