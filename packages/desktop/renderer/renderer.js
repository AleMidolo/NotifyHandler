import { toRendererModel } from "./model.js";

const api = window.notifyHandler;
const form = document.querySelector("#notification-form");
const input = document.querySelector("#notification-input");
const errorBox = document.querySelector("#error-box");
const statusValue = document.querySelector("#status-value");
const planBox = document.querySelector("#plan-box");
const legsBox = document.querySelector("#legs-box");
const metricsBox = document.querySelector("#metrics-box");
const recoveryBox = document.querySelector("#plan-recovery");

let currentSnapshot = null;

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = String(value);
  if (className) node.className = className;
  return node;
}

function showError(message = "") {
  errorBox.textContent = message;
  errorBox.hidden = message.length === 0;
}

async function run(operation) {
  showError();
  try {
    const result = await operation;
    if (!result.ok) {
      showError(`${result.error.code}: ${result.error.message}`);
      return;
    }
    render(result.value);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Unexpected renderer bridge failure.");
  }
}

function addAction(container, label, handler, kind = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action ${kind}`;
  button.textContent = label;
  button.addEventListener("click", handler);
  container.appendChild(button);
}

function renderPlan(model) {
  clear(planBox);
  if (model.planId === null) {
    planBox.appendChild(text("p", "No executable plan is active.", "muted"));
    return;
  }

  const heading = text("h2", "Automatic primary plan");
  planBox.appendChild(heading);
  planBox.appendChild(text("p", `Recommendation: ${model.recommendedOptionId ?? "—"}`, "muted"));

  for (const target of model.targets) {
    const card = document.createElement("article");
    card.className = "target-card";
    card.appendChild(text("h3", target.bookmaker.toUpperCase()));
    card.appendChild(text("p", target.event));
    card.appendChild(text("p", `${target.competition} · ${target.scheduledAt}`, "muted"));
    card.appendChild(text("p", `${target.market} · ${target.outcome.toUpperCase()} ${target.line}`));
    card.appendChild(text("p", target.expectedOdds === null ? "Notified odds: —" : `Notified odds: ${target.expectedOdds}`, "odds"));
    planBox.appendChild(card);
  }
}

function invokeLegAction(action, leg) {
  switch (action) {
    case "RESUME_AUTH":
      return run(api.resumeAfterManualAuth(leg.legId, leg.attemptId));
    case "RETRY":
      return run(api.retry(leg.legId, leg.attemptId));
    case "REOPEN":
      return run(api.reopen(leg.legId, leg.attemptId));
    case "CANCEL":
      return run(api.cancel(leg.legId, leg.attemptId));
  }
}

function renderLegs(model) {
  clear(legsBox);
  if (model.legs.length === 0) {
    legsBox.appendChild(text("p", "Leg execution has not started.", "muted"));
    return;
  }

  for (const leg of model.legs) {
    const card = document.createElement("article");
    card.className = "leg-card";
    const header = document.createElement("div");
    header.className = "leg-header";
    header.appendChild(text("h3", leg.bookmaker.toUpperCase()));
    header.appendChild(text("span", leg.state, `badge state-${leg.state.toLowerCase()}`));
    card.appendChild(header);
    card.appendChild(text("p", `Attempt ${leg.attemptNumber} · evidence epoch ${leg.evidenceEpoch}`, "muted"));

    if (leg.state === "AUTH_REQUIRED") {
      card.appendChild(text("p", "Authenticate manually in the bookmaker window, then resume this leg."));
    }
    if (leg.observedOdds) {
      const expected = leg.observedOdds.expected ?? "—";
      const observed = leg.observedOdds.observed ?? "unavailable";
      const priceState = leg.observedOdds.comparison?.toLowerCase()
        ?? leg.observedOdds.status?.toLowerCase()
        ?? "not observed";
      card.appendChild(text(
        "p",
        `Odds (informational): notified ${expected} · observed ${observed} · ${priceState}`,
        "odds",
      ));
    }
    if (leg.failure) {
      card.appendChild(text("p", `${leg.failure.code}: ${leg.failure.message}`, "failure"));
    }
    if (leg.state === "READY_FOR_USER") {
      card.appendChild(text("p", "Selection prepared. Review the bookmaker window and complete authentication, stake entry, review, and final submission manually.", "handoff"));
    }

    const actions = document.createElement("div");
    actions.className = "actions";
    for (const action of leg.actions) {
      if (action === "RESUME_AUTH") addAction(actions, "Resume after manual login", () => invokeLegAction(action, leg), "primary");
      else if (action === "RETRY") addAction(actions, "Retry", () => invokeLegAction(action, leg));
      else if (action === "REOPEN") addAction(actions, "Reopen bookmaker", () => invokeLegAction(action, leg));
      else if (action === "CANCEL") addAction(actions, "Cancel leg", () => invokeLegAction(action, leg), "danger");
    }
    card.appendChild(actions);
    legsBox.appendChild(card);
  }
}

function renderMetrics(model) {
  clear(metricsBox);
  const latency = model.latency.notificationToFirstWorkerStartMs;
  metricsBox.appendChild(text("span", latency === null ? "First worker start: —" : `Notification → first worker start: ${latency} ms`));
}

function renderPlanRecovery(model) {
  clear(recoveryBox);
  if (model.planActions.includes("RESTART_PLAN") && model.planId !== null) {
    addAction(recoveryBox, "Restart plan", () => run(api.restartPlan(model.planId)), "secondary");
  }
}

function render(snapshot) {
  currentSnapshot = snapshot;
  const model = toRendererModel(snapshot);
  statusValue.textContent = model.status;
  renderPlan(model);
  renderLegs(model);
  renderMetrics(model);
  renderPlanRecovery(model);

  if (model.preflightFailure) showError(`${model.preflightFailure.code}: ${model.preflightFailure.message}`);
  else if (model.parseErrors.length > 0) showError(model.parseErrors.map((item) => `${item.code}: ${item.message}`).join(" · "));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  run(api.submitNotification(input.value));
});

api.onSnapshot((snapshot) => render(snapshot));
run(api.getSnapshot());

window.addEventListener("beforeunload", () => {
  currentSnapshot = null;
});
