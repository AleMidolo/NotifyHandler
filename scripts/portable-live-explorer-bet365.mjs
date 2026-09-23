import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PORTABLE_BOOKMAKER = "bet365";
export const PORTABLE_APPROVED_ORIGIN = "https://www.bet365.it";
export const PORTABLE_START_PATH = "/hub/it-it/football";
export const PORTABLE_NODE_VERSION = "24.21.0";
export const PORTABLE_PLAYWRIGHT_VERSION = "1.63.0";
export const PORTABLE_SUMMARY_FILE = "ExplorerSummary.json";

const MAX_SUMMARY_BYTES = 1_000_000;
const RELAY_SECRET_PATTERN = /(?:https:\/\/www\.bet-up\.it\/lnk\/|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/iu;
const ciSignals = Object.freeze([
  "CI",
  "GITHUB_ACTIONS",
  "TF_BUILD",
  "BUILD_BUILDID",
  "JENKINS_URL",
  "BUILDKITE",
  "CIRCLECI",
]);
const explorerOverrideKeys = Object.freeze([
  "NH_LIVE_EXPLORER_URL",
  "NH_LIVE_EXPLORER_MAX_ACTIONS",
  "NH_LIVE_EXPLORER_DELAY_MS",
]);

function bundleRootFromModuleUrl(moduleUrl = import.meta.url) {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..");
}

function isTruthyEnvironmentValue(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "0" && normalized !== "false" && normalized !== "no";
}

export function assertPortableNonCiEnvironment(environment = process.env) {
  const activeSignal = ciSignals.find((name) => isTruthyEnvironmentValue(environment[name]));
  if (activeSignal !== undefined) {
    throw new Error(
      `Live BOOK-012 validation is intentionally disabled in CI (${activeSignal} is set). Run the bundle on a normal Windows workstation.`,
    );
  }
}

export function parsePortableArguments(args) {
  if (args.length === 0) return "live";
  if (args.length === 1 && args[0] === "--synthetic-smoke") return "synthetic-smoke";
  throw new Error(
    "This diagnostic bundle is locked to BET365. It accepts no bookmaker, origin, URL, or live-explorer override arguments.",
  );
}

export function buildPortableExplorerEnvironment(environment, bundleRoot) {
  const childEnvironment = { ...environment };
  for (const key of explorerOverrideKeys) delete childEnvironment[key];
  delete childEnvironment.NODE_OPTIONS;
  childEnvironment.NH_LIVE_EXPLORER_BOOKMAKER = PORTABLE_BOOKMAKER;
  childEnvironment.PLAYWRIGHT_BROWSERS_PATH = join(bundleRoot, "browsers");
  return childEnvironment;
}

function normalizeVersion(value) {
  return String(value).trim().replace(/^v/, "");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function assertPortableBundlePrerequisites(bundleRoot) {
  if (normalizeVersion(process.version) !== PORTABLE_NODE_VERSION) {
    throw new Error(
      `Portable Node.js ${PORTABLE_NODE_VERSION} is required; found ${normalizeVersion(process.version) || "unknown"}.`,
    );
  }

  const manifest = await readJson(join(bundleRoot, "BUNDLE-MANIFEST.json"));
  if (
    manifest.bookmaker !== PORTABLE_BOOKMAKER ||
    manifest.approvedOrigin !== PORTABLE_APPROVED_ORIGIN ||
    manifest.startPath !== PORTABLE_START_PATH ||
    manifest.nodeVersion !== PORTABLE_NODE_VERSION ||
    manifest.playwrightCoreVersion !== PORTABLE_PLAYWRIGHT_VERSION ||
    manifest.authorizesProductionMapping !== false ||
    manifest.liveValidationAllowedInCi !== false ||
    manifest.supportsBetupRelay !== true
  ) {
    throw new Error("Portable bundle manifest does not match the reviewed BOOK-012 BET365 boundary.");
  }

  const playwrightPackage = await readJson(
    join(bundleRoot, "node_modules", "playwright-core", "package.json"),
  );
  if (normalizeVersion(playwrightPackage.version) !== PORTABLE_PLAYWRIGHT_VERSION) {
    throw new Error(
      `Portable playwright-core ${PORTABLE_PLAYWRIGHT_VERSION} is required; found ${playwrightPackage.version ?? "unknown"}.`,
    );
  }

  await access(join(bundleRoot, "browsers"));
  await access(join(bundleRoot, "app", "packages", "automation", "src", "live-validation", "interactive-explorer.ts"));
  await access(join(bundleRoot, "app", "packages", "automation", "src", "navigation-policy.ts"));
  await access(join(bundleRoot, "app", "packages", "automation", "src", "dom-mapping.ts"));
  await access(join(bundleRoot, "app", "packages", "automation", "src", "page-runtime.ts"));
}

async function assertBet365NetworkPrerequisite() {
  const hostnames = [new URL(PORTABLE_APPROVED_ORIGIN).hostname];
  if (process.env.NH_LIVE_EXPLORER_RELAY_URL !== undefined) hostnames.unshift("www.bet-up.it");
  for (const hostname of hostnames) {
    try {
      await lookup(hostname);
    } catch {
      throw new Error(
        `Network prerequisite failed: DNS could not resolve ${hostname}. Use a normal workstation with outbound DNS/HTTPS; this is environment evidence, not bookmaker evidence.`,
      );
    }
  }
}

export function validatePortableExplorerSummary(rawSummary) {
  const rawText = String(rawSummary).trim();
  let summary;
  try {
    summary = JSON.parse(rawText);
  } catch {
    throw new Error("BOOK-012 did not emit valid sanitized ExplorerSummary JSON.");
  }

  const validStatuses = new Set(["COMPLETE", "BLOCKED", "BUDGET_EXHAUSTED"]);
  const validRelayInvalidCategories = new Set([
    "ENTRY_CONTRACT",
    "TOP_LEVEL_METHOD",
    "MALFORMED_NAVIGATION",
    "CANONICAL_URL_BOUNDARY",
    "UNREVIEWED_SAME_ORIGIN_PATH",
    "MALFORMED_SIGNAL",
    "CANONICAL_IDENTITY_MISMATCH",
    "START_URL_MISMATCH",
  ]);
  const allowedTopLevelKeys = new Set([
    "bookmaker",
    "approvedOrigin",
    "navigationKind",
    "relayOrigin",
    "startPath",
    "finalPath",
    "status",
    "blockReason",
    "relayInvalidCategory",
    "actionBudget",
    "actionsTaken",
    "snapshots",
    "actions",
    "authorizesProductionMapping",
    "note",
  ]);
  const isObject = summary !== null && typeof summary === "object";
  const isRelayNavigation = isObject && summary.navigationKind === "BETUP_RELAY";
  const isDirectNavigation = isObject && summary.navigationKind === "BOOKMAKER_DIRECT";
  const isRelayFailure = isObject
    && typeof summary.blockReason === "string"
    && summary.blockReason.startsWith("RELAY_");
  const isRelayInvalid = isObject && summary.blockReason === "RELAY_INVALID";
  const isPreBookmakerRelayPlaceholder = isObject
    && summary.startPath === "[bet-up-relay]"
    && summary.finalPath === "[relay-unresolved]";
  if (
    !isObject ||
    Object.keys(summary).some((key) => !allowedTopLevelKeys.has(key)) ||
    summary.bookmaker !== PORTABLE_BOOKMAKER ||
    summary.approvedOrigin !== PORTABLE_APPROVED_ORIGIN ||
    (!isRelayNavigation && !isDirectNavigation) ||
    (
      isRelayNavigation
        ? (
            summary.relayOrigin !== "https://www.bet-up.it" ||
            typeof summary.startPath !== "string" ||
            (summary.startPath !== "[bet-up-relay]" && !summary.startPath.startsWith("/")) ||
            "signalId" in summary ||
            "relayUrl" in summary ||
            RELAY_SECRET_PATTERN.test(rawText)
          )
        : (
            summary.relayOrigin !== undefined ||
            summary.startPath !== PORTABLE_START_PATH
          )
    ) ||
    !validStatuses.has(summary.status) ||
    (
      summary.status === "BLOCKED"
        ? typeof summary.blockReason !== "string"
        : summary.blockReason !== undefined
    ) ||
    (
      isRelayFailure
      && (
        !isRelayNavigation
        || summary.status !== "BLOCKED"
        || !isPreBookmakerRelayPlaceholder
        || summary.actionsTaken !== 0
        || !Array.isArray(summary.snapshots)
        || summary.snapshots.length !== 0
        || !Array.isArray(summary.actions)
        || summary.actions.length !== 0
      )
    ) ||
    (
      isRelayInvalid
        ? !validRelayInvalidCategories.has(summary.relayInvalidCategory)
        : summary.relayInvalidCategory !== undefined
    ) ||
    summary.authorizesProductionMapping !== false ||
    !Number.isInteger(summary.actionBudget) ||
    summary.actionBudget < 1 ||
    summary.actionBudget > 12 ||
    !Number.isInteger(summary.actionsTaken) ||
    summary.actionsTaken < 0 ||
    summary.actionsTaken > summary.actionBudget ||
    !Array.isArray(summary.snapshots) ||
    !Array.isArray(summary.actions)
  ) {
    throw new Error("BOOK-012 ExplorerSummary failed the portable BET365 boundary validation.");
  }

  return summary;
}

async function runSyntheticSmoke(bundleRoot) {
  await assertPortableBundlePrerequisites(bundleRoot);
  const environment = buildPortableExplorerEnvironment(process.env, bundleRoot);
  const previousBrowserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  process.env.PLAYWRIGHT_BROWSERS_PATH = environment.PLAYWRIGHT_BROWSERS_PATH;
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.setContent("<!doctype html><title>NotifyHandler portable synthetic smoke</title>");
        if ((await page.title()) !== "NotifyHandler portable synthetic smoke") {
          throw new Error("Packaged Chromium synthetic smoke returned an unexpected local page title.");
        }
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (previousBrowserPath === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = previousBrowserPath;
  }

  return {
    mode: "SYNTHETIC_SMOKE_OK",
    bookmaker: PORTABLE_BOOKMAKER,
    approvedOrigin: PORTABLE_APPROVED_ORIGIN,
    networkContacted: false,
    authorizesProductionMapping: false,
  };
}

async function runLiveExplorer(bundleRoot) {
  assertPortableNonCiEnvironment(process.env);
  await assertPortableBundlePrerequisites(bundleRoot);
  await assertBet365NetworkPrerequisite();

  const summaryPath = join(bundleRoot, PORTABLE_SUMMARY_FILE);
  await rm(summaryPath, { force: true });

  const explorerPath = join(
    bundleRoot,
    "app",
    "packages",
    "automation",
    "src",
    "live-validation",
    "interactive-explorer.ts",
  );
  const environment = buildPortableExplorerEnvironment(process.env, bundleRoot);

  const result = await new Promise((resolveResult, rejectResult) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", explorerPath], {
      cwd: bundleRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const stdoutChunks = [];
    let stdoutBytes = 0;
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_SUMMARY_BYTES) {
        child.kill();
        rejectResult(new Error("BOOK-012 sanitized summary exceeded the portable output size limit."));
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("error", rejectResult);
    child.once("close", (code, signal) => {
      if (signal !== null) {
        rejectResult(new Error(`BOOK-012 explorer terminated by signal ${signal}.`));
        return;
      }
      resolveResult({ code: code ?? 1, stdout: Buffer.concat(stdoutChunks).toString("utf8") });
    });
  });

  if (result.code !== 0 && result.code !== 2) {
    throw new Error(`BOOK-012 explorer exited with code ${result.code}; no summary file was retained.`);
  }

  const summary = validatePortableExplorerSummary(result.stdout);
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  await writeFile(summaryPath, serialized, "utf8");
  process.stdout.write(serialized);
  return result.code;
}

export async function runPortableMain(args = process.argv.slice(2), moduleUrl = import.meta.url) {
  const mode = parsePortableArguments(args);
  const bundleRoot = bundleRootFromModuleUrl(moduleUrl);
  if (mode === "synthetic-smoke") {
    const result = await runSyntheticSmoke(bundleRoot);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  }
  return runLiveExplorer(bundleRoot);
}

const invokedAsScript =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  void runPortableMain()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown portable BOOK-012 runner failure.";
      process.stderr.write(`NotifyHandler portable BOOK-012 runner failed safely: ${message}\n`);
      process.exitCode = 1;
    });
}
