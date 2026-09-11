import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExecutionPlan,
  parseSurebetNotification,
} from "../src/index.ts";
import {
  sameBookmakerRecommendation,
  validPairWithSameBookmakerAvailableOnBothSides,
} from "./same-bookmaker.fixture.ts";

test("parser rejects a recommended pair that resolves both legs to the same bookmaker", () => {
  const parsed = parseSurebetNotification(sameBookmakerRecommendation);

  assert.equal(parsed.ok, false);
  if (parsed.ok) return;

  assert.ok(
    parsed.errors.some(
      (candidate) =>
        candidate.code === "INVALID_RECOMMENDATION" &&
        candidate.message.includes("two distinct bookmakers"),
    ),
  );
});

test("a normal two-bookmaker recommendation remains executable even when one bookmaker has an unused opposite-side offer", () => {
  const parsed = parseSurebetNotification(validPairWithSameBookmakerAvailableOnBothSides);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const plan = buildExecutionPlan(parsed.value, "option-1", "2026-09-11T14:40:00.000Z");
  assert.equal(plan.ok, true);
  if (!plan.ok) return;

  assert.deepEqual(
    plan.value.legs.map((leg) => leg.target.bookmaker),
    ["sisal", "bet365"],
  );
});

test("plan construction independently rejects a tampered parsed object with same-bookmaker legs", () => {
  const parsed = parseSurebetNotification(validPairWithSameBookmakerAvailableOnBothSides);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const option = parsed.value.recommendedOptions[0];
  const sisalUnder = parsed.value.outcomeGroups[1].offers.find(
    (offer) => offer.bookmaker === "sisal",
  );
  assert.ok(option);
  assert.ok(sisalUnder);
  if (!option || !sisalUnder) return;

  const tamperedOption = {
    ...option,
    legs: [
      option.legs[0],
      {
        ...option.legs[1],
        bookmaker: "sisal" as const,
        offerId: sisalUnder.id,
      },
    ] as const,
  };

  const tamperedNotification = {
    ...parsed.value,
    recommendedOptions: [tamperedOption],
  };

  const plan = buildExecutionPlan(
    tamperedNotification,
    option.id,
    "2026-09-11T14:40:00.000Z",
  );

  assert.equal(plan.ok, false);
  if (plan.ok) return;

  assert.ok(
    plan.errors.some(
      (candidate) =>
        candidate.code === "DUPLICATE_PLAN_LEGS" &&
        candidate.message.includes("two distinct bookmakers"),
    ),
  );
});
