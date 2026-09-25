import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BOOK_024_TARGETS,
  isApprovedPassiveFinalRoute,
  parseApprovedPassiveTarget,
  parseBook024Bookmaker,
  sanitizePassiveEvidenceText,
  summarizePreLoadNavigationBlock,
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
import {
  PASSIVE_DIAGNOSTIC_SCHEMA_VERSION_V2,
  allowedReviewedWebSocketObserved,
  blockedWebSocketTransportProvenanceV2,
  initialTransportProvenanceV2,
  ordinaryTransportProvenanceV2,
  retainTransportProvenanceV2,
  validatePassiveDiagnosticSummaryV2,
} from "../src/live-validation/passive-diagnostic-provenance-v2.ts";

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
  assert.match(source, /ordinaryTransportProvenanceV2\(\s*parsed\.protocol/);
  assert.match(source, /context\.routeWebSocket\("\*\*\/\*"/);

  const provenanceSource = await readFile(
    new URL("../src/live-validation/passive-diagnostic-provenance-v2.ts", import.meta.url),
    "utf8",
  );
  assert.match(provenanceSource, /\["data:", "blob:", "about:"\]\.includes\(protocol\)/);
  assert.match(source, /createBookmakerNetworkPolicy/);
  assert.match(source, /evaluateWebSocket\(/);
  assert.match(source, /socket\.connectToServer\(\)/);
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

test("passive-provenance.v2 preserves top-level transport provenance when navigation aborts before load", () => {
  const publicTargetRejected = summarizePreLoadNavigationBlock(
    "bet365",
    ordinaryTransportProvenanceV2("https:", true, false),
    "PRIVATE_OR_INTERNAL_DESTINATION",
  );
  assert.ok(publicTargetRejected);
  assert.equal(publicTargetRejected.diagnosticSchemaVersion, "passive-provenance.v2");
  assert.equal(publicTargetRejected.status, "BLOCKED");
  assert.equal(publicTargetRejected.blockReason, "PRIVATE_OR_INTERNAL_DESTINATION");
  assert.deepEqual(
    publicTargetRejected.transportProvenance,
    { state: "BLOCKED", trigger: "PUBLIC_HTTPS_TARGET_REJECTED", scope: "TOP_LEVEL" },
  );
  assert.equal(publicTargetRejected.finalPath, "[unapproved-route]");
  assert.equal(publicTargetRejected.fragmentPreserved, false);
  assert.equal(publicTargetRejected.renderProvenance, undefined);
  assert.equal(publicTargetRejected.evidence, undefined);
  assert.equal(publicTargetRejected.authorizesProductionMapping, false);

  const disallowedProtocol = summarizePreLoadNavigationBlock(
    "sisal",
    ordinaryTransportProvenanceV2("http:", true, undefined),
    "PRIVATE_OR_INTERNAL_DESTINATION",
  );
  assert.ok(disallowedProtocol);
  assert.deepEqual(
    disallowedProtocol.transportProvenance,
    { state: "BLOCKED", trigger: "DISALLOWED_PROTOCOL", scope: "TOP_LEVEL" },
  );

  const unapprovedRedirect = summarizePreLoadNavigationBlock(
    "sisal",
    initialTransportProvenanceV2(),
    "UNAPPROVED_NAVIGATION",
  );
  assert.ok(unapprovedRedirect);
  assert.equal(unapprovedRedirect.blockReason, "UNAPPROVED_NAVIGATION");
  assert.deepEqual(
    unapprovedRedirect.transportProvenance,
    { state: "CLEAR", websocket: "NONE_OBSERVED" },
  );

  assert.equal(
    summarizePreLoadNavigationBlock(
      "sisal",
      initialTransportProvenanceV2(),
      undefined,
    ),
    undefined,
  );
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
  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...validBlocked,
      transportProvenance: { state: "CLEAR" },
    }),
    /must agree/,
  );
  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...validBlocked,
      finalPath: "/account/session/opaque-dynamic-path",
    }),
    /redacted route allowlist/,
  );
  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...validBlocked,
      approvedOrigin: "https://example.invalid",
    }),
    /source-locked BOOK-024 navigation contract/,
  );
  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...validBlocked,
      target: {
        ...(validBlocked.target as Record<string, unknown>),
        participantA: "dynamic page content",
      },
    }),
    /source-locked BOOK-024 definition/,
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

  const unsafeSnippet = structuredClone(valid.evidence as Record<string, unknown>);
  (unsafeSnippet.participantA as Record<string, unknown>).observed = true;
  (unsafeSnippet.participantA as Record<string, unknown>).snippets = [
    "https://example.invalid/private/session",
  ];
  assert.throws(
    () => validatePassiveDiagnosticSummary({ ...valid, evidence: unsafeSnippet }),
    /unsanitized sensitive-looking content/,
  );

  const unsafeOdds = structuredClone(valid.evidence as Record<string, unknown>);
  unsafeOdds.displayedOddsCandidates = ["secret-token-value"];
  assert.throws(
    () => validatePassiveDiagnosticSummary({ ...valid, evidence: unsafeOdds }),
    /displayedOddsCandidates is invalid/,
  );

  const inconsistentDimensions = structuredClone(valid.evidence as Record<string, unknown>);
  (inconsistentDimensions.dimensionsObserved as Record<string, unknown>).event = true;
  assert.throws(
    () => validatePassiveDiagnosticSummary({ ...valid, evidence: inconsistentDimensions }),
    /dimensionsObserved is inconsistent/,
  );

  const inconsistentChain = structuredClone(valid.evidence as Record<string, unknown>);
  inconsistentChain.requiredChainObserved = true;
  assert.throws(
    () => validatePassiveDiagnosticSummary({ ...valid, evidence: inconsistentChain }),
    /requiredChainObserved is inconsistent/,
  );

  assert.throws(
    () => validatePassiveDiagnosticSummary({
      ...valid,
      finalPath: "[unapproved-route]",
    }),
    /exact source-locked final route/,
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
  assert.match(source, /"\[unapproved-route\]"/);
  assert.doesNotMatch(source, /finalPath:\s*finalUrl\.pathname/);
});


test("passive-provenance.v2 records reviewed WSS as non-blocking finite transport state", () => {
  const initial = initialTransportProvenanceV2();
  const allowed = allowedReviewedWebSocketObserved(initial);
  assert.deepEqual(
    allowed,
    { state: "CLEAR", websocket: "ALLOWED_REVIEWED_WSS_OBSERVED" },
  );
  assert.deepEqual(
    retainTransportProvenanceV2(
      allowed,
      ordinaryTransportProvenanceV2("https:", false, true),
    ),
    allowed,
  );
});

test("passive-provenance.v2 maps finite WSS failure categories and retains first blocked trigger", () => {
  const insecure = blockedWebSocketTransportProvenanceV2("BOOKMAKER_WSS_INSECURE");
  const unapproved = blockedWebSocketTransportProvenanceV2("BOOKMAKER_WSS_UNAPPROVED");
  const network = blockedWebSocketTransportProvenanceV2(
    "BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED",
  );
  assert.deepEqual(insecure, {
    state: "BLOCKED",
    trigger: "INSECURE_WEBSOCKET",
    scope: "SOCKET",
  });
  assert.deepEqual(unapproved, {
    state: "BLOCKED",
    trigger: "UNAPPROVED_WEBSOCKET",
    scope: "SOCKET",
  });
  assert.deepEqual(network, {
    state: "BLOCKED",
    trigger: "WEBSOCKET_PUBLIC_TARGET_REJECTED",
    scope: "SOCKET",
  });
  assert.deepEqual(
    retainTransportProvenanceV2(unapproved, network),
    unapproved,
  );

  const serialized = JSON.stringify([insecure, unapproved, network]);
  for (const forbidden of [
    "socket.example.com",
    "127.0.0.1",
    "/feed",
    "wss://",
    "payload",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("passive-provenance.v2 validator preserves v1 render privacy while accepting reviewed WSS observation", () => {
  const value = completeSummary();
  const v2 = {
    ...value,
    diagnosticSchemaVersion: PASSIVE_DIAGNOSTIC_SCHEMA_VERSION_V2,
    transportProvenance: {
      state: "CLEAR",
      websocket: "ALLOWED_REVIEWED_WSS_OBSERVED",
    },
  };
  assert.doesNotThrow(() => validatePassiveDiagnosticSummaryV2(v2));
  assert.throws(
    () => validatePassiveDiagnosticSummaryV2({
      ...v2,
      transportProvenance: {
        state: "CLEAR",
        websocket: "ALLOWED_REVIEWED_WSS_OBSERVED",
        destinationHost: "socket.example.com",
      },
    }),
    /unknown field/,
  );
});

test("passive-provenance.v2 validator accepts finite blocked WSS and rejects unknown categories", () => {
  const value = blockedSummary(webSocketTransportProvenance());
  const v2 = {
    ...value,
    diagnosticSchemaVersion: PASSIVE_DIAGNOSTIC_SCHEMA_VERSION_V2,
    transportProvenance: {
      state: "BLOCKED",
      trigger: "UNAPPROVED_WEBSOCKET",
      scope: "SOCKET",
    },
  };
  assert.doesNotThrow(() => validatePassiveDiagnosticSummaryV2(v2));
  assert.throws(
    () => validatePassiveDiagnosticSummaryV2({
      ...v2,
      transportProvenance: {
        state: "BLOCKED",
        trigger: "RUNTIME_DISCOVERED_SOCKET",
        scope: "SOCKET",
      },
    }),
    /unknown enum value/,
  );
});
