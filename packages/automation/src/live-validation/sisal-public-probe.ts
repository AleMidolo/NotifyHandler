import { chromium } from "playwright-core";

const SISAL_ORIGIN = "https://www.sisal.it";
const DEFAULT_URL = `${SISAL_ORIGIN}/scommesse-matchpoint/sport/calcio`;
const EVENT_PATH = "/scommesse-matchpoint/evento/calcio/";
const MAX_SAMPLES = 12;

interface ProbeSummary {
  readonly bookmaker: "sisal";
  readonly requestedPath: string;
  readonly finalPath: string;
  readonly approvedOrigin: boolean;
  readonly title: string;
  readonly eventLinkCount: number;
  readonly eventSamples: readonly Readonly<{ path: string; label: string }>[];
  readonly cornerControlCount: number;
  readonly cornerControlLabels: readonly string[];
  readonly authLinkCount: number;
  readonly mappingEvidenceSufficient: boolean;
  readonly note: string;
}

function parseApprovedUrl(value: string): URL {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== SISAL_ORIGIN ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error("SISAL live probe only accepts credential-free HTTPS URLs on https://www.sisal.it.");
  }
  return parsed;
}

function sanitizeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function sanitizePath(value: string): string {
  try {
    const parsed = new URL(value, SISAL_ORIGIN);
    return parsed.origin === SISAL_ORIGIN ? parsed.pathname : "[unapproved-origin]";
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
    const eventLinks = page.locator(`a[href*="${EVENT_PATH}"]`);
    const eventLinkCount = await eventLinks.count();
    const eventSamples: Array<{ path: string; label: string }> = [];
    for (let index = 0; index < Math.min(eventLinkCount, MAX_SAMPLES); index += 1) {
      const link = eventLinks.nth(index);
      eventSamples.push({
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

    const authLinkCount = await page.locator('a[href^="https://areaprivata.sisal.it"]').count();
    const mappingEvidenceSufficient = eventLinkCount > 0 && cornerControlCount > 0;

    return {
      bookmaker: "sisal",
      requestedPath: target.pathname,
      finalPath: finalUrl.pathname,
      approvedOrigin: finalUrl.origin === SISAL_ORIGIN,
      title: sanitizeLabel(await page.title()),
      eventLinkCount,
      eventSamples,
      cornerControlCount,
      cornerControlLabels,
      authLinkCount,
      mappingEvidenceSufficient,
      note: mappingEvidenceSufficient
        ? "Public structural candidates were observed. This probe does not authorize production selectors; validate event/market/line/outcome/odds semantics separately before promotion."
        : "Insufficient public structural evidence for deterministic production mapping. Do not invent or promote selectors from this result.",
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function runSisalPublicProbe(options: Readonly<{
  url?: string;
  headless?: boolean;
}> = {}): Promise<ProbeSummary> {
  const target = parseApprovedUrl(options.url ?? DEFAULT_URL);
  return collectPublicSummary(target, options.headless ?? false);
}

async function main(): Promise<void> {
  const summary = await runSisalPublicProbe({
    url: process.env.NH_SISAL_LIVE_PROBE_URL,
    headless: process.env.NH_SISAL_LIVE_PROBE_HEADLESS === "1",
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.mappingEvidenceSufficient) process.exitCode = 2;
}

const invokedAsScript = process.argv[1]?.endsWith("sisal-public-probe.ts") ?? false;
if (invokedAsScript) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown SISAL probe failure.";
    process.stderr.write(`SISAL public probe failed safely: ${message}\n`);
    process.exitCode = 1;
  });
}
