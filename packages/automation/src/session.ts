import { chromium } from "playwright-core";
import type {
  BookmakerPagePort,
  SafeLocation,
  SelectionActivationGate,
} from "../../bookmakers/src/contracts.ts";
import { domMappingFor, type WorkerBookmaker } from "./dom-mapping.ts";
import { NavigationPolicy } from "./navigation-policy.ts";
import { createWorkerPageRuntime, type FixtureDocuments } from "./page-runtime.ts";
import { createSelectionGate } from "./selection-gate.ts";

const ORIGINS: Readonly<Record<WorkerBookmaker, readonly string[]>> = Object.freeze({
  sisal: Object.freeze(["https://www.sisal.it"]),
  bet365: Object.freeze(["https://www.bet365.it"]),
});

const REVOKED_LOCATION: SafeLocation = Object.freeze({
  href: "about:blank",
  origin: "notifyhandler://revoked-attempt",
});

let nextSessionId = 0;

export interface AttemptCapabilities {
  readonly browser: BookmakerPagePort;
  readonly selectionGate: SelectionActivationGate;
}

export interface BookmakerLegSession {
  readonly bookmaker: WorkerBookmaker;
  readonly sessionId: string;
  createAttemptCapabilities(evidenceEpoch: number, signal?: AbortSignal): AttemptCapabilities;
  cancel(): Promise<void>;
  close(): Promise<void>;
}

export interface LaunchBookmakerLegSessionOptions {
  readonly bookmaker: WorkerBookmaker;
  readonly headless?: boolean;
  readonly navigationTimeoutMs?: number;
}

interface InternalLaunchOptions extends LaunchBookmakerLegSessionOptions {
  readonly fixtureDocuments?: FixtureDocuments;
}

function createAttemptBrowser(
  browser: BookmakerPagePort,
  isCurrentAttempt: () => boolean,
): BookmakerPagePort {
  return {
    async openAllowed(url) {
      if (!isCurrentAttempt()) return { ok: false };
      const result = await browser.openAllowed(url);
      return isCurrentAttempt() ? result : { ok: false };
    },
    async currentLocation() {
      if (!isCurrentAttempt()) return REVOKED_LOCATION;
      const location = await browser.currentLocation();
      return isCurrentAttempt() ? location : REVOKED_LOCATION;
    },
    async waitForPageReady(options) {
      if (!isCurrentAttempt()) return { ready: false };
      const result = await browser.waitForPageReady(options);
      return isCurrentAttempt() ? result : { ready: false };
    },
    async query(query) {
      if (!isCurrentAttempt()) return [];
      const result = await browser.query(query);
      return isCurrentAttempt() ? result : [];
    },
    async readText(ref) {
      if (!isCurrentAttempt()) return "";
      const result = await browser.readText(ref);
      return isCurrentAttempt() ? result : "";
    },
    async readAttribute(ref, name) {
      if (!isCurrentAttempt()) return null;
      const result = await browser.readAttribute(ref, name);
      return isCurrentAttempt() ? result : null;
    },
    async isVisible(ref) {
      if (!isCurrentAttempt()) return false;
      const result = await browser.isVisible(ref);
      return isCurrentAttempt() ? result : false;
    },
    async activateNavigationControl(action) {
      if (!isCurrentAttempt()) return { ok: false };
      const result = await browser.activateNavigationControl(action);
      return isCurrentAttempt() ? result : { ok: false };
    },
  };
}

export async function launchSession(options: InternalLaunchOptions): Promise<BookmakerLegSession> {
  const origins = ORIGINS[options.bookmaker];
  const policy = new NavigationPolicy(origins);

  if (options.fixtureDocuments !== undefined) {
    for (const url of Object.keys(options.fixtureDocuments)) {
      if (!policy.isAllowed(url)) throw new Error(`Fixture URL must be an approved bookmaker HTTPS URL: ${url}`);
    }
  }

  const browser = await chromium.launch({ headless: options.headless ?? false });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const runtime = await createWorkerPageRuntime({
    page,
    policy,
    mapping: domMappingFor(options.bookmaker),
    ...(options.fixtureDocuments === undefined ? {} : { fixtureDocuments: options.fixtureDocuments }),
    ...(options.navigationTimeoutMs === undefined ? {} : { navigationTimeoutMs: options.navigationTimeoutMs }),
  });

  const sessionId = `browser-session-${++nextSessionId}`;
  let closed = false;
  let attemptGeneration = 0;
  let activeAttemptGeneration = 0;
  let detachAbort: (() => void) | undefined;

  const revokeCurrentAttempt = (): void => {
    activeAttemptGeneration = ++attemptGeneration;
    detachAbort?.();
    detachAbort = undefined;
  };

  const close = async (): Promise<void> => {
    if (closed) return;
    revokeCurrentAttempt();
    closed = true;
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  };

  return {
    bookmaker: options.bookmaker,
    sessionId,
    createAttemptCapabilities(evidenceEpoch: number, signal?: AbortSignal): AttemptCapabilities {
      if (closed) throw new Error("Browser leg session is closed.");
      if (!Number.isSafeInteger(evidenceEpoch) || evidenceEpoch < 0) throw new Error("Evidence epoch must be a non-negative safe integer.");

      detachAbort?.();
      detachAbort = undefined;
      const generation = ++attemptGeneration;
      activeAttemptGeneration = generation;
      runtime.beginAttempt();

      const isCurrentAttempt = (): boolean =>
        !closed && activeAttemptGeneration === generation && !(signal?.aborted ?? false);

      if (signal !== undefined) {
        const onAbort = (): void => {
          if (activeAttemptGeneration === generation) runtime.cancelInFlight();
        };
        if (signal.aborted) onAbort();
        else {
          signal.addEventListener("abort", onAbort, { once: true });
          detachAbort = () => signal.removeEventListener("abort", onAbort);
        }
      }

      const attemptBrowser = createAttemptBrowser(runtime.port, isCurrentAttempt);
      return {
        browser: attemptBrowser,
        selectionGate: createSelectionGate(runtime, options.bookmaker, evidenceEpoch, isCurrentAttempt),
      };
    },
    async cancel(): Promise<void> {
      revokeCurrentAttempt();
      runtime.cancelInFlight();
      await close();
    },
    close,
  };
}

export async function launchBookmakerLegSession(
  options: LaunchBookmakerLegSessionOptions,
): Promise<BookmakerLegSession> {
  return launchSession(options);
}
