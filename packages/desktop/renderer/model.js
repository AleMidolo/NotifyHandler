export function legActions(leg) {
  const actions = [];
  if (leg.state === "AUTH_REQUIRED") actions.push("RESUME_AUTH", "REOPEN", "CANCEL");
  else if (leg.state === "ODDS_CHANGED") actions.push("ACKNOWLEDGE_ODDS", "REOPEN", "CANCEL");
  else if (leg.state === "FAILED_SAFE") {
    if (leg.failure?.recoverability === "RETRY") actions.push("RETRY");
    if (leg.failure?.recoverability === "REOPEN") actions.push("REOPEN");
  } else if (leg.state === "CANCELLED") actions.push("REOPEN");
  else if (leg.state !== "READY_FOR_USER") actions.push("CANCEL");
  return actions;
}

export function planActions(execution) {
  if (execution.plan === null) return [];
  return ["PREFLIGHT_FAILED", "ACTION_REQUIRED", "PARTIAL", "FAILED_SAFE", "CANCELLED"].includes(execution.status)
    ? ["RESTART_PLAN"]
    : [];
}

export function toRendererModel(snapshot) {
  const execution = snapshot.execution;
  const targets = execution.plan?.legs.map((leg) => ({
    legId: leg.id,
    bookmaker: leg.target.bookmaker,
    event: leg.target.event.sourceDisplay,
    competition: leg.target.event.competition ?? "—",
    scheduledAt: leg.target.event.scheduledAt ?? "—",
    market: leg.target.market.sourceLabel,
    line: leg.target.market.line,
    outcome: leg.target.outcome.side,
    expectedOdds: leg.target.expectedOdds,
  })) ?? [];

  return {
    revision: snapshot.revision,
    status: execution.status,
    notificationId: execution.notificationId,
    recommendedOptionId: execution.plan?.recommendedOptionId ?? null,
    planId: execution.plan?.id ?? null,
    targets,
    legs: execution.legs?.map((leg) => ({ ...leg, actions: legActions(leg) })) ?? [],
    parseErrors: execution.parseErrors,
    preflightFailure: execution.preflightFailure,
    latency: snapshot.latency,
    planActions: planActions(execution),
  };
}
