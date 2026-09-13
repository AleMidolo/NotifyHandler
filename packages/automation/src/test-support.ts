import type { BookmakerLegSession } from "./session.ts";
import { launchSession } from "./session.ts";
import type { WorkerBookmaker } from "./dom-mapping.ts";
import type { FixtureDocuments } from "./page-runtime.ts";
import {
  createBookmakerAutomationWorker,
  type PlaywrightBookmakerAutomationWorker,
} from "./worker-port.ts";

export type { FixtureDocument, FixtureDocuments, FixtureResponse } from "./page-runtime.ts";

export interface LaunchFixtureLegSessionOptions { readonly bookmaker: WorkerBookmaker; readonly fixtures: FixtureDocuments; readonly headless?: boolean; readonly navigationTimeoutMs?: number; }
export async function launchFixtureLegSession(options: LaunchFixtureLegSessionOptions): Promise<BookmakerLegSession> {
  return launchSession({ bookmaker: options.bookmaker, headless: options.headless ?? true, fixtureDocuments: options.fixtures, ...(options.navigationTimeoutMs === undefined ? {} : { navigationTimeoutMs: options.navigationTimeoutMs }) });
}

export interface FixtureAutomationWorkerOptions {
  readonly fixtures: Partial<Record<WorkerBookmaker, FixtureDocuments | readonly FixtureDocuments[]>>;
  readonly navigationTimeoutMs?: number;
  readonly onLaunch?: (bookmaker: WorkerBookmaker, launchNumber: number) => void;
}

export function createFixtureAutomationWorker(options: FixtureAutomationWorkerOptions): PlaywrightBookmakerAutomationWorker {
  const launchCounts: Record<WorkerBookmaker, number> = { sisal: 0, bet365: 0 };
  return createBookmakerAutomationWorker({
    headless: true,
    ...(options.navigationTimeoutMs === undefined ? {} : { navigationTimeoutMs: options.navigationTimeoutMs }),
    sessionLauncher: async (launchOptions) => {
      const launchNumber = launchCounts[launchOptions.bookmaker]++;
      options.onLaunch?.(launchOptions.bookmaker, launchNumber + 1);
      const configured = options.fixtures[launchOptions.bookmaker];
      if (configured === undefined) throw new Error(`No fixtures configured for ${launchOptions.bookmaker}.`);
      const fixtures = Array.isArray(configured) ? configured[Math.min(launchNumber, configured.length - 1)] : configured;
      if (fixtures === undefined) throw new Error(`No fixture session ${launchNumber + 1} configured for ${launchOptions.bookmaker}.`);
      return launchFixtureLegSession({ bookmaker: launchOptions.bookmaker, fixtures, headless: true, ...(launchOptions.navigationTimeoutMs === undefined ? {} : { navigationTimeoutMs: launchOptions.navigationTimeoutMs }) });
    },
  });
}
