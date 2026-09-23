import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, "dist", "live-validation");
const APPROVED_BOOKMAKER = "sisal";
const APPROVED_ORIGIN = "https://www.sisal.it";
const START_PATH = "/scommesse-matchpoint/sport/calcio";
const CHECKSUM_CONCURRENCY = 8;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assertExactVersion(name, actual, expected) {
  const normalizedActual = String(actual).trim().replace(/^v/, "");
  const normalizedExpected = String(expected).trim().replace(/^v/, "");
  if (normalizedActual !== normalizedExpected) {
    throw new Error(`${name} ${normalizedExpected} is required; found ${normalizedActual || "unknown"}.`);
  }
}

export function windowsLauncherText() {
  return [
    "@echo off",
    "setlocal",
    "cd /d \"%~dp0\"",
    "if not exist \"runtime\\node.exe\" (",
    "  echo NotifyHandler portable runtime is incomplete: runtime\\node.exe is missing. 1>&2",
    "  exit /b 1",
    ")",
    "\"runtime\\node.exe\" \"app\\portable-live-explorer.mjs\" %*",
    "exit /b %ERRORLEVEL%",
    "",
  ].join("\r\n");
}

function operatorReadmeText(sourceCommit) {
  return [
    "NotifyHandler BOOK-012 SISAL diagnostic runner",
    "===================================================",
    "",
    "DIAGNOSTIC / NON-PRODUCTION. This bundle does not claim live bookmaker support and is not suitable for unattended or real-money operation.",
    "It is locked to the credential-free public origin https://www.sisal.it and reuses the reviewed BOOK-012 explorer unchanged.",
    "",
    `Source commit: ${sourceCommit}`,
    "",
    "Requirements:",
    "- Windows x64 workstation with a normal headed desktop session",
    "- outbound DNS/HTTPS access to www.sisal.it",
    "- no separately installed Node.js/npm and no repository checkout are required",
    "",
    "Run:",
    "1. Verify the ZIP SHA-256 before extracting.",
    "2. Extract to a fresh writable directory.",
    "3. For BOOK-016 relay evidence, set NH_LIVE_EXPLORER_RELAY_URL to the credential-free bet-up relay supplied by the upstream signal; otherwise the reviewed default bookmaker start path is used.",
    "4. Double-click run-sisal-validation.cmd or execute it from cmd/PowerShell.",
    "5. The headed Chromium window may resolve the restricted bet-up relay and then navigate/expand only BOOK-012-approved public non-transactional controls.",
    "6. On a valid BOOK-012 result, sanitized JSON is printed to stdout and saved as ExplorerSummary.json next to this README.",
    "7. Attach only ExplorerSummary.json to NotifyHandler issue #63. Do not attach browser/session data or other captures.",
    "",
    "The runner refuses normal live execution when common CI signals are active. CI uses only --synthetic-smoke, which launches packaged Chromium against local in-memory content and does not contact a bookmaker.",
    "",
    "The bundle does not store browser profiles, cookies, storage, credentials, auth state, screenshots, traces, videos, HAR, HTML dumps, stakes, or wager data.",
    "It does not automate login, MFA, CAPTCHA, outcome activation, betslip/stake/payment controls, or wager submission, and it adds no proxy/access-control bypass.",
    "",
  ].join("\r\n");
}

function sha256(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", rejectHash);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function listFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await listFiles(path)));
    else if (entry.isFile()) result.push(path);
    else throw new Error(`Unexpected non-file bundle entry: ${path}`);
  }
  return result;
}

async function requirePath(path, description) {
  try {
    await access(path);
  } catch {
    throw new Error(`${description} is missing: ${path}`);
  }
}

function copyDirectory(source, destination, description) {
  const result = spawnSync(
    "robocopy",
    [
      source,
      destination,
      "/E",
      "/COPY:DAT",
      "/DCOPY:DAT",
      "/R:2",
      "/W:1",
      "/NFL",
      "/NDL",
      "/NJH",
      "/NJS",
      "/NP",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.error) {
    throw new Error(`Unable to copy ${description}: ${result.error.message}`);
  }
  const status = result.status ?? 16;
  if (status >= 8) {
    const detail = String(result.stderr || result.stdout || "robocopy failed").trim();
    throw new Error(`Unable to copy ${description} (robocopy exit ${status}): ${detail}`);
  }
}

async function buildChecksumLines(files, bundle) {
  const lines = new Array(files.length);
  let nextIndex = 0;
  const workerCount = Math.min(CHECKSUM_CONCURRENCY, Math.max(files.length, 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= files.length) return;
        const path = files[index];
        const relativePath = relative(bundle, path).replaceAll("\\", "/");
        lines[index] = `${await sha256(path)}  ${relativePath}`;
      }
    }),
  );
  return lines;
}

function resolveChromiumMetadata(browsersMetadata) {
  const chromium = Array.isArray(browsersMetadata?.browsers)
    ? browsersMetadata.browsers.find((entry) => entry?.name === "chromium")
    : undefined;
  if (
    chromium === undefined ||
    typeof chromium.revision !== "string" ||
    typeof chromium.browserVersion !== "string"
  ) {
    throw new Error("Locked playwright-core browsers.json does not define Chromium metadata.");
  }
  return { revision: chromium.revision, version: chromium.browserVersion };
}

export async function buildPortableValidationBundle(options = {}) {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("The BOOK-012 portable diagnostic bundle must be built on Windows x64.");
  }

  const sourceCommit = options.sourceCommit ?? process.env.NOTIFYHANDLER_SOURCE_COMMIT;
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit ?? "")) {
    throw new Error("NOTIFYHANDLER_SOURCE_COMMIT must be the exact 40-character source commit SHA.");
  }

  const browsersSource = options.browsersSource ?? process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsersSource) {
    throw new Error("PLAYWRIGHT_BROWSERS_PATH must point to the pinned Chromium staging directory.");
  }

  const [nodePin, automationPackage] = await Promise.all([
    readFile(join(root, ".nvmrc"), "utf8"),
    readJson(join(root, "packages", "automation", "package.json")),
  ]);
  const expectedNode = nodePin.trim();
  const expectedPlaywright = automationPackage.dependencies?.["playwright-core"];
  if (typeof expectedPlaywright !== "string") {
    throw new Error("Automation package does not pin playwright-core.");
  }
  assertExactVersion("Node.js", process.version, expectedNode);

  const [installedPlaywrightPackage, browsersMetadata] = await Promise.all([
    readJson(join(root, "node_modules", "playwright-core", "package.json")),
    readJson(join(root, "node_modules", "playwright-core", "browsers.json")),
  ]);
  assertExactVersion("playwright-core", installedPlaywrightPackage.version, expectedPlaywright);
  const chromiumMetadata = resolveChromiumMetadata(browsersMetadata);

  await requirePath(process.execPath, "Pinned Node.js executable");
  await requirePath(join(root, "node_modules", "playwright-core"), "Locked playwright-core package");
  await requirePath(browsersSource, "Pinned Playwright browser staging directory");

  const { chromium } = await import("playwright-core");
  await requirePath(chromium.executablePath(), "Pinned Chromium executable");

  const shortSha = sourceCommit.slice(0, 12).toLowerCase();
  const bundleName = `notifyhandler-book012-sisal-${shortSha}-win32-x64`;
  const bundle = join(outputRoot, bundleName);
  await rm(bundle, { recursive: true, force: true });
  await mkdir(bundle, { recursive: true });

  await mkdir(join(bundle, "runtime"), { recursive: true });
  await cp(process.execPath, join(bundle, "runtime", "node.exe"));
  const nodeLicenseSource = join(dirname(process.execPath), "LICENSE");
  await requirePath(nodeLicenseSource, "Node.js redistribution license");
  await cp(nodeLicenseSource, join(bundle, "runtime", "LICENSE.txt"));

  await mkdir(join(bundle, "app", "packages", "automation", "src", "live-validation"), {
    recursive: true,
  });
  await cp(
    join(root, "scripts", "portable-live-explorer-sisal.mjs"),
    join(bundle, "app", "portable-live-explorer.mjs"),
  );
  await cp(
    join(root, "packages", "automation", "src", "live-validation", "interactive-explorer.ts"),
    join(bundle, "app", "packages", "automation", "src", "live-validation", "interactive-explorer.ts"),
  );
  await cp(
    join(root, "packages", "automation", "src", "navigation-policy.ts"),
    join(bundle, "app", "packages", "automation", "src", "navigation-policy.ts"),
  );
  await cp(
    join(root, "packages", "automation", "src", "dom-mapping.ts"),
    join(bundle, "app", "packages", "automation", "src", "dom-mapping.ts"),
  );
  await cp(
    join(root, "packages", "automation", "src", "page-runtime.ts"),
    join(bundle, "app", "packages", "automation", "src", "page-runtime.ts"),
  );
  await writeFile(join(bundle, "app", "package.json"), '{"type":"module","private":true}\n', "utf8");

  await mkdir(join(bundle, "node_modules"), { recursive: true });
  copyDirectory(
    join(root, "node_modules", "playwright-core"),
    join(bundle, "node_modules", "playwright-core"),
    "locked playwright-core package",
  );
  copyDirectory(browsersSource, join(bundle, "browsers"), "pinned Playwright browser runtime");

  const manifest = {
    formatVersion: 1,
    artifactType: "BOOK-012 portable live-validation diagnostic",
    diagnosticOnly: true,
    sourceCommit: sourceCommit.toLowerCase(),
    platform: "win32",
    architecture: "x64",
    bookmaker: APPROVED_BOOKMAKER,
    approvedOrigin: APPROVED_ORIGIN,
    startPath: START_PATH,
    nodeVersion: expectedNode,
    playwrightCoreVersion: expectedPlaywright,
    chromiumRevision: chromiumMetadata.revision,
    chromiumVersion: chromiumMetadata.version,
    liveValidationAllowedInCi: false,
    supportsBetupRelay: true,
    authorizesProductionMapping: false,
    outputFile: "ExplorerSummary.json",
  };
  await writeFile(join(bundle, "BUNDLE-MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(bundle, "README.txt"), operatorReadmeText(sourceCommit.toLowerCase()), "utf8");
  await writeFile(join(bundle, "run-sisal-validation.cmd"), windowsLauncherText(), "utf8");

  const files = (await listFiles(bundle))
    .filter((path) => relative(bundle, path).replaceAll("\\", "/") !== "SHA256SUMS.txt")
    .sort((a, b) => a.localeCompare(b));
  const checksumLines = await buildChecksumLines(files, bundle);
  await writeFile(join(bundle, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`, "ascii");

  return { bundle, bundleName, manifest, fileCount: files.length + 1 };
}

async function main() {
  const result = await buildPortableValidationBundle();
  process.stdout.write(`Built ${result.bundleName} with ${result.fileCount} files.\n`);
}

const invokedAsScript =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown portable bundle build failure.";
    process.stderr.write(`Portable validation bundle build failed: ${message}\n`);
    process.exitCode = 1;
  });
}
