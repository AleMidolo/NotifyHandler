import type { SelectionTarget } from "../../domain/src/core.ts";
import type {
  AdapterExecutionContext,
  AdapterObserver,
  AdapterTerminalResult,
  SelectionActivationGate,
} from "./contracts.ts";
import { Bet365Adapter as Bet365AdapterBase } from "./bet365-core.ts";
import { withValidatedFinalLocation } from "./navigation.ts";

function cancellationDuringActivation(
  ctx: AdapterExecutionContext,
  result: AdapterTerminalResult,
): AdapterTerminalResult {
  const failure = {
    code: "SELECTION_VERIFICATION_FAILED" as const,
    stage: "SELECTION_VERIFICATION" as const,
    message: "Cancellation occurred while final BET365 selection activation was in flight; a selection may be present and requires manual review.",
    recoverability: "USER_REVIEW" as const,
    activation: "ATTEMPTED_NOT_VERIFIED" as const,
    evidenceEpoch: ctx.evidenceEpoch,
  };

  if (result.kind === "READY_FOR_USER") {
    return {
      kind: "FAILED_SAFE",
      failure,
      evidence: result.evidence,
      ...(result.odds === undefined ? {} : { odds: result.odds }),
    };
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
 * Cancellation- and redirect-safe BET365 adapter facade.
 *
 * The underlying implementation performs deterministic matching and activation.
 * This facade validates the full final browser location before the core can inspect
 * authentication or matching evidence, and guards the activation gate so an abort
 * raised while final activation is in flight can never escape as READY_FOR_USER.
 */
export class Bet365Adapter extends Bet365AdapterBase {
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
