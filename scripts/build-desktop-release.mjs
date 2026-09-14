import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const platform = process.platform;
const arch = process.arch;

if (platform !== "win32" || arch !== "x64") {
  throw new Error(`DEVOPS-002 preview packaging currently supports win32-x64 only; got ${platform}-${arch}.`);
}

function cleanBuildId(value) {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]/g, "-");
  if (normalized.length === 0) throw new Error("Release build id must not be empty.");
  return normalized.slice(0, 64);
}

const buildId = cleanBuildId(
  process.env.NOTIFYHANDLER_BUILD_ID
    ?? execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root, encoding: "utf8" }),
);
const bundleName = `notifyhandler-v${rootPackage.version}-${buildId}-${platform}-${arch}`;
const releaseRoot = join(root, "dist", "release");
const bundleDir = join(releaseRoot, bundleName);
const electronDist = join(root, "node_modules", "electron", "dist");
const playwrightCore = join(root, "node_modules", "playwright-core");
const browserSource = process.env.PLAYWRIGHT_BROWSERS_PATH;

if (!browserSource) {
  throw new Error("PLAYWRIGHT_BROWSERS_PATH must point at the pinned Chromium installation before packaging.");
}
for (const requiredPath of [electronDist, playwrightCore, browserSource]) {
  const value = await stat(requiredPath).catch(() => null);
  if (!value?.isDirectory()) throw new Error(`Required release input is missing: ${requiredPath}`);
}

await mkdir(releaseRoot, { recursive: true });
await rm(bundleDir, { recursive: true, force: true });
await cp(electronDist, bundleDir, { recursive: true });

const resourcesDir = join(bundleDir, "resources");
const appDir = join(resourcesDir, "app");
const appSrcDir = join(appDir, "src");
await rm(join(resourcesDir, "default_app.asar"), { force: true });
await mkdir(appSrcDir, { recursive: true });

await build({
  entryPoints: [join(root, "packages", "desktop", "src", "electron-main.mjs")],
  outfile: join(appSrcDir, "electron-main.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  minify: false,
  legalComments: "none",
  external: ["electron", "playwright-core"],
  logLevel: "info",
});

await cp(join(root, "packages", "desktop", "src", "preload.cjs"), join(appSrcDir, "preload.cjs"));
await cp(join(root, "packages", "desktop", "renderer"), join(appDir, "renderer"), { recursive: true });
await mkdir(join(appDir, "node_modules"), { recursive: true });
await cp(playwrightCore, join(appDir, "node_modules", "playwright-core"), { recursive: true });
await cp(browserSource, join(resourcesDir, "playwright-browsers"), { recursive: true });

const bootstrap = `import { join } from "node:path";\nprocess.env.PLAYWRIGHT_BROWSERS_PATH = join(process.resourcesPath, "playwright-browsers");\nawait import("./electron-main.mjs");\n`;
await writeFile(join(appSrcDir, "bootstrap.mjs"), bootstrap, "utf8");

const packagedApp = {
  name: "notifyhandler-desktop",
  productName: "NotifyHandler",
  version: rootPackage.version,
  private: true,
  type: "module",
  main: "src/bootstrap.mjs",
  dependencies: { "playwright-core": "1.63.0" },
};
await writeFile(join(appDir, "package.json"), `${JSON.stringify(packagedApp, null, 2)}\n`, "utf8");

const electronExe = join(bundleDir, "electron.exe");
const notifyHandlerExe = join(bundleDir, "NotifyHandler.exe");
await rename(electronExe, notifyHandlerExe);

const metadata = {
  schemaVersion: 1,
  product: "NotifyHandler",
  version: rootPackage.version,
  buildId,
  platform,
  arch,
  electron: "44.3.0",
  playwrightCore: "1.63.0",
  chromiumProvisioning: "bundled worker-owned Playwright Chromium",
  signing: "unsigned-preview",
  productionRelease: false,
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
};
await writeFile(join(bundleDir, "RELEASE-METADATA.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
await writeFile(
  join(bundleDir, "PREVIEW-README.txt"),
  [
    "NotifyHandler unsigned preview bundle",
    "",
    "This artifact is for release-readiness testing only and is not a production release.",
    "Extract the bundle and run NotifyHandler.exe. Windows may warn because the preview is unsigned.",
    "Bookmaker authentication, stake entry, review, and final submission remain manual user actions.",
    "The bundled Playwright Chromium is intentionally separate from Electron's renderer Chromium.",
    "Do not redistribute browser profiles, cookies, session data, traces, screenshots, or logs.",
    "",
  ].join("\r\n"),
  "utf8",
);

console.log(bundleDir);
