import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, "dist", "live-validation");
const expectedTopLevelEntries = new Set([
  "app",
  "browsers",
  "BUNDLE-MANIFEST.json",
  "node_modules",
  "README.txt",
  "run-sisal-validation.cmd",
  "runtime",
  "SHA256SUMS.txt",
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function sha256(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

async function findBundle() {
  const entries = await readdir(outputRoot, { withFileTypes: true });
  const bundles = entries.filter(
    (entry) => entry.isDirectory() && /^notifyhandler-book012-sisal-[0-9a-f]{12}-win32-x64$/.test(entry.name),
  );
  if (bundles.length !== 1) {
    throw new Error(`Expected exactly one portable validation bundle; found ${bundles.length}.`);
  }
  return join(outputRoot, bundles[0].name);
}

async function verifyChecksums(bundle) {
  const checksumText = await readFile(join(bundle, "SHA256SUMS.txt"), "ascii");
  const lines = checksumText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 10) throw new Error("Portable bundle checksum inventory is unexpectedly small.");

  for (const line of lines) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    if (!match) throw new Error(`Invalid checksum inventory line: ${line}`);
    const [, expectedHash, relativePath] = match;
    if (relativePath === "SHA256SUMS.txt" || relativePath.includes("..") || relativePath.startsWith("/")) {
      throw new Error(`Unsafe checksum inventory path: ${relativePath}`);
    }
    const actualHash = await sha256(join(bundle, ...relativePath.split("/")));
    if (actualHash !== expectedHash) {
      throw new Error(`Checksum mismatch for ${relativePath}.`);
    }
  }
}

export async function verifyPortableValidationBundle() {
  const bundle = await findBundle();
  const [nodePin, automationPackage, manifest, runnerSource, launcher] = await Promise.all([
    readFile(join(root, ".nvmrc"), "utf8"),
    readJson(join(root, "packages", "automation", "package.json")),
    readJson(join(bundle, "BUNDLE-MANIFEST.json")),
    readFile(join(bundle, "app", "portable-live-explorer.mjs"), "utf8"),
    readFile(join(bundle, "run-sisal-validation.cmd"), "utf8"),
  ]);

  if (
    manifest.formatVersion !== 1 ||
    manifest.diagnosticOnly !== true ||
    manifest.platform !== "win32" ||
    manifest.architecture !== "x64" ||
    manifest.bookmaker !== "sisal" ||
    manifest.approvedOrigin !== "https://www.sisal.it" ||
    manifest.startPath !== "/scommesse-matchpoint/sport/calcio" ||
    manifest.nodeVersion !== nodePin.trim() ||
    manifest.playwrightCoreVersion !== automationPackage.dependencies?.["playwright-core"] ||
    manifest.liveValidationAllowedInCi !== false ||
    manifest.supportsBetupRelay !== true ||
    manifest.authorizesProductionMapping !== false ||
    !/^[0-9a-f]{40}$/.test(manifest.sourceCommit)
  ) {
    throw new Error("Portable bundle manifest violates the reviewed DEVOPS-008 boundary.");
  }

  for (const path of [
    join(bundle, "runtime", "node.exe"),
    join(bundle, "runtime", "LICENSE.txt"),
    join(bundle, "node_modules", "playwright-core", "package.json"),
    join(bundle, "browsers"),
    join(bundle, "app", "packages", "automation", "src", "live-validation", "interactive-explorer.ts"),
    join(bundle, "app", "packages", "automation", "src", "navigation-policy.ts"),
    join(bundle, "app", "packages", "automation", "src", "dom-mapping.ts"),
    join(bundle, "app", "packages", "automation", "src", "page-runtime.ts"),
    join(bundle, "README.txt"),
    join(bundle, "SHA256SUMS.txt"),
  ]) {
    await access(path);
  }

  const topLevelEntries = await readdir(bundle);
  for (const entry of topLevelEntries) {
    if (!expectedTopLevelEntries.has(entry)) {
      throw new Error(`Unexpected top-level portable bundle entry: ${entry}`);
    }
  }

  if (!runnerSource.includes('PORTABLE_BOOKMAKER = "sisal"')) {
    throw new Error("Portable runner is not locked to SISAL.");
  }
  if (!runnerSource.includes('PORTABLE_APPROVED_ORIGIN = "https://www.sisal.it"')) {
    throw new Error("Portable runner does not contain the exact approved SISAL origin.");
  }
  if (/https:\/\/www\.(?:admiralbet|bet365)\.it/i.test(runnerSource)) {
    throw new Error("Portable runner unexpectedly contains another bookmaker origin.");
  }
  if (!runnerSource.includes("assertPortableNonCiEnvironment")) {
    throw new Error("Portable runner does not retain its CI live-execution guard.");
  }
  if (!runnerSource.includes("authorizesProductionMapping")) {
    throw new Error("Portable runner does not validate non-authorizing evidence.");
  }

  if (/https?:\/\//i.test(launcher) || /\b(?:admiralbet|bet365)\b/i.test(launcher)) {
    throw new Error("Windows launcher must not expose alternate origins or bookmakers.");
  }
  if (!launcher.includes("app\\portable-live-explorer.mjs")) {
    throw new Error("Windows launcher does not invoke the reviewed portable runner.");
  }

  const sensitivePattern = /(?:^|\/)(?:\.env(?:\.|$)|cookies?|login data|local state|user[ -]?data|profiles?|screenshots?|traces?|videos?|[^/]*\.har|runtime-logs?)(?:\/|$)/i;
  const inspectTree = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const rel = relative(bundle, path).replaceAll("\\", "/");
      if (!rel.startsWith("node_modules/") && !rel.startsWith("browsers/") && sensitivePattern.test(rel)) {
        throw new Error(`Sensitive/runtime artifact class is forbidden in portable bundle: ${rel}`);
      }
      if (entry.isDirectory()) await inspectTree(path);
    }
  };
  await inspectTree(bundle);

  await verifyChecksums(bundle);
  return { bundle, manifest };
}

async function main() {
  const { bundle } = await verifyPortableValidationBundle();
  process.stdout.write(`Verified portable validation bundle: ${bundle}\n`);
}

const invokedAsScript =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown portable bundle verification failure.";
    process.stderr.write(`Portable validation bundle verification failed: ${message}\n`);
    process.exitCode = 1;
  });
}
