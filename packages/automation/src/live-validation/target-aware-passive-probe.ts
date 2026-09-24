import { chromium, type Locator, type Page } from "playwright-core";

import { NavigationPolicy } from "../navigation-policy.ts";
import {
  PASSIVE_DIAGNOSTIC_SCHEMA_VERSION,
  type PassiveReadinessProvenance,
  type PassiveRenderProvenance,
  type PassiveTargetPresenceKey,
  type PassiveTransportProvenance,
  type TargetPredicatePresence,
  domPopulationBucket,
  ordinaryTransportProvenance,
  readinessProvenance,
  retainFirstTransportProvenance,
  validatePassiveDiagnosticSummary,
  webSocketTransportProvenance,
} from "./passive-diagnostic-provenance.ts";

export type TargetAwareBookmaker = "sisal" | "bet365";

export interface PassiveTargetDefinition {
  readonly bookmaker: TargetAwareBookmaker;
  readonly url: string;
  readonly participantA: string;
  readonly participantB: string;
  readonly competition: string;
  readonly scheduledDate: string;
  readonly scheduledTime: string;
  readonly marketPeriod: "full_match";
  readonly marketContext: "total_corners";
  readonly line: string;
  readonly side: "OVER" | "UNDER";
  readonly expectedOdds: string;
}

export const BOOK_024_TARGETS: Readonly<Record<TargetAwareBookmaker, PassiveTargetDefinition>> =
  Object.freeze({
    bet365: Object.freeze({
      bookmaker: "bet365",
      url: "https://www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/",
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
    }),
    sisal: Object.freeze({
      bookmaker: "sisal",
      url: "https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles",
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
    }),
  });

const APPROVED_ORIGINS: Readonly<Record<TargetAwareBookmaker, string>> = Object.freeze({
  bet365: "https://www.bet365.it",
  sisal: "https://www.sisal.it",
});

const NAVIGATION_TIMEOUT_MS = 20_000;
const READINESS_DELAY_MS = 1_000;
const MAX_SIGNAL_MATCHES = 3;
const MAX_LOCATOR_CANDIDATES = 12;
const MAX_SNIPPET_LENGTH = 220;
const MAX_ODDS_CANDIDATES = 6;
const EVIDENCE_UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const URL_TEXT = /https?:\/\/\S+/giu;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{24,}\b/gu;
const ACCESS_BLOCK_TEXT =
  /(?:access denied|forbidden|geo.?restrict|not available in your country|servizio non disponibile|too many requests|rate limit|temporarily blocked|automated traffic|unusual traffic|robot check|bot detection)/i;
const CONSENT_TEXT = /(?:cookie|consenso|consent|privacy|preferenze)/i;

export type PassiveBlockReason =
  | "AUTH_REQUIRED"
  | "CAPTCHA_OR_ANTIBOT"
  | "ACCESS_RESTRICTION"
  | "CONSENT_REQUIRED"
  | "UNAPPROVED_NAVIGATION"
  | "PRIVATE_OR_INTERNAL_DESTINATION"
  | "PAGE_CLOSED";

export interface PassiveSignalEvidence {
  readonly observed: boolean;
  readonly snippets: readonly string[];
}

export interface TargetAwareEvidence {
  readonly participantA: PassiveSignalEvidence;
  readonly participantB: PassiveSignalEvidence;
  readonly competition: PassiveSignalEvidence;
  readonly scheduledDate: PassiveSignalEvidence;
  readonly scheduledTime: PassiveSignalEvidence;
  readonly broadCornerContext: PassiveSignalEvidence;
  readonly totalCornersMarket: PassiveSignalEvidence;
  readonly fullMatchContext: PassiveSignalEvidence;
  readonly exactLine: PassiveSignalEvidence;
  readonly requestedSideAtLine: PassiveSignalEvidence;
  readonly expectedOdds: PassiveSignalEvidence;
  readonly displayedOddsCandidates: readonly string[];
  readonly dimensionsObserved: Readonly<{
    event: boolean;
    competition: boolean;
    scheduledTime: boolean;
    totalCornersMarket: boolean;
    fullMatchPeriod: boolean;
    exactLine: boolean;
    requestedSide: boolean;
    displayedOdds: boolean;
  }>;
  readonly requiredChainObserved: boolean;
}

export interface TargetAwarePassiveSummary {
  readonly diagnosticSchemaVersion: typeof PASSIVE_DIAGNOSTIC_SCHEMA_VERSION;
  readonly bookmaker: TargetAwareBookmaker;
  readonly approvedOrigin: string;
  readonly navigationKind: "BOOKMAKER_DIRECT";
  readonly requestedPath: string;
  readonly finalPath: string;
  readonly requestedFragmentPresent: boolean;
  readonly fragmentPreserved: boolean;
  readonly status: "COMPLETE" | "BLOCKED";
  readonly blockReason?: PassiveBlockReason;
  readonly target: Omit<PassiveTargetDefinition, "bookmaker" | "url">;
  readonly transportProvenance: PassiveTransportProvenance;
  readonly renderProvenance?: PassiveRenderProvenance;
  readonly evidence?: TargetAwareEvidence;
  readonly authorizesProductionMapping: false;
  readonly note: string;
}

export function sanitizePassiveEvidenceText(value: string): string {
  return value
    .replace(EVIDENCE_UUID, "[uuid]")
    .replace(EMAIL, "[email]")
    .replace(URL_TEXT, "[url]")
    .replace(LONG_TOKEN, "[token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SNIPPET_LENGTH);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function decimalPattern(value: string): RegExp {
  const parts = value.split(".");
  const whole = parts[0];
  const fraction = parts[1];
  if (whole === undefined || fraction === undefined) {
    throw new Error("Invalid decimal target: " + value);
  }
  return new RegExp(
    "(?:^|[^0-9])" + escapeRegex(whole) + "[.,]" + escapeRegex(fraction) + "(?:[^0-9]|$)",
    "i",
  );
}

function targetSideAtLinePattern(target: PassiveTargetDefinition): RegExp {
  const side = target.side === "UNDER" ? "(?:under|meno)" : "(?:over|pi[uù])";
  const line = target.line.replace(".", "[.,]");
  return new RegExp(
    "(?:\\b" + side + "\\b[^\\n]{0,32}(?:^|[^0-9])" + line +
      "(?:[^0-9]|$)|(?:^|[^0-9])" + line + "(?:[^0-9]|$)[^\\n]{0,32}\\b" + side + "\\b)",
    "i",
  );
}

const BROAD_CORNER_PATTERN = /(?:corner|angol|calci d['’]?angolo)/i;
const TOTAL_CORNERS_PATTERN =
  /(?:tot(?:al|ale|ali)[^\n]{0,32}(?:corner|angol|calci d['’]?angolo)|(?:corner|angol|calci d['’]?angolo)[^\n]{0,32}tot(?:al|ale|ali))/i;
const FULL_MATCH_PATTERN =
  /(?:full[ -]?match|partita intera|intera partita|tempo regolamentare|intero incontro|totale partita)/i;

function approvedOriginFor(bookmaker: TargetAwareBookmaker): string {
  return APPROVED_ORIGINS[bookmaker];
}

export function isApprovedPassiveFinalRoute(
  bookmaker: TargetAwareBookmaker,
  rawUrl: string,
): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.origin === approvedOriginFor(bookmaker)
      && parsed.href === BOOK_024_TARGETS[bookmaker].url
    );
  } catch {
    return false;
  }
}

export function parseApprovedPassiveTarget(
  bookmaker: TargetAwareBookmaker,
  rawUrl: string,
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("BOOK-024 passive probe received a malformed direct URL.");
  }
  const approvedOrigin = approvedOriginFor(bookmaker);
  const policy = new NavigationPolicy([approvedOrigin]);
  const lockedUrl = BOOK_024_TARGETS[bookmaker].url;
  if (
    !policy.isAllowed(parsed.href)
    || parsed.origin !== approvedOrigin
    || parsed.href !== lockedUrl
  ) {
    throw new Error(
      "BOOK-024 " + bookmaker.toUpperCase() +
        " passive probe only accepts its exact source-locked credential-free HTTPS target.",
    );
  }
  return parsed;
}

async function firstVisible(locator: Locator, limit = 4): Promise<boolean> {
  const count = await locator.count();
  for (let index = 0; index < Math.min(count, limit); index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function detectPassiveBlock(page: Page): Promise<PassiveBlockReason | undefined> {
  if (page.isClosed()) return "PAGE_CLOSED";
  if (await firstVisible(page.locator('input[type="password"]'))) return "AUTH_REQUIRED";
  if (
    await firstVisible(
      page.locator(
        'iframe[src*="captcha" i], [data-sitekey], [class*="captcha" i], [id*="captcha" i]',
      ),
    )
  ) {
    return "CAPTCHA_OR_ANTIBOT";
  }
  if (await firstVisible(page.getByText(ACCESS_BLOCK_TEXT), 6)) return "ACCESS_RESTRICTION";

  const dialogs = page.locator('[role="dialog"], [aria-modal="true"]');
  const dialogCount = await dialogs.count();
  for (let index = 0; index < Math.min(dialogCount, 4); index += 1) {
    const dialog = dialogs.nth(index);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    if (await firstVisible(dialog.getByText(CONSENT_TEXT), 4)) return "CONSENT_REQUIRED";
  }
  return undefined;
}

async function boundedContextText(item: Locator): Promise<string> {
  const directText = sanitizePassiveEvidenceText(await item.innerText().catch(() => ""));
  const context = item.locator(
    "xpath=ancestor-or-self::*[self::button or self::a or self::div or self::li or self::section or self::article or self::main or self::nav][1]",
  );
  if ((await context.count().catch(() => 0)) === 0) return directText;

  const contextText = sanitizePassiveEvidenceText(await context.innerText().catch(() => ""));
  return contextText.length > directText.length ? contextText : directText;
}

async function boundedSignalEvidence(page: Page, pattern: RegExp): Promise<PassiveSignalEvidence> {
  const locator = page.getByText(pattern);
  const count = await locator.count();
  const snippets: string[] = [];
  const seen = new Set<string>();

  for (
    let index = 0;
    index < Math.min(count, MAX_LOCATOR_CANDIDATES) && snippets.length < MAX_SIGNAL_MATCHES;
    index += 1
  ) {
    const item = locator.nth(index);
    if (!(await item.isVisible().catch(() => false))) continue;

    const candidate = await boundedContextText(item);
    if (candidate === "" || seen.has(candidate)) continue;
    seen.add(candidate);
    snippets.push(candidate);
  }

  return { observed: snippets.length > 0, snippets };
}

async function boundedSignalPresence(
  page: Page,
  pattern: RegExp,
): Promise<TargetPredicatePresence> {
  const locator = page.getByText(pattern);
  const count = await locator.count();
  let visibleObservedWithinBound = false;
  for (let index = 0; index < Math.min(count, MAX_LOCATOR_CANDIDATES); index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) {
      visibleObservedWithinBound = true;
      break;
    }
  }
  return {
    domPresent: count > 0,
    visibleObservedWithinBound,
  };
}

function targetPresencePatterns(
  target: PassiveTargetDefinition,
): Readonly<Record<PassiveTargetPresenceKey, RegExp>> {
  return {
    participantA: new RegExp(escapeRegex(target.participantA), "i"),
    participantB: new RegExp(escapeRegex(target.participantB), "i"),
    competition: new RegExp(escapeRegex(target.competition), "i"),
    scheduledDate: new RegExp(escapeRegex(target.scheduledDate), "i"),
    scheduledTime: new RegExp(escapeRegex(target.scheduledTime), "i"),
    broadCornerContext: BROAD_CORNER_PATTERN,
    totalCornersMarket: TOTAL_CORNERS_PATTERN,
    fullMatchContext: FULL_MATCH_PATTERN,
    exactLine: decimalPattern(target.line),
    requestedSideAtLine: targetSideAtLinePattern(target),
    expectedOdds: decimalPattern(target.expectedOdds),
  };
}

function stripTargetLineBeforeOddsScan(value: string, targetLine: string): string {
  const [whole, fraction] = targetLine.split(".");
  if (whole === undefined || fraction === undefined) return value;

  const escapedWhole = escapeRegex(whole);
  const escapedFraction = escapeRegex(fraction);
  const targetLinePattern = new RegExp(
    "(^|[^0-9])" + escapedWhole + "[.,]" + escapedFraction +
      "(?=(?:\\d{1,2}[.,]\\d{2})|[^0-9]|$)",
    "g",
  );
  return value.replace(targetLinePattern, "$1 ");
}

function displayedOddsFromBoundEvidence(
  evidence: readonly PassiveSignalEvidence[],
  targetLine: string,
): string[] {
  const odds = new Set<string>();
  const decimal = /(?:^|[^0-9])(\d{1,2})[.,](\d{2})(?:[^0-9]|$)/g;

  for (const signal of evidence) {
    for (const snippet of signal.snippets) {
      const oddsText = stripTargetLineBeforeOddsScan(snippet, targetLine);
      for (const match of oddsText.matchAll(decimal)) {
        const whole = match[1];
        const fraction = match[2];
        if (whole === undefined || fraction === undefined) continue;
        const value = String(Number(whole)) + "." + fraction;
        if (value === targetLine || odds.has(value)) continue;
        odds.add(value);
        if (odds.size >= MAX_ODDS_CANDIDATES) return [...odds];
      }
    }
  }
  return [...odds];
}

async function collectDisplayedOddsNearTarget(
  page: Page,
  target: PassiveTargetDefinition,
): Promise<string[]> {
  const odds = new Set<string>();
  const anchors = [
    page.getByText(targetSideAtLinePattern(target)),
    page.getByText(decimalPattern(target.line)),
    page.getByText(TOTAL_CORNERS_PATTERN),
  ];

  for (const anchor of anchors) {
    const count = await anchor.count();
    for (let index = 0; index < Math.min(count, 8); index += 1) {
      const item = anchor.nth(index);
      if (!(await item.isVisible().catch(() => false))) continue;
      let context: Locator = item;

      for (let depth = 0; depth < 3; depth += 1) {
        if ((await context.count().catch(() => 0)) === 0) break;
        const text = sanitizePassiveEvidenceText(await context.innerText().catch(() => ""));
        const targetRelevant =
          targetSideAtLinePattern(target).test(text) ||
          decimalPattern(target.line).test(text) ||
          TOTAL_CORNERS_PATTERN.test(text);
        if (targetRelevant) {
          for (const value of displayedOddsFromBoundEvidence(
            [{ observed: true, snippets: [text] }],
            target.line,
          )) {
            odds.add(value);
            if (odds.size >= MAX_ODDS_CANDIDATES) return [...odds];
          }
        }
        context = context.locator("xpath=..");
      }
    }
  }

  return [...odds];
}

export async function collectTargetAwarePageEvidence(
  page: Page,
  target: PassiveTargetDefinition,
): Promise<TargetAwareEvidence> {
  const patterns = targetPresencePatterns(target);
  const participantA = await boundedSignalEvidence(page, patterns.participantA);
  const participantB = await boundedSignalEvidence(page, patterns.participantB);
  const competition = await boundedSignalEvidence(page, patterns.competition);
  const scheduledDate = await boundedSignalEvidence(page, patterns.scheduledDate);
  const scheduledTime = await boundedSignalEvidence(page, patterns.scheduledTime);
  const broadCornerContext = await boundedSignalEvidence(page, patterns.broadCornerContext);
  const totalCornersMarket = await boundedSignalEvidence(page, patterns.totalCornersMarket);
  const fullMatchContext = await boundedSignalEvidence(page, patterns.fullMatchContext);
  const exactLine = await boundedSignalEvidence(page, patterns.exactLine);
  const requestedSideAtLine = await boundedSignalEvidence(page, patterns.requestedSideAtLine);
  const expectedOdds = await boundedSignalEvidence(page, patterns.expectedOdds);

  const displayedOddsCandidates = [
    ...new Set([
      ...displayedOddsFromBoundEvidence(
        [totalCornersMarket, fullMatchContext, exactLine, requestedSideAtLine, expectedOdds],
        target.line,
      ),
      ...(await collectDisplayedOddsNearTarget(page, target)),
    ]),
  ].slice(0, MAX_ODDS_CANDIDATES);

  const dimensionsObserved = {
    event: participantA.observed && participantB.observed,
    competition: competition.observed,
    scheduledTime: scheduledDate.observed && scheduledTime.observed,
    totalCornersMarket: totalCornersMarket.observed,
    fullMatchPeriod: fullMatchContext.observed,
    exactLine: exactLine.observed,
    requestedSide: requestedSideAtLine.observed,
    displayedOdds: displayedOddsCandidates.length > 0,
  } as const;

  return {
    participantA,
    participantB,
    competition,
    scheduledDate,
    scheduledTime,
    broadCornerContext,
    totalCornersMarket,
    fullMatchContext,
    exactLine,
    requestedSideAtLine,
    expectedOdds,
    displayedOddsCandidates,
    dimensionsObserved,
    requiredChainObserved: Object.values(dimensionsObserved).every(Boolean),
  };
}

export async function collectPassiveRenderProvenance(
  page: Page,
  target: PassiveTargetDefinition,
  readiness: PassiveReadinessProvenance,
): Promise<PassiveRenderProvenance> {
  const patterns = targetPresencePatterns(target);
  const presenceEntries = await Promise.all(
    Object.entries(patterns).map(async ([key, pattern]) => [
      key,
      await boundedSignalPresence(page, pattern),
    ] as const),
  );
  const targetPresence = Object.fromEntries(presenceEntries) as Record<
    PassiveTargetPresenceKey,
    TargetPredicatePresence
  >;

  const transientTitle = await page.title().catch(() => "");
  const participantPair =
    new RegExp(escapeRegex(target.participantA), "i").test(transientTitle)
    && new RegExp(escapeRegex(target.participantB), "i").test(transientTitle);
  const competition = new RegExp(escapeRegex(target.competition), "i").test(transientTitle);
  const descendantCount = await page.locator("body *").count().catch(() => 0);

  return {
    readiness,
    titlePredicates: {
      participantPair,
      competition,
    },
    targetPresence,
    domPopulation: domPopulationBucket(descendantCount),
  };
}

export async function waitForPassiveReadiness(
  page: Page,
): Promise<PassiveReadinessProvenance> {
  await page.waitForTimeout(READINESS_DELAY_MS);
  const confirmed = await page
    .waitForLoadState("domcontentloaded", { timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  return readinessProvenance(confirmed);
}

function validatedSummary(summary: TargetAwarePassiveSummary): TargetAwarePassiveSummary {
  validatePassiveDiagnosticSummary(summary);
  return summary;
}

function summaryTarget(target: PassiveTargetDefinition): TargetAwarePassiveSummary["target"] {
  return {
    participantA: target.participantA,
    participantB: target.participantB,
    competition: target.competition,
    scheduledDate: target.scheduledDate,
    scheduledTime: target.scheduledTime,
    marketPeriod: target.marketPeriod,
    marketContext: target.marketContext,
    line: target.line,
    side: target.side,
    expectedOdds: target.expectedOdds,
  };
}

export function summarizePreLoadNavigationBlock(
  bookmaker: TargetAwareBookmaker,
  transportProvenance: PassiveTransportProvenance,
  routeBlockReason: PassiveBlockReason | undefined,
): TargetAwarePassiveSummary | undefined {
  const targetDefinition = BOOK_024_TARGETS[bookmaker];
  const target = new URL(targetDefinition.url);
  const transportBlocked = transportProvenance.state === "BLOCKED";
  const blockReason = transportBlocked
    ? "PRIVATE_OR_INTERNAL_DESTINATION" as const
    : routeBlockReason === "UNAPPROVED_NAVIGATION"
      ? "UNAPPROVED_NAVIGATION" as const
      : undefined;
  if (blockReason === undefined) return undefined;

  return validatedSummary({
    diagnosticSchemaVersion: PASSIVE_DIAGNOSTIC_SCHEMA_VERSION,
    bookmaker,
    approvedOrigin: approvedOriginFor(bookmaker),
    navigationKind: "BOOKMAKER_DIRECT",
    requestedPath: target.pathname,
    finalPath: "[unapproved-route]",
    requestedFragmentPresent: target.hash !== "",
    fragmentPreserved: false,
    status: "BLOCKED",
    blockReason,
    target: summaryTarget(targetDefinition),
    transportProvenance,
    authorizesProductionMapping: false,
    note: transportBlocked
      ? "Passive direct-page diagnostic stopped at the existing browser/network boundary. No target evidence was retained from an unsafe navigation state."
      : "Passive direct-page diagnostic stopped because the exact source-locked direct route was not preserved.",
  });
}

export async function runTargetAwarePassiveProbe(options: Readonly<{
  bookmaker: TargetAwareBookmaker;
}>): Promise<TargetAwarePassiveSummary> {
  assertNonCiEnvironment();
  const targetDefinition = BOOK_024_TARGETS[options.bookmaker];
  const target = parseApprovedPassiveTarget(options.bookmaker, targetDefinition.url);
  const approvedOrigin = approvedOriginFor(options.bookmaker);
  const navigationPolicy = new NavigationPolicy([approvedOrigin]);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  let routeBlockReason: PassiveBlockReason | undefined;
  const transportState: { current: PassiveTransportProvenance } = {
    current: { state: "CLEAR" },
  };

  await context.routeWebSocket("**/*", (socket) => {
    transportState.current = retainFirstTransportProvenance(
      transportState.current,
      webSocketTransportProvenance(),
    );
    routeBlockReason = "PRIVATE_OR_INTERNAL_DESTINATION";
    void socket.close({ code: 1008, reason: "BOOK-024 WebSocket blocked" });
  });

  await context.route("**/*", async (route) => {
    const request = route.request();
    let parsed: URL;
    try {
      parsed = new URL(request.url());
    } catch {
      await route.continue();
      return;
    }

    const isTopLevelNavigation =
      request.isNavigationRequest() && request.frame().parentFrame() === null;
    const publicHttpsTarget = parsed.protocol === "https:"
      ? await navigationPolicy.isResolvedPublicHttpsTarget(parsed.href)
      : undefined;
    const requestProvenance = ordinaryTransportProvenance(
      parsed.protocol,
      isTopLevelNavigation,
      publicHttpsTarget,
    );
    if (requestProvenance.state === "BLOCKED") {
      transportState.current = retainFirstTransportProvenance(
        transportState.current,
        requestProvenance,
      );
      routeBlockReason = "PRIVATE_OR_INTERNAL_DESTINATION";
      await route.abort("blockedbyclient");
      return;
    }

    if (isTopLevelNavigation && !navigationPolicy.isAllowed(request.url())) {
      routeBlockReason = "UNAPPROVED_NAVIGATION";
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  context.on("page", (openedPage) => {
    if (openedPage !== page) void openedPage.close().catch(() => undefined);
  });

  try {
    try {
      await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
    } catch {
      const blockedSummary = summarizePreLoadNavigationBlock(
        options.bookmaker,
        transportState.current,
        routeBlockReason,
      );
      if (blockedSummary !== undefined) return blockedSummary;
      throw new Error(
        "BOOK-024 navigation failed before a sanitized summary could be produced.",
      );
    }
    const readiness = await waitForPassiveReadiness(page);

    const finalUrl = new URL(page.url());
    const exactFinalRoute = isApprovedPassiveFinalRoute(options.bookmaker, finalUrl.href);
    const base = {
      diagnosticSchemaVersion: PASSIVE_DIAGNOSTIC_SCHEMA_VERSION,
      bookmaker: options.bookmaker,
      approvedOrigin,
      navigationKind: "BOOKMAKER_DIRECT" as const,
      requestedPath: target.pathname,
      finalPath: exactFinalRoute
        ? target.pathname
        : finalUrl.origin === approvedOrigin
          ? "[unapproved-route]"
          : "[unapproved-origin]",
      requestedFragmentPresent: target.hash !== "",
      fragmentPreserved: target.hash === finalUrl.hash,
      target: summaryTarget(targetDefinition),
      authorizesProductionMapping: false as const,
    };

    if (routeBlockReason !== undefined) {
      return validatedSummary({
        ...base,
        transportProvenance: transportState.current,
        status: "BLOCKED",
        blockReason: routeBlockReason,
        note:
          "Passive direct-page diagnostic stopped at the existing browser/network boundary. No target evidence was retained from an unsafe navigation state.",
      });
    }

    if (
      !navigationPolicy.isAllowed(page.url())
      || finalUrl.origin !== approvedOrigin
      || !exactFinalRoute
    ) {
      return validatedSummary({
        ...base,
        transportProvenance: transportState.current,
        status: "BLOCKED",
        blockReason: "UNAPPROVED_NAVIGATION",
        note:
          "Passive direct-page diagnostic stopped because the exact source-locked direct route was not preserved.",
      });
    }

    const pageBlock = await detectPassiveBlock(page);
    if (pageBlock !== undefined) {
      return validatedSummary({
        ...base,
        transportProvenance: transportState.current,
        status: "BLOCKED",
        blockReason: pageBlock,
        note:
          "Passive direct-page diagnostic observed an auth/access/consent boundary and retained no target evidence.",
      });
    }

    const evidence = await collectTargetAwarePageEvidence(page, targetDefinition);
    const renderProvenance = await collectPassiveRenderProvenance(
      page,
      targetDefinition,
      readiness,
    );

    if (routeBlockReason !== undefined || transportState.current.state === "BLOCKED") {
      return validatedSummary({
        ...base,
        transportProvenance: transportState.current,
        status: "BLOCKED",
        blockReason: transportState.current.state === "BLOCKED"
          ? "PRIVATE_OR_INTERNAL_DESTINATION"
          : routeBlockReason ?? "PRIVATE_OR_INTERNAL_DESTINATION",
        note:
          "Passive direct-page diagnostic stopped at the existing browser/network boundary. No target evidence was retained from an unsafe navigation state.",
      });
    }

    return validatedSummary({
      ...base,
      transportProvenance: transportState.current,
      status: "COMPLETE",
      evidence,
      renderProvenance,
      authorizesProductionMapping: false,
      note:
        "Target-aware evidence and passive provenance are bounded, sanitized, diagnostic only, and never authorize production mapping or outcome activation.",
    });
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export function parseBook024Bookmaker(args: readonly string[]): TargetAwareBookmaker {
  if (args.length !== 1 || (args[0] !== "bet365" && args[0] !== "sisal")) {
    throw new Error("Usage: npm run live:probe:book024 -- bet365|sisal");
  }
  return args[0];
}

function assertNonCiEnvironment(environment = process.env): void {
  for (const key of ["CI", "GITHUB_ACTIONS", "TF_BUILD", "BUILD_BUILDID", "JENKINS_URL", "BUILDKITE", "CIRCLECI"]) {
    const value = environment[key];
    if (value !== undefined && !["", "0", "false", "no"].includes(value.trim().toLowerCase())) {
      throw new Error(
        "BOOK-024 live passive diagnostics are intentionally disabled in CI (" + key + " is set).",
      );
    }
  }
}

async function main(): Promise<void> {
  assertNonCiEnvironment();
  const bookmaker = parseBook024Bookmaker(process.argv.slice(2));
  const summary = await runTargetAwarePassiveProbe({ bookmaker });
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exitCode = summary.status === "BLOCKED" ? 2 : 0;
}

const invokedAsScript = process.argv[1]?.endsWith("target-aware-passive-probe.ts") ?? false;
if (invokedAsScript) {
  void main().catch(() => {
    process.stderr.write(
      "BOOK-024 passive diagnostic failed safely before a sanitized summary could be produced.\n",
    );
    process.exitCode = 1;
  });
}
