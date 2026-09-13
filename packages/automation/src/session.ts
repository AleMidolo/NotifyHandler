import { chromium } from "playwright-core";
import type {
  BookmakerPagePort,
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
  let detachAbort: (() => void) | undefined;

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    detachAbort?.();
    detachAbort = undefined;
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
      runtime.beginAttempt();
      if (signal !== undefined) {
        const onAbort = (): void => runtime.cancelInFlight();
        if (signal.aborted) onAbort();
        else {
          signal.addEventListener("abort", onAbort, { once: true });
          detachAbort = () => signal.removeEventListener("abort", onAbort);
        }
      }

      return {
        browser: runtime.port,
        selectionGate: createSelectionGate(runtime, options.bookmaker, evidenceEpoch),
      };
    },
    async cancel(): Promise<void> {
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
