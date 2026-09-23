import { chromium, type Locator, type Page } from "playwright-core";

import { domMappingFor, type WorkerBookmaker } from "../dom-mapping.ts";
import { NavigationPolicy, isInternalHostname } from "../navigation-policy.ts";
import { createWorkerPageRuntime } from "../page-runtime.ts";

export type ExplorerBookmaker = "admiralbet" | "sisal" | "bet365";
type RelayExplorerBookmaker = Extract<ExplorerBookmaker, WorkerBookmaker>;

const BETUP_RELAY_ORIGIN = "https://www.bet-up.it";
const RELAY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const BOOKMAKER_CONFIG: Readonly<
  Record<ExplorerBookmaker, Readonly<{ origin: string; defaultPath: string }>>
> = {
  admiralbet: {
    origin: "https://www.admiralbet.it",
    defaultPath: "/scommesse",
  },
  sisal: {
    origin: "https://www.sisal.it",
    defaultPath: "/scommesse-matchpoint/sport/calcio",
  },
  bet365: {
    origin: "https://www.bet365.it",
    defaultPath: "/hub/it-it/football",
  },
};

const DEFAULT_MAX_ACTIONS = 10;
const MAX_ACTIONS = 12;
const DEFAULT_DELAY_MS = 1_000;
const MIN_DELAY_MS = 750;
const MAX_DELAY_MS = 5_000;
const MAX_CONTROL_SAMPLES = 16;
const MAX_TEXT_LENGTH = 160;

const FORBIDDEN_CONTROL_TEXT =
  /(?:\blog\s?in\b|\baccedi\b|registr|account|profil|captcha|\botp\b|\bmfa\b|schedina|betslip|puntat|stake|importo|deposit|ricaric|preliev|withdraw|cash\s?out|conferma|confirm|submit|scommetti|piazza|place\s?bet|bet\s?now|gioca\s?ora|pagamento|payment)/i;
const CONSENT_CONTROL_TEXT = /(?:cookie|consenso|consent|privacy|preferenze)/i;
const OUTCOME_CONTROL_TEXT =
  /(?:\b(?:over|under)\b[^\n]{0,32}\b\d+(?:[.,]\d+)?\b|\b1x2\b|\besito\b|\bvincente\b|goal\s*\/\s*no\s*goal|gg\s*\/\s*ng)/i;
const STANDALONE_ODDS_TEXT = /^\s*\d{1,2}[.,]\d{2}\s*$/;
const NAVIGATION_RELEVANCE =
  /(?:calcio|football|sport|scommess|prematch|pre-match|event|match|league|campionat|competition|competizione)/i;
const EXPANSION_RELEVANCE =
  /(?:mercat|market|corner|angol|calcio|football|prematch|pre-match|categoria|category|altre|more|tutti|all|mostra|show|espand|expand|vedi|view)/i;
const ACCESS_BLOCK_TEXT =
  /(?:access denied|forbidden|geo.?restrict|not available in your country|servizio non disponibile|too many requests|rate limit|temporarily blocked|automated traffic|unusual traffic|robot check|bot detection)/i;

export interface PublicControlDescriptor {
  readonly tag: "a" | "button" | "role-button" | "role-tab" | "summary";
  readonly label: string;
  readonly currentUrl: string;
  readonly approvedOrigin: string;
  readonly href?: string;
  readonly role?: string;
  readonly ariaExpanded?: string;
  readonly ariaControls?: string;
  readonly dataTestId?: string;
  readonly parentContext?: string;
  readonly childInteractiveCount: number;
}

export type PublicControlDecision =
  | Readonly<{
      kind: "ALLOW";
      interaction: "NAVIGATION" | "EXPANSION";
      reasonCode: "SAFE_SAME_ORIGIN_NAVIGATION" | "SAFE_PUBLIC_EXPANSION";
      priority: number;
    }>
  | Readonly<{
      kind: "DENY";
      reasonCode:
        | "FORBIDDEN_CONTROL"
        | "CONSENT_CONTROL"
        | "OUTCOME_OR_ODDS_CONTROL"
        | "UNAPPROVED_NAVIGATION"
        | "IRRELEVANT_NAVIGATION"
        | "AMBIGUOUS_CONTROL";
    }>;

interface InternalControlRecord {
  readonly locator: Locator;
  readonly descriptor: PublicControlDescriptor;
  readonly decision: PublicControlDecision;
  readonly fingerprint: string;
}

export interface ExplorerEvidenceControl {
  readonly tag: PublicControlDescriptor["tag"];
  readonly label: string;
  readonly decision: PublicControlDecision["kind"];
  readonly reasonCode: PublicControlDecision["reasonCode"];
  readonly hrefPath?: string;
  readonly role?: string;
  readonly ariaExpanded?: string;
  readonly ariaControls?: string;
  readonly dataTestId?: string;
  readonly parentContext?: string;
  readonly childInteractiveCount: number;
}

export interface ExplorerEvidenceSnapshot {
  readonly path: string;
  readonly title: string;
  readonly controlCount: number;
  readonly allowedControlCount: number;
  readonly samples: readonly ExplorerEvidenceControl[];
}

export interface ExplorerActionEvidence {
  readonly sequence: number;
  readonly interaction: "NAVIGATION" | "EXPANSION";
  readonly label: string;
  readonly beforePath: string;
  readonly afterPath: string;
}

export type ExplorerBlockReason =
  | "AUTH_REQUIRED"
  | "CAPTCHA_OR_ANTIBOT"
  | "ACCESS_RESTRICTION"
  | "CONSENT_REQUIRED"
  | "UNAPPROVED_NAVIGATION"
  | "PRIVATE_OR_INTERNAL_DESTINATION"
  | "PAGE_CLOSED"
  | "RELAY_INVALID"
  | "RELAY_NETWORK_TARGET_BLOCKED"
  | "RELAY_INTERMEDIARY_BLOCKED"
  | "RELAY_WRONG_FINAL_BOOKMAKER"
  | "RELAY_REDIRECT_LIMIT"
  | "RELAY_UNRESOLVED"
  | "RELAY_CHALLENGE_UNSUPPORTED";

export interface ExplorerSummary {
  readonly bookmaker: ExplorerBookmaker;
  readonly approvedOrigin: string;
  readonly navigationKind?: "BOOKMAKER_DIRECT" | "BETUP_RELAY";
  readonly relayOrigin?: typeof BETUP_RELAY_ORIGIN;
  readonly startPath: string;
  readonly finalPath: string;
  readonly status: "COMPLETE" | "BLOCKED" | "BUDGET_EXHAUSTED";
  readonly blockReason?: ExplorerBlockReason;
  readonly actionBudget: number;
  readonly actionsTaken: number;
  readonly snapshots: readonly ExplorerEvidenceSnapshot[];
  readonly actions: readonly ExplorerActionEvidence[];
  readonly authorizesProductionMapping: false;
  readonly note: string;
}

export interface ExplorerOptions {
  readonly bookmaker: ExplorerBookmaker;
  readonly url?: string;
  readonly relayUrl?: string;
  readonly maxActions?: number;
  readonly delayMs?: number;
}

function sanitizeText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizePath(rawUrl: string, approvedOrigin: string): string {
  try {
    const parsed = new URL(rawUrl, approvedOrigin);
    return parsed.origin === approvedOrigin ? parsed.pathname : "[unapproved-origin]";
  } catch {
    return "[invalid-url]";
  }
}

function parseBoundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return resolved;
}

type ExplorerStart =
  | Readonly<{ kind: "BOOKMAKER_DIRECT"; target: URL }>
  | Readonly<{
      kind: "BETUP_RELAY";
      relay: URL;
      bookmaker: RelayExplorerBookmaker;
    }>;

function asRelayExplorerBookmaker(bookmaker: ExplorerBookmaker): RelayExplorerBookmaker {
  if (bookmaker === "sisal" || bookmaker === "bet365") return bookmaker;
  throw new Error("BETUP_RELAY live exploration is currently restricted to SISAL and BET365.");
}

function parseRelayTarget(options: ExplorerOptions): ExplorerStart {
  const bookmaker = asRelayExplorerBookmaker(options.bookmaker);
  if (options.relayUrl === undefined) {
    throw new Error("Relay URL is required for BETUP_RELAY live exploration.");
  }

  let relay: URL;
  try {
    relay = new URL(options.relayUrl);
  } catch {
    throw new Error("BETUP_RELAY live explorer received a malformed relay URL.");
  }

  const suffix = bookmaker;
  const match = /^\/lnk\/([0-9a-fA-F-]+)\/([a-z0-9]+)$/u.exec(relay.pathname);
  const signalId = (match?.[1] ?? "").toLowerCase();
  const observedSuffix = match?.[2] ?? "";
  if (
    relay.protocol !== "https:" ||
    relay.origin !== BETUP_RELAY_ORIGIN ||
    relay.username !== "" ||
    relay.password !== "" ||
    relay.search !== "" ||
    relay.hash !== "" ||
    match === null ||
    !RELAY_UUID.test(signalId) ||
    observedSuffix !== suffix
  ) {
    throw new Error(
      `BETUP_RELAY live explorer requires exact https://www.bet-up.it/lnk/<uuid>/${suffix} navigation with no credentials, query, or fragment.`,
    );
  }

  return { kind: "BETUP_RELAY", relay, bookmaker };
}

function parseTarget(options: ExplorerOptions): ExplorerStart {
  if (options.url !== undefined && options.relayUrl !== undefined) {
    throw new Error("Specify either a bookmaker URL or a bet-up relay URL, never both.");
  }
  if (options.relayUrl !== undefined) return parseRelayTarget(options);

  const config = BOOKMAKER_CONFIG[options.bookmaker];
  const target = new URL(options.url ?? `${config.origin}${config.defaultPath}`);
  const policy = new NavigationPolicy([config.origin]);
  if (!policy.isAllowed(target.href) || target.origin !== config.origin) {
    throw new Error(
      `${options.bookmaker.toUpperCase()} live explorer only accepts credential-free HTTPS URLs on ${config.origin}.`,
    );
  }
  return { kind: "BOOKMAKER_DIRECT", target };
}

function priorityFor(text: string): number {
  if (/corner|angol/i.test(text)) return 100;
  if (/mercat|market/i.test(text)) return 80;
  if (/calcio|football/i.test(text)) return 65;
  if (/event|match|campionat|competition|competizione/i.test(text)) return 55;
  return 40;
}

export function classifyPublicControl(descriptor: PublicControlDescriptor): PublicControlDecision {
  const text = sanitizeText(descriptor.label);

  if (FORBIDDEN_CONTROL_TEXT.test(text)) {
    return { kind: "DENY", reasonCode: "FORBIDDEN_CONTROL" };
  }
  if (CONSENT_CONTROL_TEXT.test(text)) {
    return { kind: "DENY", reasonCode: "CONSENT_CONTROL" };
  }
  if (STANDALONE_ODDS_TEXT.test(text) || OUTCOME_CONTROL_TEXT.test(text)) {
    return { kind: "DENY", reasonCode: "OUTCOME_OR_ODDS_CONTROL" };
  }

  if (descriptor.tag === "a") {
    if (descriptor.href === undefined) {
      return { kind: "DENY", reasonCode: "AMBIGUOUS_CONTROL" };
    }
    let destination: URL;
    try {
      destination = new URL(descriptor.href, descriptor.currentUrl);
    } catch {
      return { kind: "DENY", reasonCode: "UNAPPROVED_NAVIGATION" };
    }
    const policy = new NavigationPolicy([descriptor.approvedOrigin]);
    if (!policy.isAllowed(destination.href) || destination.origin !== descriptor.approvedOrigin) {
      return { kind: "DENY", reasonCode: "UNAPPROVED_NAVIGATION" };
    }
    const relevance = `${text} ${destination.pathname}`;
    if (!NAVIGATION_RELEVANCE.test(relevance)) {
      return { kind: "DENY", reasonCode: "IRRELEVANT_NAVIGATION" };
    }
    return {
      kind: "ALLOW",
      interaction: "NAVIGATION",
      reasonCode: "SAFE_SAME_ORIGIN_NAVIGATION",
      priority: priorityFor(relevance),
    };
  }

  const structuralExpansion =
    descriptor.tag === "summary" ||
    descriptor.tag === "role-tab" ||
    descriptor.ariaExpanded !== undefined ||
    descriptor.ariaControls !== undefined;
  const explicitlyRelevant = EXPANSION_RELEVANCE.test(text);

  if (!structuralExpansion || !explicitlyRelevant) {
    return { kind: "DENY", reasonCode: "AMBIGUOUS_CONTROL" };
  }

  return {
    kind: "ALLOW",
    interaction: "EXPANSION",
    reasonCode: "SAFE_PUBLIC_EXPANSION",
    priority: priorityFor(text),
  };
}

function fingerprintControl(descriptor: PublicControlDescriptor): string {
  return [
    new URL(descriptor.currentUrl).pathname,
    descriptor.tag,
    descriptor.label,
    descriptor.href ?? "",
    descriptor.role ?? "",
    descriptor.ariaControls ?? "",
    descriptor.dataTestId ?? "",
  ].join("|");
}

async function buildDescriptor(
  locator: Locator,
  tag: PublicControlDescriptor["tag"],
  pageUrl: string,
  approvedOrigin: string,
): Promise<PublicControlDescriptor> {
  const innerText = sanitizeText(await locator.innerText().catch(() => ""));
  const ariaLabel = sanitizeText((await locator.getAttribute("aria-label")) ?? "");
  const title = sanitizeText((await locator.getAttribute("title")) ?? "");
  const label = innerText || ariaLabel || title;
  const href = await locator.getAttribute("href");
  const role = await locator.getAttribute("role");
  const ariaExpanded = await locator.getAttribute("aria-expanded");
  const ariaControls = await locator.getAttribute("aria-controls");
  const dataTestId = await locator.getAttribute("data-testid");
  const parentContext = sanitizeText(
    await locator.locator("xpath=..").innerText().catch(() => ""),
    200,
  );
  const childInteractiveCount = await locator
    .locator('a[href], button, [role="button"], [role="tab"], summary')
    .count()
    .catch(() => 0);

  return {
    tag,
    label,
    currentUrl: pageUrl,
    approvedOrigin,
    ...(href === null ? {} : { href }),
    ...(role === null ? {} : { role }),
    ...(ariaExpanded === null ? {} : { ariaExpanded }),
    ...(ariaControls === null ? {} : { ariaControls }),
    ...(dataTestId === null ? {} : { dataTestId }),
    ...(parentContext === "" ? {} : { parentContext }),
    childInteractiveCount,
  };
}

async function collectControls(page: Page, approvedOrigin: string): Promise<InternalControlRecord[]> {
  const pageUrl = page.url();
  const groups: ReadonlyArray<
    readonly [string, PublicControlDescriptor["tag"]]
  > = [
    ['a[href]', "a"],
    ["button", "button"],
    ['[role="button"]:not(button)', "role-button"],
    ['[role="tab"]', "role-tab"],
    ["summary", "summary"],
  ];
  const records: InternalControlRecord[] = [];
  const seen = new Set<string>();

  for (const [selector, tag] of groups) {
    const locators = page.locator(selector);
    const count = await locators.count();
    for (let index = 0; index < count; index += 1) {
      const locator = locators.nth(index);
      if (!(await locator.isVisible().catch(() => false))) continue;
      const descriptor = await buildDescriptor(locator, tag, pageUrl, approvedOrigin);
      if (descriptor.label === "" && descriptor.href === undefined) continue;
      const fingerprint = fingerprintControl(descriptor);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      records.push({
        locator,
        descriptor,
        decision: classifyPublicControl(descriptor),
        fingerprint,
      });
    }
  }

  return records;
}

function toEvidenceControl(record: InternalControlRecord): ExplorerEvidenceControl {
  const { descriptor, decision } = record;
  return {
    tag: descriptor.tag,
    label: descriptor.label,
    decision: decision.kind,
    reasonCode: decision.reasonCode,
    ...(descriptor.href === undefined
      ? {}
      : { hrefPath: sanitizePath(descriptor.href, descriptor.approvedOrigin) }),
    ...(descriptor.role === undefined ? {} : { role: descriptor.role }),
    ...(descriptor.ariaExpanded === undefined
      ? {}
      : { ariaExpanded: descriptor.ariaExpanded }),
    ...(descriptor.ariaControls === undefined
      ? {}
      : { ariaControls: descriptor.ariaControls }),
    ...(descriptor.dataTestId === undefined ? {} : { dataTestId: descriptor.dataTestId }),
    ...(descriptor.parentContext === undefined
      ? {}
      : { parentContext: descriptor.parentContext }),
    childInteractiveCount: descriptor.childInteractiveCount,
  };
}

function relevantEvidence(record: InternalControlRecord): boolean {
  const text = `${record.descriptor.label} ${record.descriptor.parentContext ?? ""}`;
  return (
    record.decision.kind === "ALLOW" ||
    /calcio|football|corner|angol|mercat|market|over|under/i.test(text)
  );
}

async function takeSnapshot(page: Page, approvedOrigin: string): Promise<{
  readonly evidence: ExplorerEvidenceSnapshot;
  readonly controls: InternalControlRecord[];
}> {
  const controls = await collectControls(page, approvedOrigin);
  const samples = controls.filter(relevantEvidence).slice(0, MAX_CONTROL_SAMPLES).map(toEvidenceControl);
  return {
    evidence: {
      path: sanitizePath(page.url(), approvedOrigin),
      title: sanitizeText(await page.title().catch(() => "")),
      controlCount: controls.length,
      allowedControlCount: controls.filter((record) => record.decision.kind === "ALLOW").length,
      samples,
    },
    controls,
  };
}

async function firstVisible(locator: Locator): Promise<boolean> {
  const count = await locator.count();
  for (let index = 0; index < Math.min(count, 4); index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function detectPageBlock(page: Page): Promise<ExplorerBlockReason | undefined> {
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

  const bodyText = sanitizeText(await page.locator("body").innerText().catch(() => ""), 20_000);
  if (ACCESS_BLOCK_TEXT.test(bodyText)) return "ACCESS_RESTRICTION";

  const dialogs = page.locator('[role="dialog"], [aria-modal="true"]');
  const dialogCount = await dialogs.count();
  for (let index = 0; index < Math.min(dialogCount, 4); index += 1) {
    const dialog = dialogs.nth(index);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    const dialogText = sanitizeText(await dialog.innerText().catch(() => ""), 1_000);
    if (CONSENT_CONTROL_TEXT.test(dialogText)) return "CONSENT_REQUIRED";
  }

  return undefined;
}

function chooseNextControl(
  controls: readonly InternalControlRecord[],
  usedFingerprints: ReadonlySet<string>,
): InternalControlRecord | undefined {
  return controls
    .filter(
      (record): record is InternalControlRecord & { decision: Extract<PublicControlDecision, { kind: "ALLOW" }> } =>
        record.decision.kind === "ALLOW" && !usedFingerprints.has(record.fingerprint),
    )
    .sort((left, right) => right.decision.priority - left.decision.priority)[0];
}

async function revalidateBeforeInteraction(record: InternalControlRecord): Promise<
  | Readonly<{
      kind: "ALLOW";
      decision: Extract<PublicControlDecision, { kind: "ALLOW" }>;
      descriptor: PublicControlDescriptor;
    }>
  | Readonly<{ kind: "DENY" }>
> {
  if (!(await record.locator.isVisible().catch(() => false))) return { kind: "DENY" };
  const freshDescriptor = await buildDescriptor(
    record.locator,
    record.descriptor.tag,
    record.descriptor.currentUrl,
    record.descriptor.approvedOrigin,
  );
  if (fingerprintControl(freshDescriptor) !== record.fingerprint) return { kind: "DENY" };
  const freshDecision = classifyPublicControl(freshDescriptor);
  return freshDecision.kind === "ALLOW"
    ? { kind: "ALLOW", decision: freshDecision, descriptor: freshDescriptor }
    : { kind: "DENY" };
}

export async function runInteractiveLiveExplorer(options: ExplorerOptions): Promise<ExplorerSummary> {
  const target = parseTarget(options);
  const actionBudget = parseBoundedInteger(
    options.maxActions,
    DEFAULT_MAX_ACTIONS,
    1,
    MAX_ACTIONS,
    "maxActions",
  );
  const delayMs = parseBoundedInteger(
    options.delayMs,
    DEFAULT_DELAY_MS,
    MIN_DELAY_MS,
    MAX_DELAY_MS,
    "delayMs",
  );
  const navigationPolicy = new NavigationPolicy([target.origin]);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const snapshots: ExplorerEvidenceSnapshot[] = [];
  const actions: ExplorerActionEvidence[] = [];
  const usedFingerprints = new Set<string>();
  let routeBlockReason: ExplorerBlockReason | undefined;

  await context.route("**/*", async (route) => {
    const request = route.request();
    let parsed: URL;
    try {
      parsed = new URL(request.url());
    } catch {
      await route.continue();
      return;
    }

    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.username !== "" || parsed.password !== "" || isInternalHostname(parsed.hostname))
    ) {
      routeBlockReason = "PRIVATE_OR_INTERNAL_DESTINATION";
      await route.abort("blockedbyclient");
      return;
    }

    const isTopLevelNavigation =
      request.isNavigationRequest() && request.frame().parentFrame() === null;
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
    await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(delayMs);

    while (actions.length < actionBudget) {
      if (routeBlockReason !== undefined) {
        return {
          bookmaker: options.bookmaker,
          approvedOrigin: target.origin,
          startPath: target.pathname,
          finalPath: sanitizePath(page.url(), target.origin),
          status: "BLOCKED",
          blockReason: routeBlockReason,
          actionBudget,
          actionsTaken: actions.length,
          snapshots,
          actions,
          authorizesProductionMapping: false,
          note:
            "Explorer stopped safely at a browser/network boundary. Evidence is diagnostic only and never authorizes production selectors.",
        };
      }

      const pageBlock = await detectPageBlock(page);
      if (pageBlock !== undefined) {
        return {
          bookmaker: options.bookmaker,
          approvedOrigin: target.origin,
          startPath: target.pathname,
          finalPath: sanitizePath(page.url(), target.origin),
          status: "BLOCKED",
          blockReason: pageBlock,
          actionBudget,
          actionsTaken: actions.length,
          snapshots,
          actions,
          authorizesProductionMapping: false,
          note:
            "Explorer encountered a public access/auth/consent boundary and stopped without attempting a bypass.",
        };
      }

      if (!navigationPolicy.isAllowed(page.url())) {
        return {
          bookmaker: options.bookmaker,
          approvedOrigin: target.origin,
          startPath: target.pathname,
          finalPath: "[unapproved-origin]",
          status: "BLOCKED",
          blockReason: "UNAPPROVED_NAVIGATION",
          actionBudget,
          actionsTaken: actions.length,
          snapshots,
          actions,
          authorizesProductionMapping: false,
          note: "Explorer stopped after final-location validation failed.",
        };
      }

      const snapshot = await takeSnapshot(page, target.origin);
      snapshots.push(snapshot.evidence);
      const next = chooseNextControl(snapshot.controls, usedFingerprints);
      if (next === undefined) {
        return {
          bookmaker: options.bookmaker,
          approvedOrigin: target.origin,
          startPath: target.pathname,
          finalPath: sanitizePath(page.url(), target.origin),
          status: "COMPLETE",
          actionBudget,
          actionsTaken: actions.length,
          snapshots,
          actions,
          authorizesProductionMapping: false,
          note:
            "No additional explicitly allowed public navigation/expansion control remained. Evidence is sanitized discovery data only.",
        };
      }

      usedFingerprints.add(next.fingerprint);
      const revalidated = await revalidateBeforeInteraction(next);
      if (revalidated.kind !== "ALLOW") continue;

      const beforePath = sanitizePath(page.url(), target.origin);
      if (revalidated.decision.interaction === "NAVIGATION") {
        const href = revalidated.descriptor.href;
        if (href === undefined) continue;
        const destination = new URL(href, page.url());
        if (!navigationPolicy.isAllowed(destination.href) || destination.origin !== target.origin) {
          routeBlockReason = "UNAPPROVED_NAVIGATION";
          continue;
        }
        await page.goto(destination.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
      } else {
        await next.locator.click({ timeout: 5_000 });
      }
      await page.waitForTimeout(delayMs);
      await page.waitForLoadState("domcontentloaded", { timeout: 3_000 }).catch(() => undefined);
      const afterPath = sanitizePath(page.url(), target.origin);
      actions.push({
        sequence: actions.length + 1,
        interaction: revalidated.decision.interaction,
        label: revalidated.descriptor.label,
        beforePath,
        afterPath,
      });
    }

    const finalSnapshot = await takeSnapshot(page, target.origin).catch(() => undefined);
    if (finalSnapshot !== undefined) snapshots.push(finalSnapshot.evidence);
    return {
      bookmaker: options.bookmaker,
      approvedOrigin: target.origin,
      startPath: target.pathname,
      finalPath: sanitizePath(page.url(), target.origin),
      status: "BUDGET_EXHAUSTED",
      actionBudget,
      actionsTaken: actions.length,
      snapshots,
      actions,
      authorizesProductionMapping: false,
      note:
        "Explorer stopped at the fixed interaction budget; it does not retry or increase the budget to defeat site restrictions.",
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

function parseBookmaker(value: string | undefined): ExplorerBookmaker {
  if (value === "admiralbet" || value === "sisal" || value === "bet365") return value;
  throw new Error("NH_LIVE_EXPLORER_BOOKMAKER must be one of: admiralbet, sisal, bet365.");
}

function parseOptionalInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer.`);
  return parsed;
}

async function main(): Promise<void> {
  const bookmaker = parseBookmaker(process.env.NH_LIVE_EXPLORER_BOOKMAKER);
  const url = process.env.NH_LIVE_EXPLORER_URL;
  const maxActions = parseOptionalInteger(process.env.NH_LIVE_EXPLORER_MAX_ACTIONS, "max actions");
  const delayMs = parseOptionalInteger(process.env.NH_LIVE_EXPLORER_DELAY_MS, "delay milliseconds");
  const summary = await runInteractiveLiveExplorer({
    bookmaker,
    ...(url === undefined ? {} : { url }),
    ...(maxActions === undefined ? {} : { maxActions }),
    ...(delayMs === undefined ? {} : { delayMs }),
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = summary.status === "BLOCKED" ? 2 : 0;
}

const invokedAsScript = process.argv[1]?.endsWith("interactive-explorer.ts") ?? false;
if (invokedAsScript) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown interactive explorer failure.";
    process.stderr.write(`Interactive live explorer failed safely: ${message}\n`);
    process.exitCode = 1;
  });
}
