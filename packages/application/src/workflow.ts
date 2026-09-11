import {
  buildExecutionPlan,
  parseSurebetNotification,
} from "../../domain/src/index.ts";
import type {
  BookmakerId,
  BookmakerOffer,
  DomainError,
  ExecutionPlan,
  OutcomeSide,
  RecommendedOption,
  SurebetNotification,
} from "../../domain/src/index.ts";

export type ApplicationWorkflowPhase =
  | "awaiting_input"
  | "invalid"
  | "parsed"
  | "plan_ready";

export interface OfferPreview {
  readonly id: string;
  readonly side: OutcomeSide;
  readonly bookmaker: BookmakerId | null;
  readonly bookmakerLabel: string;
  readonly expectedOdds: string;
  readonly deepLink: string | null;
}

export interface RecommendationLegPreview {
  readonly bookmaker: BookmakerId;
  readonly bookmakerLabel: string;
  readonly side: OutcomeSide;
  readonly line: string;
  readonly expectedOdds: string | null;
  readonly deepLink: string | null;
}

export interface RecommendedOptionPreview {
  readonly id: string;
  readonly sourceLabel: string;
  readonly legs: readonly [RecommendationLegPreview, RecommendationLegPreview];
  readonly suggestedStakes: readonly {
    readonly offerId: string;
    readonly amount: string;
    readonly currency: "EUR";
  }[];
}

export interface NotificationPreview {
  readonly notificationId: string;
  readonly signalRoi: string | null;
  readonly event: Readonly<{
    participantA: string;
    participantB: string;
    display: string;
    competition: string | null;
    scheduledSource: string | null;
    scheduledInstant: string | null;
  }>;
  readonly market: Readonly<{
    family: string;
    subtype: string;
    context: string;
    line: string;
    sourceLabel: string;
  }>;
  readonly outcomes: readonly {
    readonly side: OutcomeSide;
    readonly offers: readonly OfferPreview[];
  }[];
  readonly recommendedOptions: readonly RecommendedOptionPreview[];
}

export interface ExecutionLegSummary {
  readonly legId: string;
  readonly bookmaker: BookmakerId;
  readonly bookmakerLabel: string;
  readonly event: string;
  readonly competition: string | null;
  readonly scheduledSource: string | null;
  readonly scheduledAt: string | null;
  readonly market: string;
  readonly marketContext: string;
  readonly line: string;
  readonly outcome: OutcomeSide;
  readonly expectedOdds: string;
  readonly deepLink: string | null;
}

export interface ExecutionPlanSummary {
  readonly planId: string;
  readonly recommendedOptionId: string;
  readonly legs: readonly [ExecutionLegSummary, ExecutionLegSummary];
}

export interface ApplicationWorkflowState {
  readonly phase: ApplicationWorkflowPhase;
  readonly inputText: string;
  readonly errors: readonly DomainError[];
  readonly preview: NotificationPreview | null;
  readonly selectedRecommendedOptionId: string | null;
  readonly executionPlan: ExecutionPlan | null;
  readonly executionSummary: ExecutionPlanSummary | null;
  readonly canStartExecution: boolean;
}

export interface ApplicationWorkflowOptions {
  readonly sourceUtcOffsetMinutes?: number;
  readonly now?: () => Date;
}

const BOOKMAKER_LABELS: Readonly<Record<BookmakerId, string>> = Object.freeze({
  sisal: "SISAL",
  bet365: "BET365",
  lottomatica: "LOTTOMATICA",
  eplay24: "EPLAY24",
  admiralbet: "ADMIRALBET",
});

function bookmakerLabel(bookmaker: BookmakerId): string {
  return BOOKMAKER_LABELS[bookmaker];
}

function initialState(): ApplicationWorkflowState {
  return {
    phase: "awaiting_input",
    inputText: "",
    errors: [],
    preview: null,
    selectedRecommendedOptionId: null,
    executionPlan: null,
    executionSummary: null,
    canStartExecution: false,
  };
}

function allOffers(notification: SurebetNotification): readonly BookmakerOffer[] {
  return notification.outcomeGroups.flatMap((group) => group.offers);
}

function offerPreview(offer: BookmakerOffer): OfferPreview {
  return {
    id: offer.id,
    side: offer.side,
    bookmaker: offer.bookmaker ?? null,
    bookmakerLabel: offer.bookmakerLabel,
    expectedOdds: offer.expectedOdds,
    deepLink: offer.deepLink ?? null,
  };
}

function recommendationLegPreview(
  notification: SurebetNotification,
  option: RecommendedOption,
  index: 0 | 1,
): RecommendationLegPreview {
  const leg = option.legs[index];
  const offer = allOffers(notification).find((candidate) => candidate.id === leg.offerId);

  return {
    bookmaker: leg.bookmaker,
    bookmakerLabel: bookmakerLabel(leg.bookmaker),
    side: leg.side,
    line: notification.market.line,
    expectedOdds: offer?.expectedOdds ?? leg.expectedOdds ?? null,
    deepLink: offer?.deepLink ?? null,
  };
}

function recommendationPreview(
  notification: SurebetNotification,
  option: RecommendedOption,
): RecommendedOptionPreview {
  return {
    id: option.id,
    sourceLabel: option.sourceLabel,
    legs: [
      recommendationLegPreview(notification, option, 0),
      recommendationLegPreview(notification, option, 1),
    ],
    suggestedStakes: (option.suggestedStakes ?? []).map((stake) => ({
      offerId: stake.offerId,
      amount: stake.amount,
      currency: stake.currency,
    })),
  };
}

function notificationPreview(notification: SurebetNotification): NotificationPreview {
  return {
    notificationId: notification.id,
    signalRoi: notification.signalRoi ?? null,
    event: {
      participantA: notification.event.participantA,
      participantB: notification.event.participantB,
      display: notification.event.canonicalDisplay,
      competition: notification.competition ?? null,
      scheduledSource: notification.scheduledAt?.sourceText ?? null,
      scheduledInstant: notification.scheduledAt?.instant ?? null,
    },
    market: {
      family: notification.market.family,
      subtype: notification.market.subtype,
      context: notification.market.context,
      line: notification.market.line,
      sourceLabel: notification.market.sourceLabel,
    },
    outcomes: notification.outcomeGroups.map((group) => ({
      side: group.side,
      offers: group.offers.map(offerPreview),
    })),
    recommendedOptions: notification.recommendedOptions.map((option) =>
      recommendationPreview(notification, option),
    ),
  };
}

function executionLegSummary(
  plan: ExecutionPlan,
  notification: SurebetNotification,
  index: 0 | 1,
): ExecutionLegSummary {
  const leg = plan.legs[index];
  return {
    legId: leg.id,
    bookmaker: leg.target.bookmaker,
    bookmakerLabel: bookmakerLabel(leg.target.bookmaker),
    event: leg.target.event.sourceDisplay,
    competition: leg.target.event.competition ?? null,
    scheduledSource: notification.scheduledAt?.sourceText ?? null,
    scheduledAt: leg.target.event.scheduledAt ?? null,
    market: leg.target.market.sourceLabel,
    marketContext: leg.target.market.context,
    line: leg.target.market.line,
    outcome: leg.target.outcome.side,
    expectedOdds: leg.target.expectedOdds,
    deepLink: leg.target.deepLink ?? null,
  };
}

function executionPlanSummary(
  plan: ExecutionPlan,
  notification: SurebetNotification,
): ExecutionPlanSummary {
  return {
    planId: plan.id,
    recommendedOptionId: plan.recommendedOptionId,
    legs: [
      executionLegSummary(plan, notification, 0),
      executionLegSummary(plan, notification, 1),
    ],
  };
}

function selectionUnavailableError(): DomainError {
  return {
    code: "RECOMMENDATION_NOT_FOUND",
    message: "Parse a valid notification before selecting a recommended option.",
    field: "recommendedOptions",
    section: "recommendedOptions",
  };
}

/**
 * Renderer-neutral APP-001 workflow.
 *
 * This class deliberately stops at a reviewed execution plan. It has no browser,
 * adapter, credential, stake-entry, or bet-submission capability. APP-002 can
 * consume the immutable ExecutionPlan after the renderer has shown the summary.
 */
export class ApplicationWorkflow {
  private readonly now: () => Date;
  private readonly sourceUtcOffsetMinutes: number | undefined;
  private notification: SurebetNotification | null = null;
  private state: ApplicationWorkflowState = initialState();

  constructor(options: ApplicationWorkflowOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.sourceUtcOffsetMinutes = options.sourceUtcOffsetMinutes;
  }

  getState(): ApplicationWorkflowState {
    return this.state;
  }

  submitNotification(inputText: string): ApplicationWorkflowState {
    this.notification = null;
    const parseOptions = this.sourceUtcOffsetMinutes === undefined
      ? {}
      : { sourceUtcOffsetMinutes: this.sourceUtcOffsetMinutes };
    const parsed = parseSurebetNotification(inputText, parseOptions);

    if (!parsed.ok) {
      this.state = {
        phase: "invalid",
        inputText,
        errors: parsed.errors,
        preview: null,
        selectedRecommendedOptionId: null,
        executionPlan: null,
        executionSummary: null,
        canStartExecution: false,
      };
      return this.state;
    }

    this.notification = parsed.value;
    this.state = {
      phase: "parsed",
      inputText,
      errors: [],
      preview: notificationPreview(parsed.value),
      selectedRecommendedOptionId: null,
      executionPlan: null,
      executionSummary: null,
      canStartExecution: false,
    };
    return this.state;
  }

  selectRecommendedOption(recommendedOptionId: string): ApplicationWorkflowState {
    if (this.notification === null) {
      this.state = {
        ...this.state,
        errors: [selectionUnavailableError()],
        selectedRecommendedOptionId: null,
        executionPlan: null,
        executionSummary: null,
        canStartExecution: false,
      };
      return this.state;
    }

    const plan = buildExecutionPlan(
      this.notification,
      recommendedOptionId,
      this.now().toISOString(),
    );

    if (!plan.ok) {
      this.state = {
        ...this.state,
        phase: "parsed",
        errors: plan.errors,
        selectedRecommendedOptionId: null,
        executionPlan: null,
        executionSummary: null,
        canStartExecution: false,
      };
      return this.state;
    }

    this.state = {
      ...this.state,
      phase: "plan_ready",
      errors: [],
      selectedRecommendedOptionId: recommendedOptionId,
      executionPlan: plan.value,
      executionSummary: executionPlanSummary(plan.value, this.notification),
      canStartExecution: true,
    };
    return this.state;
  }

  clear(): ApplicationWorkflowState {
    this.notification = null;
    this.state = initialState();
    return this.state;
  }
}
