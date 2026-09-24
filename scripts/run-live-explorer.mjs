import { spawn, spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supportedBookmakers = Object.freeze({
  admiralbet: "https://www.admiralbet.it",
  sisal: "https://www.sisal.it",
  bet365: "https://www.bet365.it",
});

const ciSignals = Object.freeze([
  "CI",
  "GITHUB_ACTIONS",
  "TF_BUILD",
  "BUILD_BUILDID",
  "JENKINS_URL",
  "BUILDKITE",
  "CIRCLECI",
]);

function isTruthyEnvironmentValue(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "0" && normalized !== "false" && normalized !== "no";
}

export function assertNonCiEnvironment(environment = process.env) {
  const activeSignal = ciSignals.find((name) => isTruthyEnvironmentValue(environment[name]));
  if (activeSignal !== undefined) {
    throw new Error(
      `Live bookmaker exploration is intentionally disabled in CI (${activeSignal} is set). Run it from a normal local/development environment.`,
    );
  }
}

export function parseRunnerBookmaker(args) {
  if (args.length !== 1 || !(args[0] in supportedBookmakers)) {
    throw new Error("Usage: npm run live:explore:local -- admiralbet|sisal|bet365");
  }
  return args[0];
}

export function assertExactVersion(name, actual, expected) {
  const normalizedActual = String(actual).trim().replace(/^v/, "");
  const normalizedExpected = String(expected).trim().replace(/^v/, "");
  if (normalizedActual !== normalizedExpected) {
    throw new Error(`${name} ${normalizedExpected} is required; found ${normalizedActual || "unknown"}.`);
  }
}

export function originForBookmaker(bookmaker) {
  const origin = supportedBookmakers[bookmaker];
  if (origin === undefined) throw new Error(`Unsupported bookmaker: ${bookmaker}`);
  return origin;
}

const relayUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function assertRelayDiagnosticRunnerPreflight(bookmaker, environment = process.env) {
  const requireRelay = environment.NH_LIVE_EXPLORER_REQUIRE_RELAY;
  if (requireRelay === undefined) return;
  if (requireRelay !== "1") {
    throw new Error("NH_LIVE_EXPLORER_REQUIRE_RELAY must be exactly 1 when set.");
  }
  if (environment.NH_LIVE_EXPLORER_REQUIRE_DIRECT !== undefined) {
    throw new Error("Relay diagnostic preflight cannot be combined with direct-required mode.");
  }
  if (environment.NH_LIVE_EXPLORER_URL !== undefined) {
    throw new Error("Relay diagnostic preflight forbids NH_LIVE_EXPLORER_URL direct-bookmaker navigation.");
  }
  const rawRelay = environment.NH_LIVE_EXPLORER_RELAY_URL;
  if (typeof rawRelay !== "string" || rawRelay.length === 0) {
    throw new Error("Relay diagnostic preflight requires NH_LIVE_EXPLORER_RELAY_URL before any browser/network activity.");
  }

  let relay;
  try {
    relay = new URL(rawRelay);
  } catch {
    throw new Error("Relay diagnostic preflight received a malformed relay URL.");
  }
  const match = /^\/lnk\/([0-9a-fA-F-]+)\/([a-z0-9]+)$/u.exec(relay.pathname);
  const signalId = (match?.[1] ?? "").toLowerCase();
  const observedSuffix = match?.[2] ?? "";
  if (
    (bookmaker !== "sisal" && bookmaker !== "bet365") ||
    relay.protocol !== "https:" ||
    relay.origin !== "https://www.bet-up.it" ||
    relay.username !== "" ||
    relay.password !== "" ||
    relay.search !== "" ||
    relay.hash !== "" ||
    match === null ||
    !relayUuid.test(signalId) ||
    observedSuffix !== bookmaker
  ) {
    throw new Error(`Relay diagnostic preflight requires canonical BETUP_RELAY input for ${bookmaker}.`);
  }
}

export function assertDirectDiagnosticRunnerPreflight(bookmaker, environment = process.env) {
  const requireDirect = environment.NH_LIVE_EXPLORER_REQUIRE_DIRECT;
  if (requireDirect === undefined) return;
  if (requireDirect !== "1") {
    throw new Error("NH_LIVE_EXPLORER_REQUIRE_DIRECT must be exactly 1 when set.");
  }
  if (environment.NH_LIVE_EXPLORER_REQUIRE_RELAY !== undefined) {
    throw new Error("Direct diagnostic preflight cannot be combined with relay-required mode.");
  }
  if (environment.NH_LIVE_EXPLORER_RELAY_URL !== undefined) {
    throw new Error("Direct diagnostic preflight forbids NH_LIVE_EXPLORER_RELAY_URL.");
  }

  const rawTarget = environment.NH_LIVE_EXPLORER_URL;
  if (typeof rawTarget !== "string" || rawTarget.length === 0) {
    throw new Error(
      "Direct diagnostic preflight requires NH_LIVE_EXPLORER_URL before any browser/network activity; generic homepage fallback is forbidden.",
    );
  }

  let target;
  try {
    target = new URL(rawTarget);
  } catch {
    throw new Error("Direct diagnostic preflight received a malformed bookmaker URL.");
  }

  const expectedOrigin = originForBookmaker(bookmaker);
  if (
    target.protocol !== "https:" ||
    target.origin !== expectedOrigin ||
    target.username !== "" ||
    target.password !== ""
  ) {
    throw new Error(
      `Direct diagnostic preflight requires credential-free HTTPS navigation on ${expectedOrigin}.`,
    );
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadPinnedVersions() {
  const [nodeVersion, rootPackage, automationPackage] = await Promise.all([
    readFile(join(root, ".nvmrc"), "utf8"),
    readJson(join(root, "package.json")),
    readJson(join(root, "packages", "automation", "package.json")),
  ]);
  const npmVersion = String(rootPackage.packageManager ?? "").replace(/^npm@/, "");
  const playwrightVersion = automationPackage.dependencies?.["playwright-core"];
  if (!npmVersion || typeof playwrightVersion !== "string") {
    throw new Error("Repository toolchain pins are incomplete.");
  }
  return {
    node: nodeVersion.trim(),
    npm: npmVersion,
    playwright: playwrightVersion,
  };
}

export function npmVersionInvocation(platform = process.platform, environment = process.env) {
  if (platform === "win32") {
    return {
      command: environment.ComSpec || environment.COMSPEC || "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd --version"],
    };
  }
  return { command: "npm", args: ["--version"] };
}

function installedNpmVersion() {
  const invocation = npmVersionInvocation();
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw new Error(`Unable to execute npm: ${result.error.message}`);
  if (result.status !== 0) throw new Error("Unable to determine the installed npm version.");
  return result.stdout.trim();
}

async function assertLockedPlaywrightInstalled(expectedVersion) {
  const packagePath = join(root, "node_modules", "playwright-core", "package.json");
  let installed;
  try {
    installed = await readJson(packagePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("Locked dependencies are not installed. Run `npm ci --ignore-scripts` first.");
    }
    throw error;
  }
  assertExactVersion("playwright-core", installed.version, expectedVersion);
}

function runPrerequisiteCommand(command, args) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("error", rejectCommand);
    child.once("close", (code) => {
      if (code === 0) resolveCommand();
      else rejectCommand(new Error(`Prerequisite command exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function ensurePinnedChromiumInstalled() {
  const playwrightModule = await import("playwright-core");
  const executable = playwrightModule.chromium.executablePath();
  try {
    await access(executable);
    return;
  } catch {
    process.stderr.write("Pinned Playwright Chromium is missing; installing the lockfile-selected browser revision.\n");
  }

  await runPrerequisiteCommand(process.execPath, [
    join(root, "node_modules", "playwright-core", "cli.js"),
    "install",
    "chromium",
  ]);

  try {
    await access(playwrightModule.chromium.executablePath());
  } catch {
    throw new Error("Pinned Chromium installation completed without producing the expected executable.");
  }
}

async function assertNetworkPrerequisite(bookmaker) {
  const hostname = new URL(originForBookmaker(bookmaker)).hostname;
  try {
    await lookup(hostname);
  } catch {
    throw new Error(
      `Network prerequisite failed: DNS could not resolve ${hostname}. Run from a local/development environment with outbound DNS and HTTPS access.`,
    );
  }
}

async function runExplorer(bookmaker, environment = process.env) {
  const explorerPath = join(
    root,
    "packages",
    "automation",
    "src",
    "live-validation",
    "interactive-explorer.ts",
  );
  return new Promise((resolveExplorer, rejectExplorer) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", explorerPath], {
      cwd: root,
      env: {
        ...environment,
        NH_LIVE_EXPLORER_BOOKMAKER: bookmaker,
      },
      stdio: ["inherit", "inherit", "inherit"],
      windowsHide: true,
    });
    child.once("error", rejectExplorer);
    child.once("close", (code, signal) => {
      if (signal !== null) {
        rejectExplorer(new Error(`Interactive explorer terminated by signal ${signal}.`));
        return;
      }
      resolveExplorer(code ?? 1);
    });
  });
}

export async function runLocalLiveExplorer(bookmaker, options = {}) {
  const environment = options.environment ?? process.env;
  assertNonCiEnvironment(environment);
  assertRelayDiagnosticRunnerPreflight(bookmaker, environment);
  assertDirectDiagnosticRunnerPreflight(bookmaker, environment);

  const pinned = await loadPinnedVersions();
  assertExactVersion("Node.js", process.version, pinned.node);
  assertExactVersion("npm", installedNpmVersion(), pinned.npm);
  await assertLockedPlaywrightInstalled(pinned.playwright);
  await ensurePinnedChromiumInstalled();
  await assertNetworkPrerequisite(bookmaker);

  return runExplorer(bookmaker, environment);
}

async function main() {
  const bookmaker = parseRunnerBookmaker(process.argv.slice(2));
  const exitCode = await runLocalLiveExplorer(bookmaker);
  process.exitCode = exitCode;
}

const invokedAsScript =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown local live-explorer runner failure.";
    process.stderr.write(`NotifyHandler live explorer runner failed safely: ${message}\n`);
    process.exitCode = 1;
  });
}
