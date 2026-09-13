import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  AdapterObserver,
  AdapterTerminalResult,
  SelectionActivationGate,
} from "./contracts.ts";
import { withValidatedFinalLocation } from "./navigation.ts";
import { SisalAdapter as SisalAdapterBase } from "./sisal-core.ts";

function cancellationDuringActivation(
  ctx: AdapterExecutionContext,
  result: AdapterTerminalResult,
): AdapterTerminalResult {
  const failure = {
    code: "SELECTION_VERIFICATION_FAILED" as const,
    stage: "SELECTION_VERIFICATION" as const,
    message: "Cancellation occurred while final SISAL selection activation was in flight; a selection may be present and requires manual review.",
    recoverability: "USER_REVIEW" as const,
    activation: "ATTEMPTED_NOT_VERIFIED" as const,
    evidenceEpoch: ctx.evidenceEpoch,
  };

  if (result.kind === "READY_FOR_USER" || result.kind === "ODDS_CHANGED") {
    return { kind: "FAILED_SAFE", failure, evidence: result.evidence, odds: result.odds };
  }
  if (result.kind === "FAILED_SAFE") {
    return {
      kind: "FAILED_SAFE",
      failure,
      ...(result.evidence === undefined ? {} : { evidence: result.evidence }),
      ...(result.odds === undefined ? {} : { odds: result.odds }),
    };
  }
  return { kind: "FAILED_SAFE", failure };
}

/**
 * Cancellation- and redirect-safe SISAL adapter facade.
 *
 * The underlying implementation performs all deterministic matching and activation.
 * This facade validates the full final browser location before the core can inspect
 * authentication or matching evidence, and guards the activation gate so an abort
 * raised while the final activation is in flight can never escape as READY_FOR_USER.
 */
export class SisalAdapter extends SisalAdapterBase {
  override async prepare(
    ctx: AdapterExecutionContext,
    target: SelectionTarget,
    observer: AdapterObserver,
    signal: AbortSignal,
  ): Promise<AdapterTerminalResult> {
    let activationRacedCancellation = false;

    const guardedGate: SelectionActivationGate = {
      activate: async (request) => {
        const activation = await ctx.selectionGate.activate(request);
        if (signal.aborted && activation.kind !== "REJECTED") {
          activationRacedCancellation = true;
        }
        return activation;
      },
    };

    const guardedBrowser = withValidatedFinalLocation(ctx.browser, this.supportedOrigins);
    const result = await super.prepare(
      { ...ctx, browser: guardedBrowser, selectionGate: guardedGate },
      target,
      observer,
      signal,
    );

    if (activationRacedCancellation || (signal.aborted && result.kind === "READY_FOR_USER")) {
      return cancellationDuringActivation(ctx, result);
    }

    return result;
  }
}
