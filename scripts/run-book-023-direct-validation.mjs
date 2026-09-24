import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { runLocalLiveExplorer } from "./run-live-explorer.mjs";

export const BOOK_023_TARGETS = Object.freeze({
  bet365: Object.freeze({
    bookmaker: "bet365",
    url: "https://www.bet365.it/#/AC/B1/C1/D8/E201149499/F3/I1/",
    event: "Portogallo - Galles",
    competition: "Nations League",
    scheduledLocal: "24/09/2026 20:45",
    market: "full_match total_corners",
    line: 6.5,
    side: "OVER",
    expectedOdds: 1.14,
  }),
  sisal: Object.freeze({
    bookmaker: "sisal",
    url: "https://www.sisal.it/scommesse-matchpoint/evento/calcio/nations-league/portogallo-galles",
    event: "Portogallo - Galles",
    competition: "Nations League",
    scheduledLocal: "24/09/2026 20:45",
    market: "full_match total_corners",
    line: 6.5,
    side: "UNDER",
    expectedOdds: 4.25,
  }),
});

export function parseBook023Bookmaker(args) {
  if (args.length !== 1 || !(args[0] in BOOK_023_TARGETS)) {
    throw new Error("Usage: npm run live:book023:local -- bet365|sisal");
  }
  return args[0];
}

export function buildBook023Environment(environment, bookmaker) {
  const target = BOOK_023_TARGETS[bookmaker];
  if (target === undefined) throw new Error(`Unsupported BOOK-023 bookmaker: ${bookmaker}`);

  const childEnvironment = { ...environment };
  delete childEnvironment.NH_LIVE_EXPLORER_RELAY_URL;
  delete childEnvironment.NH_LIVE_EXPLORER_REQUIRE_RELAY;
  delete childEnvironment.NH_LIVE_EXPLORER_MAX_ACTIONS;
  delete childEnvironment.NH_LIVE_EXPLORER_DELAY_MS;
  childEnvironment.NH_LIVE_EXPLORER_REQUIRE_DIRECT = "1";
  childEnvironment.NH_LIVE_EXPLORER_URL = target.url;
  return childEnvironment;
}

export async function runBook023DirectValidation(bookmaker, options = {}) {
  const environment = buildBook023Environment(options.environment ?? process.env, bookmaker);
  return runLocalLiveExplorer(bookmaker, { environment });
}

async function main() {
  const bookmaker = parseBook023Bookmaker(process.argv.slice(2));
  process.exitCode = await runBook023DirectValidation(bookmaker);
}

const invokedAsScript =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedAsScript) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown BOOK-023 direct validation failure.";
    process.stderr.write(`NotifyHandler BOOK-023 direct validation failed safely: ${message}\n`);
    process.exitCode = 1;
  });
}
