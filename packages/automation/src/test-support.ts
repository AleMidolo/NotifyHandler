import type { BookmakerLegSession } from "./session.ts";
import { launchSession } from "./session.ts";
import type { WorkerBookmaker } from "./dom-mapping.ts";
import type { FixtureDocuments } from "./page-runtime.ts";

export type { FixtureDocument, FixtureDocuments, FixtureResponse } from "./page-runtime.ts";

export interface LaunchFixtureLegSessionOptions {
  readonly bookmaker: WorkerBookmaker;
  readonly fixtures: FixtureDocuments;
  readonly headless?: boolean;
  readonly navigationTimeoutMs?: number;
}

/**
 * Test-only launcher. Exact approved HTTPS URLs are fulfilled from in-memory
 * fixture documents and every unconfigured request is blocked, so CI never
 * contacts live bookmaker infrastructure.
 */
export async function launchFixtureLegSession(
  options: LaunchFixtureLegSessionOptions,
): Promise<BookmakerLegSession> {
  return launchSession({
    bookmaker: options.bookmaker,
    headless: options.headless ?? true,
    fixtureDocuments: options.fixtures,
    ...(options.navigationTimeoutMs === undefined ? {} : { navigationTimeoutMs: options.navigationTimeoutMs }),
  });
}
