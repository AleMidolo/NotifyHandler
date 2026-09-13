export type WorkerBookmaker = "sisal" | "bet365";
export type SemanticElementRole = "auth" | "event" | "market" | "outcome";

export interface SemanticDomMapping {
  readonly authWall: string;
  readonly eventCandidate: string;
  readonly marketCandidate: string;
  readonly outcomeCandidate: string;
}

const MAPPINGS: Readonly<Record<WorkerBookmaker, SemanticDomMapping>> = Object.freeze({
  sisal: Object.freeze({
    authWall: '[data-nh-sisal-role="auth"]',
    eventCandidate: '[data-nh-sisal-role="event"]',
    marketCandidate: '[data-nh-sisal-role="market"]',
    outcomeCandidate: '[data-nh-sisal-role="outcome"]',
  }),
  bet365: Object.freeze({
    authWall: '[data-nh-bet365-role="auth"]',
    eventCandidate: '[data-nh-bet365-role="event"]',
    marketCandidate: '[data-nh-bet365-role="market"]',
    outcomeCandidate: '[data-nh-bet365-role="outcome"]',
  }),
});

export function domMappingFor(bookmaker: WorkerBookmaker): SemanticDomMapping {
  return MAPPINGS[bookmaker];
}
