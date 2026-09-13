import type {
  SelectionActivationGate,
  SelectionActivationResult,
} from "../../bookmakers/src/contracts.ts";
import { sameDecimal } from "../../bookmakers/src/matching.ts";
import type { WorkerBookmaker } from "./dom-mapping.ts";
import type { WorkerPageRuntime } from "./page-runtime.ts";

function allRequiredEvidenceMatched(request: Parameters<SelectionActivationGate["activate"]>[0]): boolean {
  const required = [
    request.evidence.origin,
    request.evidence.event.overall,
    request.evidence.market,
    request.evidence.line,
    request.evidence.outcome,
  ];
  return required.every((dimension) => dimension.status === "MATCHED");
}

export function createSelectionGate(
  runtime: WorkerPageRuntime,
  bookmaker: WorkerBookmaker,
  evidenceEpoch: number,
  isCurrentAttempt: () => boolean,
): SelectionActivationGate {
  return {
    async activate(request): Promise<SelectionActivationResult> {
      if (!isCurrentAttempt()) return { kind: "REJECTED", reasonCode: "ATTEMPT_SUPERSEDED" };
      if (request.target.bookmaker !== bookmaker) return { kind: "REJECTED", reasonCode: "BOOKMAKER_MISMATCH" };
      if (request.evidence.evidenceEpoch !== evidenceEpoch) return { kind: "REJECTED", reasonCode: "STALE_EVIDENCE_EPOCH" };
      if (!allRequiredEvidenceMatched(request)) return { kind: "REJECTED", reasonCode: "INCOMPLETE_MATCH_EVIDENCE" };
      if (!request.evidence.outcome.normalizedObserved?.includes(request.candidate.id)) {
        return { kind: "REJECTED", reasonCode: "CANDIDATE_NOT_TIED_TO_OUTCOME_EVIDENCE" };
      }
      if (!sameDecimal(request.odds.expected, request.target.expectedOdds)) {
        return { kind: "REJECTED", reasonCode: "EXPECTED_ODDS_MISMATCH" };
      }
      if (request.odds.comparison === "UNAVAILABLE" || request.odds.observed === undefined) {
        return { kind: "REJECTED", reasonCode: "OBSERVED_ODDS_UNAVAILABLE" };
      }
      if (request.odds.comparison === "EQUAL") {
        if (!sameDecimal(request.odds.observed, request.target.expectedOdds)) {
          return { kind: "REJECTED", reasonCode: "EQUAL_ODDS_INCONSISTENT" };
        }
      } else if (
        request.acknowledgedObservedOdds === undefined ||
        !sameDecimal(request.acknowledgedObservedOdds, request.odds.observed)
      ) {
        return { kind: "REJECTED", reasonCode: "ODDS_CHANGE_NOT_ACKNOWLEDGED" };
      }
      if (!isCurrentAttempt()) return { kind: "REJECTED", reasonCode: "ATTEMPT_SUPERSEDED" };
      if (!runtime.isCurrentLocationAllowed()) return { kind: "REJECTED", reasonCode: "CURRENT_LOCATION_NOT_ALLOWED" };
      if (!isCurrentAttempt()) return { kind: "REJECTED", reasonCode: "ATTEMPT_SUPERSEDED" };

      const activated = await runtime.activateSelection(request.candidate);
      if (!isCurrentAttempt()) {
        return { kind: "FAILED", reasonCode: "ATTEMPT_SUPERSEDED_DURING_ACTIVATION" };
      }
      return activated
        ? { kind: "ACTIVATED", selection: { candidate: request.candidate } }
        : { kind: "FAILED", reasonCode: "SELECTION_NOT_ACTIVATED" };
    },
  };
}
