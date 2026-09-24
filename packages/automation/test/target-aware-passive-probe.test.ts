import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BOOK_024_TARGETS,
  parseApprovedPassiveTarget,
  parseBook024Bookmaker,
  sanitizePassiveEvidenceText,
} from "../src/live-validation/target-aware-passive-probe.ts";

test("BOOK-024 source-locks authoritative direct targets and preserves BET365 fragment input", () => {
  assert.equal(
    BOOK_024_TARGETS.bet365.url,
    "https://www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/",
  );
  assert.equal(
    new URL(BOOK_024_TARGETS.bet365.url).hash,
    "#/AC/B1/C1/D8/E201149499/F3/I1/",
  );
  assert.equal(
    BOOK_024_TARGETS.sisal.url,
    "https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles",
  );
});

test("BOOK-024 rejects unsafe direct targets before browser launch", () => {
  for (const url of [
    "http://www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/",
    "https://user:secret@www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/",
    "https://example.com/#/AC/B1/C1/D8/E201149499/F3/I1/",
    "https://www.bet365.it/#/AC/B1/C1/D8/E201149500/F3/I1/",
    "https://www.bet365.it/",
  ]) {
    assert.throws(
      () => parseApprovedPassiveTarget("bet365", url),
      /exact source-locked credential-free HTTPS target/,
    );
  }
  assert.doesNotThrow(() =>
    parseApprovedPassiveTarget("bet365", BOOK_024_TARGETS.bet365.url),
  );
});

test("BOOK-024 CLI accepts only one target bookmaker", () => {
  assert.equal(parseBook024Bookmaker(["bet365"]), "bet365");
  assert.equal(parseBook024Bookmaker(["sisal"]), "sisal");
  for (const args of [[], ["admiralbet"], ["bet365", "sisal"]]) {
    assert.throws(() => parseBook024Bookmaker(args), /live:probe:book024/);
  }
});

test("BOOK-024 evidence sanitizer bounds and redacts risky generic tokens", () => {
  const uuid = "11111111-2222-4333-8444-555555555555";
  const sanitized = sanitizePassiveEvidenceText(
    "Portogallo " + uuid +
      " person@example.com https://example.com/path ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 corners",
  );
  assert.equal(sanitized.includes(uuid), false);
  assert.equal(sanitized.includes("person@example.com"), false);
  assert.equal(sanitized.includes("https://example.com/path"), false);
  assert.match(sanitized, /\[uuid\]/);
  assert.match(sanitized, /\[email\]/);
  assert.match(sanitized, /\[url\]/);
  assert.ok(sanitized.length <= 220);
});

test("BOOK-024 probe source is passive, non-authorizing, bounded, and retains no full-page artifact", async () => {
  const source = await readFile(
    new URL("../src/live-validation/target-aware-passive-probe.ts", import.meta.url),
    "utf8",
  );

  for (const forbidden of [
    ".click(",
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
    "page.content(",
    "locator(\"body\").innerText",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      "unexpected capability/artifact token: " + forbidden,
    );
  }

  assert.match(source, /const NAVIGATION_TIMEOUT_MS = 20_000/);
  assert.match(source, /const READINESS_DELAY_MS = 1_000/);
  assert.match(source, /const MAX_SIGNAL_MATCHES = 3/);
  assert.match(source, /const MAX_SNIPPET_LENGTH = 220/);
  assert.match(source, /authorizesProductionMapping: false/);
  assert.match(source, /assertNonCiEnvironment\(\);[\s\S]*chromium\.launch\(\{ headless: false \}\)/);
  assert.match(source, /acceptDownloads: false/);
  assert.match(source, /serviceWorkers: "block"/);
  assert.match(source, /parsed\.href !== lockedUrl/);
  assert.match(source, /isResolvedPublicHttpsTarget\(parsed\.href\)/);
  assert.match(source, /context\.routeWebSocket\("\*\*\/\*"/);
  assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
  assert.match(source, /failed safely before a sanitized summary could be produced/);
  assert.doesNotMatch(source, /url\?: string/);
  assert.doesNotMatch(source, /headless\?: boolean/);
  assert.match(source, /intentionally disabled in CI/);
});
