import { chromium } from "playwright-core";

const BET365_ORIGIN = "https://www.bet365.it";
const DEFAULT_URL = `${BET365_ORIGIN}/hub/it-it/football`;
const MAX_SAMPLES = 12;

interface ProbeSummary {
  readonly bookmaker: "bet365";
  readonly requestedPath: string;
  readonly finalPath: string;
  readonly approvedOrigin: boolean;
  readonly title: string;
  readonly footballLinkCount: number;
  readonly footballLinkSamples: readonly Readonly<{ path: string; label: string }>[];
  readonly cornerControlCount: number;
  readonly cornerControlLabels: readonly string[];
  readonly decimalOddsControlCount: number;
  readonly decimalOddsSamples: readonly string[];
  readonly authControlCount: number;
  readonly mappingEvidenceSufficient: false;
  readonly note: string;
}

function parseApprovedUrl(value: string): URL {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== BET365_ORIGIN ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error("BET365 live probe only accepts credential-free HTTPS URLs on https://www.bet365.it.");
  }
  return parsed;
}

function sanitizeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function sanitizePath(value: string): string {
  try {
    const parsed = new URL(value, BET365_ORIGIN);
    return parsed.origin === BET365_ORIGIN ? parsed.pathname : "[unapproved-origin]";
  } catch {
    return "[invalid-url]";
  }
}

async function collectPublicSummary(target: URL, headless: boolean): Promise<ProbeSummary> {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  try {
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        try {
          parseApprovedUrl(request.url());
        } catch {
          await route.abort("blockedbyclient");
          return;
        }
      }
      await route.continue();
    });

    await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(3_000);

    const finalUrl = parseApprovedUrl(page.url());
    const footballLinks = page.locator('a[href*="/hub/it-it/football"]');
    const footballLinkCount = await footballLinks.count();
    const footballLinkSamples: Array<{ path: string; label: string }> = [];
    for (let index = 0; index < Math.min(footballLinkCount, MAX_SAMPLES); index += 1) {
      const link = footballLinks.nth(index);
      footballLinkSamples.push({
        path: sanitizePath((await link.getAttribute("href")) ?? ""),
        label: sanitizeLabel(await link.innerText().catch(() => "")),
      });
    }

    const cornerControls = page
      .locator('button, [role="button"], a')
      .filter({ hasText: /corner|angol/i });
    const cornerControlCount = await cornerControls.count();
    const cornerControlLabels: string[] = [];
    for (let index = 0; index < Math.min(cornerControlCount, MAX_SAMPLES); index += 1) {
      cornerControlLabels.push(sanitizeLabel(await cornerControls.nth(index).innerText().catch(() => "")));
    }

    const controls = page.locator('button, [role="button"], a');
    const controlCount = await controls.count();
    const decimalOddsSamples: string[] = [];
    for (let index = 0; index < controlCount && decimalOddsSamples.length < MAX_SAMPLES; index += 1) {
      const label = sanitizeLabel(await controls.nth(index).innerText().catch(() => ""));
      if (/\b\d{1,3}\.\d{2}\b/.test(label)) decimalOddsSamples.push(label);
    }

    const authControlCount = await page
      .locator('button, [role="button"], a')
      .filter({ hasText: /accedi|login|log in/i })
      .count();

    return {
      bookmaker: "bet365",
      requestedPath: target.pathname,
      finalPath: finalUrl.pathname,
      approvedOrigin: finalUrl.origin === BET365_ORIGIN,
      title: sanitizeLabel(await page.title()),
      footballLinkCount,
      footballLinkSamples,
      cornerControlCount,
      cornerControlLabels,
      decimalOddsControlCount: decimalOddsSamples.length,
      decimalOddsSamples,
      authControlCount,
      mappingEvidenceSufficient: false,
      note:
        "This read-only public probe can surface structural candidates only. It cannot prove the required event-to-market-to-exact-line-to-outcome-to-odds semantic relationship or selected-state verification, so it never authorizes production selectors by itself.",
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function runBet365PublicProbe(options: Readonly<{
  url?: string;
  headless?: boolean;
}> = {}): Promise<ProbeSummary> {
  const target = parseApprovedUrl(options.url ?? DEFAULT_URL);
  return collectPublicSummary(target, options.headless ?? false);
}

async function main(): Promise<void> {
  const configuredUrl = process.env.NH_BET365_LIVE_PROBE_URL;
  const summary = await runBet365PublicProbe({
    ...(configuredUrl === undefined ? {} : { url: configuredUrl }),
    headless: process.env.NH_BET365_LIVE_PROBE_HEADLESS === "1",
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = 2;
}

const invokedAsScript = process.argv[1]?.endsWith("bet365-public-probe.ts") ?? false;
if (invokedAsScript) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown BET365 probe failure.";
    process.stderr.write(`BET365 public probe failed safely: ${message}\n`);
    process.exitCode = 1;
  });
}
