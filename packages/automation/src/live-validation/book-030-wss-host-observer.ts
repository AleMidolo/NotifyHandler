import { isIP } from "node:net";

import {
  chromium,
  type BrowserContext,
  type Page,
  type WebSocketRoute,
} from "playwright-core";

import {
  isInternalHostname,
  NavigationPolicy,
  resolveHostAddresses,
  type HostResolver,
} from "../navigation-policy.ts";
import {
  BOOK_024_TARGETS,
  parseApprovedPassiveTarget,
  waitForPassiveReadiness,
} from "./target-aware-passive-probe.ts";

export const BOOK_030_WSS_HOST_OBSERVATION_SCHEMA =
  "notifyhandler.book030-wss-host-observation.v1" as const;
export const BOOK_030_SOURCE_TARGET = "BOOK_024_BET365_LOCKED_DIRECT" as const;

const BET365_ORIGIN = "https://www.bet365.it";
const NAVIGATION_TIMEOUT_MS = 20_000;
const SOCKET_CLOSE = Object.freeze({
  code: 1008,
  reason: "Diagnostic WebSocket observation complete",
});

const CI_KEYS = Object.freeze([
  "CI",
  "GITHUB_ACTIONS",
  "TF_BUILD",
  "BUILD_BUILDID",
  "JENKINS_URL",
  "BUILDKITE",
  "CIRCLECI",
] as const);

const ALLOWED_ARTIFACT_KEYS = Object.freeze([
  "schemaVersion",
  "bookmaker",
  "sourceTarget",
  "candidateHostname",
  "publicDnsValidated",
  "socketConnected",
  "authorizesPolicy",
] as const);

export interface Book030WssHostObservationV1 {
  readonly schemaVersion: typeof BOOK_030_WSS_HOST_OBSERVATION_SCHEMA;
  readonly bookmaker: "bet365";
  readonly sourceTarget: typeof BOOK_030_SOURCE_TARGET;
  readonly candidateHostname: string;
  readonly publicDnsValidated: true;
  readonly socketConnected: false;
  readonly authorizesPolicy: false;
}

type ObservationSocket = Pick<WebSocketRoute, "url" | "close">;

function canonicalPublicDnsHostname(raw: string): string | undefined {
  const value = raw.trim().toLowerCase();
  if (
    value === ""
    || value.endsWith(".")
    || value.length > 253
    || isIP(value.replace(/^\[|\]$/gu, "")) !== 0
    || isInternalHostname(value)
  ) {
    return undefined;
  }

  const labels = value.split(".");
  if (
    labels.length < 2
    || labels.some(
      (label) =>
        label.length === 0
        || label.length > 63
        || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
    )
  ) {
    return undefined;
  }
  return value;
}

export function validateBook030WssHostObservation(
  value: unknown,
): Book030WssHostObservationV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BOOK-030 observation artifact must be an object.");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = [...ALLOWED_ARTIFACT_KEYS].sort();
  if (
    keys.length !== expectedKeys.length
    || keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("BOOK-030 observation artifact contains an unknown or missing field.");
  }

  if (
    record.schemaVersion !== BOOK_030_WSS_HOST_OBSERVATION_SCHEMA
    || record.bookmaker !== "bet365"
    || record.sourceTarget !== BOOK_030_SOURCE_TARGET
    || record.publicDnsValidated !== true
    || record.socketConnected !== false
    || record.authorizesPolicy !== false
  ) {
    throw new Error("BOOK-030 observation artifact contains an invalid fixed value.");
  }

  if (
    typeof record.candidateHostname !== "string"
    || canonicalPublicDnsHostname(record.candidateHostname) !== record.candidateHostname
  ) {
    throw new Error("BOOK-030 observation artifact contains an invalid hostname.");
  }

  return record as unknown as Book030WssHostObservationV1;
}

async function artifactFromFirstSocketUrl(
  rawUrl: string,
  resolveHostname: HostResolver,
): Promise<Book030WssHostObservationV1 | undefined> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return undefined;
  }

  if (
    parsed.protocol !== "wss:"
    || parsed.username !== ""
    || parsed.password !== ""
    || (parsed.port !== "" && parsed.port !== "443")
  ) {
    return undefined;
  }

  const candidateHostname = canonicalPublicDnsHostname(parsed.hostname);
  if (candidateHostname === undefined) return undefined;

  try {
    const addresses = await resolveHostname(candidateHostname);
    if (
      addresses.length === 0
      || addresses.some(
        (address) =>
          isIP(address.replace(/^\[|\]$/gu, "")) === 0
          || isInternalHostname(address),
      )
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return validateBook030WssHostObservation({
    schemaVersion: BOOK_030_WSS_HOST_OBSERVATION_SCHEMA,
    bookmaker: "bet365",
    sourceTarget: BOOK_030_SOURCE_TARGET,
    candidateHostname,
    publicDnsValidated: true,
    socketConnected: false,
    authorizesPolicy: false,
  });
}

export interface Book030FirstSocketObserver {
  handle(socket: ObservationSocket): Promise<void>;
  firstAttemptObserved(): boolean;
  failedClosed(): boolean;
  observation(): Book030WssHostObservationV1 | undefined;
}

export function createBook030FirstSocketObserver(
  resolveHostname: HostResolver = resolveHostAddresses,
): Book030FirstSocketObserver {
  let firstSeen = false;
  let failed = false;
  let retained: Book030WssHostObservationV1 | undefined;

  return {
    async handle(socket): Promise<void> {
      if (firstSeen) {
        await socket.close(SOCKET_CLOSE).catch(() => undefined);
        return;
      }
      firstSeen = true;

      try {
        retained = await artifactFromFirstSocketUrl(socket.url(), resolveHostname);
        if (retained === undefined) failed = true;
      } catch {
        failed = true;
        retained = undefined;
      } finally {
        await socket.close(SOCKET_CLOSE).catch(() => undefined);
      }
    },
    firstAttemptObserved: () => firstSeen,
    failedClosed: () => failed,
    observation: () => retained,
  };
}

export function assertBook030NonCiEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  for (const key of CI_KEYS) {
    const value = environment[key];
    if (
      value !== undefined
      && !["", "0", "false", "no"].includes(value.trim().toLowerCase())
    ) {
      throw new Error("BOOK-030 hostname observation is intentionally disabled in CI.");
    }
  }
}

export function assertBook030NoRuntimeTargetOverride(args: readonly string[]): void {
  if (args.length !== 0) {
    throw new Error("BOOK-030 hostname observation accepts no runtime target override.");
  }
}

async function installOrdinaryPublicNetworkBoundary(
  context: BrowserContext,
  page: Page,
  navigationPolicy: NavigationPolicy,
  markUnsafe: () => void,
): Promise<void> {
  await context.route("**/*", async (route) => {
    const request = route.request();
    let parsed: URL;
    try {
      parsed = new URL(request.url());
    } catch {
      markUnsafe();
      await route.abort("blockedbyclient");
      return;
    }

    if (["data:", "blob:", "about:"].includes(parsed.protocol)) {
      await route.continue();
      return;
    }

    const topLevel =
      request.isNavigationRequest() && request.frame().parentFrame() === null;
    if (parsed.protocol !== "https:") {
      markUnsafe();
      await route.abort("blockedbyclient");
      return;
    }

    const publicTarget = await navigationPolicy.isResolvedPublicHttpsTarget(parsed.href);
    if (!publicTarget || (topLevel && !navigationPolicy.isAllowed(parsed.href))) {
      markUnsafe();
      await route.abort("blockedbyclient");
      return;
    }

    await route.continue();
  });

  context.on("page", (openedPage) => {
    if (openedPage !== page) void openedPage.close().catch(() => undefined);
  });
}

export async function runBook030WssHostObserver(): Promise<Book030WssHostObservationV1> {
  assertBook030NonCiEnvironment();

  const lockedTarget = parseApprovedPassiveTarget(
    "bet365",
    BOOK_024_TARGETS.bet365.url,
  );
  const navigationPolicy = new NavigationPolicy([BET365_ORIGIN]);
  const socketObserver = createBook030FirstSocketObserver();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  let unsafeOrdinaryNetworkObserved = false;

  await context.routeWebSocket("**/*", async (socket) => {
    await socketObserver.handle(socket);
  });
  await installOrdinaryPublicNetworkBoundary(
    context,
    page,
    navigationPolicy,
    () => {
      unsafeOrdinaryNetworkObserved = true;
    },
  );

  try {
    await page.goto(lockedTarget.href, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await waitForPassiveReadiness(page);

    if (
      unsafeOrdinaryNetworkObserved
      || page.url() !== lockedTarget.href
      || !navigationPolicy.isAllowed(page.url())
      || !socketObserver.firstAttemptObserved()
      || socketObserver.failedClosed()
    ) {
      throw new Error("BOOK-030 hostname observation did not produce an approved artifact.");
    }

    const observation = socketObserver.observation();
    if (observation === undefined) {
      throw new Error("BOOK-030 hostname observation did not produce an approved artifact.");
    }
    return validateBook030WssHostObservation(observation);
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  assertBook030NoRuntimeTargetOverride(process.argv.slice(2));
  const observation = await runBook030WssHostObserver();
  process.stdout.write(JSON.stringify(observation, null, 2) + "\n");
}

const invokedAsScript =
  process.argv[1]?.endsWith("book-030-wss-host-observer.ts") ?? false;
if (invokedAsScript) {
  void main().catch(() => {
    process.stderr.write(
      "BOOK-030 hostname observation failed safely; no hostname artifact was retained.\n",
    );
    process.exitCode = 1;
  });
}
