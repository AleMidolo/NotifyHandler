import { chromium, type Locator } from "playwright-core";

const ADMIRALBET_ORIGIN = "https://www.admiralbet.it";
const DEFAULT_URL = `${ADMIRALBET_ORIGIN}/scommesse`;
const MAX_SAMPLES = 12;

interface ProbeSummary {
  readonly bookmaker: "admiralbet";
  readonly requestedPath: string;
  readonly finalPath: string;
  readonly approvedOrigin: boolean;
  readonly title: string;
  readonly footballCandidateCount: number;
  readonly footballCandidateLabels: readonly string[];
  readonly overUnderCandidateCount: number;
  readonly overUnderCandidateLabels: readonly string[];
  readonly cornerCandidateCount: number;
  readonly cornerCandidateLabels: readonly string[];
  readonly eventLinkCount: number;
  readonly eventLinkSamples: readonly Readonly<{ path: string; label: string }>[];
  readonly mappingEvidenceSufficient: false;
  readonly note: string;
}

function parseApprovedUrl(value: string): URL {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== ADMIRALBET_ORIGIN ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error(
      "ADMIRALBET live probe only accepts credential-free HTTPS URLs on https://www.admiralbet.it.",
    );
  }
  return parsed;
}

function sanitizeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function sanitizePath(value: string): string {
  try {
    const parsed = new URL(value, ADMIRALBET_ORIGIN);
    return parsed.origin === ADMIRALBET_ORIGIN ? parsed.pathname : "[unapproved-origin]";
  } catch {
    return "[invalid-url]";
  }
}

async function collectLabels(locator: Locator): Promise<string[]> {
  const labels: string[] = [];
  const count = await locator.count();
  for (let index = 0; index < Math.min(count, MAX_SAMPLES); index += 1) {
    labels.push(sanitizeLabel(await locator.nth(index).innerText().catch(() => "")));
  }
  return labels;
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
    const interactive = page.locator('a, button, [role="button"]');

    const footballCandidates = interactive.filter({ hasText: /calcio|football/i });
    const overUnderCandidates = interactive.filter({ hasText: /under|over|u\/o/i });
    const cornerCandidates = interactive.filter({ hasText: /corner|angol/i });

    const footballCandidateCount = await footballCandidates.count();
    const overUnderCandidateCount = await overUnderCandidates.count();
    const cornerCandidateCount = await cornerCandidates.count();

    const eventLinks = page.locator('a[href]');
    const eventLinkSamples: Array<{ path: string; label: string }> = [];
    let eventLinkCount = 0;
    for (let index = 0; index < await eventLinks.count(); index += 1) {
      const link = eventLinks.nth(index);
      const label = sanitizeLabel(await link.innerText().catch(() => ""));
      const href = (await link.getAttribute("href")) ?? "";
      if (!/calcio|football|scommess|prematch|event|match|sport/i.test(`${label} ${href}`)) continue;
      eventLinkCount += 1;
      if (eventLinkSamples.length < MAX_SAMPLES) {
        eventLinkSamples.push({ path: sanitizePath(href), label });
      }
    }

    return {
      bookmaker: "admiralbet",
      requestedPath: target.pathname,
      finalPath: finalUrl.pathname,
      approvedOrigin: finalUrl.origin === ADMIRALBET_ORIGIN,
      title: sanitizeLabel(await page.title()),
      footballCandidateCount,
      footballCandidateLabels: await collectLabels(footballCandidates),
      overUnderCandidateCount,
      overUnderCandidateLabels: await collectLabels(overUnderCandidates),
      cornerCandidateCount,
      cornerCandidateLabels: await collectLabels(cornerCandidates),
      eventLinkCount,
      eventLinkSamples,
      mappingEvidenceSufficient: false,
      note:
        "Public event and generic market candidates are discovery evidence only. Feasibility requires selector-level proof tying one exact pre-match event to full-match total corners, exact line, side, displayed odds, and selected state; generic goal U/O or live corner statistics do not satisfy that contract.",
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function runAdmiralbetPublicProbe(
  options: Readonly<{ url?: string; headless?: boolean }> = {},
): Promise<ProbeSummary> {
  const target = parseApprovedUrl(options.url ?? DEFAULT_URL);
  return collectPublicSummary(target, options.headless ?? false);
}

async function main(): Promise<void> {
  const configuredUrl = process.env.NH_ADMIRALBET_LIVE_PROBE_URL;
  const summary = await runAdmiralbetPublicProbe({
    ...(configuredUrl === undefined ? {} : { url: configuredUrl }),
    headless: process.env.NH_ADMIRALBET_LIVE_PROBE_HEADLESS === "1",
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = 2;
}

const invokedAsScript = process.argv[1]?.endsWith("admiralbet-public-probe.ts") ?? false;
if (invokedAsScript) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown ADMIRALBET probe failure.";
    process.stderr.write(`ADMIRALBET public probe failed safely: ${message}\n`);
    process.exitCode = 1;
  });
}
