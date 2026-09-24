import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOK_023_TARGETS,
  buildBook023Environment,
  parseBook023Bookmaker,
} from "./run-book-023-direct-validation.mjs";
import { assertDirectDiagnosticRunnerPreflight } from "./run-live-explorer.mjs";

test("BOOK-023 runner is locked to BET365 and SISAL", () => {
  assert.equal(parseBook023Bookmaker(["bet365"]), "bet365");
  assert.equal(parseBook023Bookmaker(["sisal"]), "sisal");
  for (const args of [[], ["admiralbet"], ["bet365", "sisal"]]) {
    assert.throws(() => parseBook023Bookmaker(args), /live:book023:local/);
  }
});

test("BOOK-023 authoritative direct URLs are exact and preserve BET365 fragment routing", () => {
  assert.equal(
    BOOK_023_TARGETS.bet365.url,
    "https://www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/",
  );
  assert.equal(
    new URL(BOOK_023_TARGETS.bet365.url).hash,
    "#/AC/B1/C1/D8/E201149499/F3/I1/",
  );
  assert.equal(
    BOOK_023_TARGETS.sisal.url,
    "https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles",
  );
  assert.equal(new URL(BOOK_023_TARGETS.sisal.url).origin, "https://www.sisal.it");
});

test("BOOK-023 runner forces direct-only navigation and default bounded explorer settings", () => {
  const environment = buildBook023Environment(
    {
      NH_LIVE_EXPLORER_RELAY_URL: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/bet365",
      NH_LIVE_EXPLORER_REQUIRE_RELAY: "1",
      NH_LIVE_EXPLORER_MAX_ACTIONS: "12",
      NH_LIVE_EXPLORER_DELAY_MS: "750",
      KEEP_ME: "yes",
    },
    "bet365",
  );

  assert.equal(environment.NH_LIVE_EXPLORER_REQUIRE_DIRECT, "1");
  assert.equal(environment.NH_LIVE_EXPLORER_URL, BOOK_023_TARGETS.bet365.url);
  assert.equal(environment.NH_LIVE_EXPLORER_RELAY_URL, undefined);
  assert.equal(environment.NH_LIVE_EXPLORER_REQUIRE_RELAY, undefined);
  assert.equal(environment.NH_LIVE_EXPLORER_MAX_ACTIONS, undefined);
  assert.equal(environment.NH_LIVE_EXPLORER_DELAY_MS, undefined);
  assert.equal(environment.KEEP_ME, "yes");
});

test("direct-required preflight fails before browser/network activity on missing or unsafe targets", () => {
  assert.throws(
    () => assertDirectDiagnosticRunnerPreflight("bet365", { NH_LIVE_EXPLORER_REQUIRE_DIRECT: "1" }),
    /generic homepage fallback is forbidden/i,
  );
  assert.throws(
    () => assertDirectDiagnosticRunnerPreflight("bet365", {
      NH_LIVE_EXPLORER_REQUIRE_DIRECT: "1",
      NH_LIVE_EXPLORER_URL: "https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles",
    }),
    /requires credential-free HTTPS navigation on https:\/\/www\.bet365\.it/i,
  );
  assert.throws(
    () => assertDirectDiagnosticRunnerPreflight("sisal", {
      NH_LIVE_EXPLORER_REQUIRE_DIRECT: "1",
      NH_LIVE_EXPLORER_URL: "https://user:pass@www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles",
    }),
    /requires credential-free HTTPS navigation/i,
  );
  assert.throws(
    () => assertDirectDiagnosticRunnerPreflight("bet365", {
      NH_LIVE_EXPLORER_REQUIRE_DIRECT: "1",
      NH_LIVE_EXPLORER_REQUIRE_RELAY: "1",
      NH_LIVE_EXPLORER_URL: BOOK_023_TARGETS.bet365.url,
    }),
    /cannot be combined with relay-required mode/i,
  );
  assert.doesNotThrow(
    () => assertDirectDiagnosticRunnerPreflight("bet365", buildBook023Environment({}, "bet365")),
  );
  assert.doesNotThrow(
    () => assertDirectDiagnosticRunnerPreflight("sisal", buildBook023Environment({}, "sisal")),
  );
});
