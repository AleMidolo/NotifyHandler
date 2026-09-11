export * from "./core.ts";

import {
  buildExecutionPlan as buildCoreExecutionPlan,
  parseSurebetNotification as parseCoreSurebetNotification,
} from "./core.ts";
import type {
  DomainError,
  DomainResult,
  ExecutionPlan,
  ParseOptions,
  RecommendedOption,
  SurebetNotification,
} from "./core.ts";

function sameBookmakerPairError(option: RecommendedOption, code: "INVALID_RECOMMENDATION" | "DUPLICATE_PLAN_LEGS"): DomainError {
  return {
    code,
    message: "A recommended surebet pair must use two distinct bookmakers.",
    field: code === "INVALID_RECOMMENDATION" ? "recommendedOptions" : "legs",
    section: "recommendedOptions",
    source: option.sourceLabel,
  };
}

function usesSameBookmaker(option: RecommendedOption): boolean {
  const [first, second] = option.legs;
  return first.bookmaker === second.bookmaker;
}

export function parseSurebetNotification(
  sourceText: string,
  options: ParseOptions = {},
): DomainResult<SurebetNotification> {
  const parsed = parseCoreSurebetNotification(sourceText, options);
  if (!parsed.ok) return parsed;

  const duplicateBookmakerOptions = parsed.value.recommendedOptions.filter(usesSameBookmaker);
  if (duplicateBookmakerOptions.length > 0) {
    return {
      ok: false,
      errors: duplicateBookmakerOptions.map((option) => sameBookmakerPairError(option, "INVALID_RECOMMENDATION")),
    };
  }

  return parsed;
}

export function buildExecutionPlan(
  notification: SurebetNotification,
  recommendedOptionId: string,
  createdAt: string,
): DomainResult<ExecutionPlan> {
  const option = notification.recommendedOptions.find((candidate) => candidate.id === recommendedOptionId);
  if (option && usesSameBookmaker(option)) {
    return {
      ok: false,
      errors: [sameBookmakerPairError(option, "DUPLICATE_PLAN_LEGS")],
    };
  }

  return buildCoreExecutionPlan(notification, recommendedOptionId, createdAt);
}
