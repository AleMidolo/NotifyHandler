import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BOOK_024_TARGETS,
  isApprovedPassiveFinalRoute,
  parseApprovedPassiveTarget,
  parseBook024Bookmaker,
  sanitizePassiveEvidenceText,
} from "../src/live-validation/target-aware-passive-probe.ts";
import {
  PASSIVE_DIAGNOSTIC_SCHEMA_VERSION,
  PASSIVE_TARGET_PRESENCE_KEYS,
  domPopulationBucket,
  ordinaryTransportProvenance,
  readinessProvenance,
  retainFirstTransportProvenance,
  validatePassiveDiagnosticSummary,
  webSocketTransportProvenance,
} from "../src/live-validation/passive-diagnostic-provenance.ts";

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

test("BOOK-024 final route must remain the exact source-locked direct target", () => {
  assert.equal(
    isApprovedPassiveFinalRoute("bet365", BOOK_024_TARGETS.bet365.url),
    true,
  );
  assert.equal(
    isApprovedPassiveFinalRoute(
      "bet365",
      "https://www.bet365.it/",
    ),
    false,
  );
  assert.equal(
    isApprovedPassiveFinalRoute(
      "bet365",
      "https://www.bet365.it/#/AC/B1/C1/D8/E201149500/F3/I1/",
    ),
    false,
  );
  assert.equal(
    isApprovedPassiveFinalRoute("sisal", BOOK_024_TARGETS.sisal.url),
    true,
  );
  assert.equal(
    isApprovedPassiveFinalRoute(
      "sisal",
      "https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/",
    ),
    false,
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
  assert.match(source, /ordinaryTransportProvenance\(\s*parsed\.protocol/);
  assert.match(source, /context\.routeWebSocket\("\*\*\/\*"/);

  const provenanceSource = await readFile(
    new URL("../src/live-validation/passive-diagnostic-provenance.ts", import.meta.url),
    "utf8",
  );
  assert.match(provenanceSource, /\["data:", "blob:", "about:"\]\.includes\(protocol\)/);
  assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
  assert.match(source, /failed safely before a sanitized summary could be produced/);
  assert.doesNotMatch(source, /url\?: string/);
  assert.doesNotMatch(source, /headless\?: boolean/);
  assert.match(source, /intentionally disabled in CI/);
});


function blockedSummary(transportProvenance: unknown): Record<string, unknown> {
  return {
    diagnosticSchemaVersion: PASSIVE_DIAGNOSTIC_SCHEMA_VERSION,
    bookmaker: "bet365",
    approvedOrigin: "https://www.bet365.it",
    navigationKind: "BOOKMAKER_DIRECT",
    requestedPath: "/",
    finalPath: "/",
    requestedFragmentPresent: true,
    fragmentPreserved: true,
    status: "BLOCKED",
    blockReason: "PRIVATE_OR_INTERNAL_DESTINATION",
    target: {
      participantA: "Portogallo",
      participantB: "Galles",
      competition: "Nations League",
      scheduledDate: "24/09/2026",
      scheduledTime: "20:45",
      marketPeriod: "full_match",
      marketContext: "total_corners",
      line: "6.5",
      side: "OVER",
      expectedOdds: "1.14",
    },
    transportProvenance,
    authorizesProductionMapping: false,
    note: "Passive direct-page diagnostic stopped at the existing browser/network boundary. No target evidence was retained from an unsafe navigation state.",
  };
}

function completeSummary(): Record<string, unknown> {
  const signal = { observed: false, snippets: [] };
  const targetPresence = Object.fromEntries(
    PASSIVE_TARGET_PRESENCE_KEYS.map((key) => [
      key,
      { domPresent: false, visibleObservedWithinBound: false },
    ]),
  );
  return {
    diagnosticSchemaVersion: PASSIVE_DIAGNOSTIC_SCHEMA_VERSION,
    bookmaker: "sisal",
    approvedOrigin: "https://www.sisal.it",
    navigationKind: "BOOKMAKER_DIRECT",
    requestedPath: "/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles",
    finalPath: "/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles",
    requestedFragmentPresent: false,
    fragmentPreserved: true,
    status: "COMPLETE",
    target: {
      participantA: "Portogallo",
      participantB: "Galles",
      competition: "Nations League",
      scheduledDate: "24/09/2026",
      scheduledTime: "20:45",
      marketPeriod: "full_match",
      marketContext: "total_corners",
      line: "6.5",
      side: "UNDER",
      expectedOdds: "4.25",
    },
    transportProvenance: { state: "CLEAR" },
    renderProvenance: {
      readiness: "DOMCONTENTLOADED_CONFIRMED",
      titlePredicates: { participantPair: false, competition: false },
      targetPresence,
      domPopulation: "EMPTY",
    },
    evidence: {
      participantA: signal,
      participantB: signal,
      competition: signal,
      scheduledDate: signal,
      scheduledTime: signal,
      broadCornerContext: signal,
      totalCornersMarket: signal,
      fullMatchContext: signal,
      exactLine: signal,
      requestedSideAtLine: signal,
      expectedOdds: signal,
      displayedOddsCandidates: [],
      dimensionsObserved: {
        event: false,
        competition: false,
        scheduledTime: false,
        totalCornersMarket: false,
        fullMatchPeriod: false,
        exactLine: false,
        requestedSide: false,
        displayedOdds: false,
      },
      requiredChainObserved: false,
    },
    authorizesProductionMapping: false,
    note: "Target-aware evidence and passive provenance are bounded, sanitized, diagnostic only, and never authorize production mapping or outcome activation.",
  };
}

test("passive-provenance.v1 transport categories are finite and redact destinations", () => {
  assert.deepEqual(
    ordinaryTransportProvenance("https:", true, true),
    { state: "CLEAR" },
  );
  assert.deepEqual(
    ordinaryTransportProvenance("https:", true, false),
    { state: "BLOCKED", trigger: "PUBLIC_HTTPS_TARGET_REJECTED", scope: "TOP_LEVEL" },
  );
  assert.deepEqual(
    ordinaryTransportProvenance("https:", true, undefined),
    { state: "BLOCKED", trigger: "PUBLIC_HTTPS_TARGET_REJECTED", scope: "TOP_LEVEL" },
  );
  assert.deepEqual(
    ordinaryTransportProvenance("https:", false, false),
    { state: "BLOCKED", trigger: "PUBLIC_HTTPS_TARGET_REJECTED", scope: "SUBRESOURCE" },
  );
  assert.deepEqual(
    ordinaryTransportProvenance("http:", true, undefined),
    { state: "BLOCKED", trigger: "DISALLOWED_PROTOCOL", scope: "TOP_LEVEL" },
  );
  assert.deepEqual(
    ordinaryTransportProvenance("ftp:", false, undefined),
    { state: "BLOCKED", trigger: "DISALLOWED_PROTOCOL", scope: "SUBRESOURCE" },
  );
  assert.deepEqual(
    webSocketTransportProvenance(),
    { state: "BLOCKED", trigger: "WEBSOCKET_ATTEMPT", scope: "SOCKET" },
  );

  const serialized = JSON.stringify([
    ordinaryTransportProvenance("https:", false, false),
    ordinaryTransportProvenance("http:", true, undefined),
    webSocketTransportProvenance(),
  ]);
  for (const forbidden of ["example.internal", "127.0.0.1", "/private/path", "http:", "wss:"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("passive-provenance.v1 retains only the first transport trigger", () => {
  const clear = { state: "CLEAR" } as const;
  const first = ordinaryTransportProvenance("https:", false, false);
  const later = webSocketTransportProvenance();
  assert.deepEqual(retainFirstTransportProvenance(clear, first), first);
  assert.deepEqual(retainFirstTransportProvenance(first, later), first);
  assert.deepEqual(retainFirstTransportProvenance(first, clear), first);
});

test("passive-provenance.v1 readiness and DOM population buckets are fixed", () => {
  assert.equal(readinessProvenance(true), "DOMCONTENTLOADED_CONFIRMED");
  assert.equal(readinessProvenance(false), "DOMCONTENTLOADED_NOT_CONFIRMED");
  assert.equal(domPopulationBucket(0), "EMPTY");
  assert.equal(domPopulationBucket(1), "SPARSE");
  assert.equal(domPopulationBucket(31), "SPARSE");
  assert.equal(domPopulationBucket(32), "POPULATED");
  assert.throws(() => domPopulationBucket(-1), /non-negative integer/);
});

test("passive-provenance.v1 validates the explicit retained-summary allowlist", () => {
  const validBlocked = blockedSummary(webSocketTransportProvenance());
  assert.doesNotThrow(() => validatePassiveDiagnosticSummary(validBlocked));
  assert.throws(
    () => validatePassiveDiagnosticSummary({ ...validBlocked, destinationHost: "example.internal" }),
    /unknown field/,
  );
  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...validBlocked,
      diagnosticSchemaVersion: "passive-provenance.v2",
    }),
    /unknown enum value/,
  );
  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...validBlocked,
      transportProvenance: { state: "BLOCKED", trigger: "OTHER", scope: "SOCKET" },
    }),
    /unknown enum value/,
  );
  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...validBlocked,
      note: "browser error: destination example.internal failed",
    }),
    /unknown enum value/,
  );
});

test("passive-provenance.v1 rejects contradictory or expanded render provenance", () => {
  const valid = completeSummary();
  assert.doesNotThrow(() => validatePassiveDiagnosticSummary(valid));

  const render = structuredClone(valid.renderProvenance as Record<string, unknown>);
  const targetPresence = render.targetPresence as Record<string, Record<string, unknown>>;
  targetPresence.participantA = {
    domPresent: false,
    visibleObservedWithinBound: true,
  };
  assert.throws(
    () => validatePassiveDiagnosticSummary({ ...valid, renderProvenance: render }),
    /cannot be visible when absent/,
  );

  const expanded = structuredClone(valid.renderProvenance as Record<string, unknown>);
  (expanded.titlePredicates as Record<string, unknown>).rawTitle = "Portogallo Galles";
  assert.throws(
    () => validatePassiveDiagnosticSummary({ ...valid, renderProvenance: expanded }),
    /unknown field/,
  );

  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...valid,
      transportProvenance: webSocketTransportProvenance(),
    }),
    /COMPLETE summary requires CLEAR transport provenance/,
  );
});

test("BOOK-026 source keeps timing/action boundaries while adding versioned non-authorizing provenance", async () => {
  const source = await readFile(
    new URL("../src/live-validation/target-aware-passive-probe.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /PASSIVE_DIAGNOSTIC_SCHEMA_VERSION/);
  assert.match(source, /transportProvenance/);
  assert.match(source, /renderProvenance/);
  assert.match(source, /const NAVIGATION_TIMEOUT_MS = 20_000/);
  assert.match(source, /const READINESS_DELAY_MS = 1_000/);
  assert.doesNotMatch(source, /networkidle/);
  assert.doesNotMatch(source, /\.click\(/);
  assert.doesNotMatch(source, /\.fill\(/);
  assert.doesNotMatch(source, /\.type\(/);
  assert.doesNotMatch(source, /\.evaluate\(/);
  assert.match(source, /authorizesProductionMapping: false/);
});
