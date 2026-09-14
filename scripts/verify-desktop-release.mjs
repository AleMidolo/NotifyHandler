import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(root, "dist", "release");

async function directories(path) {
  return (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => join(path, entry.name));
}

let bundleDir = process.env.NOTIFYHANDLER_BUNDLE_DIR;
if (!bundleDir) {
  const candidates = (await directories(releaseRoot)).filter((path) => basename(path).startsWith("notifyhandler-v"));
  if (candidates.length !== 1) throw new Error(`Expected exactly one NotifyHandler release bundle, found ${candidates.length}.`);
  [bundleDir] = candidates;
}
bundleDir = resolve(bundleDir);

const required = [
  "NotifyHandler.exe",
  "RELEASE-METADATA.json",
  "PREVIEW-README.txt",
  "resources/app/package.json",
  "resources/app/src/bootstrap.mjs",
  "resources/app/src/electron-main.mjs",
  "resources/app/src/preload.cjs",
  "resources/app/renderer/index.html",
  "resources/app/node_modules/playwright-core/package.json",
  "resources/playwright-browsers",
];
for (const item of required) {
  const value = await stat(join(bundleDir, item)).catch(() => null);
  if (!value) throw new Error(`Packaged release is missing required path: ${item}`);
}

const packagedApp = JSON.parse(await readFile(join(bundleDir, "resources", "app", "package.json"), "utf8"));
if (packagedApp.main !== "src/bootstrap.mjs") throw new Error("Packaged Electron main entry is not the hardened bootstrap.");
if (packagedApp.dependencies?.["playwright-core"] !== "1.63.0") throw new Error("Packaged Playwright runtime is not pinned to 1.63.0.");
const metadata = JSON.parse(await readFile(join(bundleDir, "RELEASE-METADATA.json"), "utf8"));
if (metadata.signing !== "unsigned-preview" || metadata.productionRelease !== false) {
  throw new Error("Preview bundle must remain explicitly unsigned and non-production.");
}

const bootstrap = await readFile(join(bundleDir, "resources", "app", "src", "bootstrap.mjs"), "utf8");
if (!bootstrap.includes("process.resourcesPath") || !bootstrap.includes("PLAYWRIGHT_BROWSERS_PATH")) {
  throw new Error("Packaged bootstrap does not bind Playwright to the bundled browser runtime.");
}
const preload = await readFile(join(bundleDir, "resources", "app", "src", "preload.cjs"), "utf8");
if (/playwright|chromium|electron\.ipcRenderer\.send\s*\(/i.test(preload)) {
  throw new Error("Preload bridge contains a forbidden browser-automation or generic-send capability.");
}

const forbiddenBasenames = new Set(["Cookies", "Login Data", "Local State", "trace.zip"]);
const forbiddenPatterns = [/(^|\/)\.env($|\.)/i, /(^|\/)playwright-report(\/|$)/i, /(^|\/)test-results(\/|$)/i, /\.har$/i, /\.log$/i];
const filePaths = [];

async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const absolute = join(path, entry.name);
    const rel = relative(bundleDir, absolute).split(sep).join("/");
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    if (forbiddenBasenames.has(entry.name) || forbiddenPatterns.some((pattern) => pattern.test(rel))) {
      throw new Error(`Sensitive or temporary file must not be packaged: ${rel}`);
    }
    if (rel !== "SHA256SUMS.txt") filePaths.push({ absolute, rel });
  }
}
await walk(bundleDir);
filePaths.sort((a, b) => a.rel.localeCompare(b.rel));

const hashes = [];
for (const file of filePaths) {
  const digest = createHash("sha256").update(await readFile(file.absolute)).digest("hex");
  hashes.push(`${digest}  ${file.rel}`);
}
await writeFile(join(bundleDir, "SHA256SUMS.txt"), `${hashes.join("\n")}\n`, "utf8");
console.log(`Verified ${filePaths.length} packaged files in ${bundleDir}`);
