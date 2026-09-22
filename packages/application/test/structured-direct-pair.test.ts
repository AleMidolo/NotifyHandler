import assert from "node:assert/strict";
import test from "node:test";
import {
  DIRECT_PAIR_SCHEMA_VERSION,
  normalizeDirectPairNotificationV1,
} from "../src/structured-direct-pair.ts";

const now = () => new Date("2026-09-21T13:02:00.000Z");

function payload() {
  return {
    schemaVersion: DIRECT_PAIR_SCHEMA_VERSION,
    notificationId: "surebet-20260921-001",
    sentAt: "2026-09-21T13:00:00.000Z",
    event: {
      participantA: "Real Madrid",
      participantB: "Rayo Vallecano",
      competition: "La Liga",
      scheduledAt: "2026-09-21T19:00:00+02:00",
    },
    market: {
      family: "total",
      context: "corners",
      period: "full_match",
      line: "11.500",
      sourceLabel: "U/O CORNER 11.5",
    },
    legs: [
      {
        bookmaker: "sisal",
        outcome: "OVER",
        expectedOdds: "2.900",
        deepLink: "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/real-rayo",
      },
      {
        bookmaker: "bet365",
        outcome: "under",
        expectedOdds: "1.6100",
        deepLink: "https://www.bet365.it/#/AC/B1/C1/D100/Efixture/",
      },
    ],
  };
}

test("structured v1 normalizes into the shared immutable execution-plan semantics", () => {
  const result = normalizeDirectPairNotificationV1(payload(), { now });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.canonical.market.line, "11.5");
  assert.equal(result.value.canonical.legs[0].expectedOdds, "2.9");
  assert.equal(result.value.canonical.event.scheduledAt, "2026-09-21T17:00:00.000Z");
  assert.equal(result.value.plan.notificationId, "surebet-20260921-001");
  assert.equal(result.value.plan.recommendedOptionId, "direct-pair-v1");
  assert.equal(result.value.plan.legs[0].target.market.period, "full_match");
  assert.equal(result.value.plan.legs[1].target.market.period, "full_match");
  assert.deepEqual(result.value.plan.legs.map((leg) => [leg.target.bookmaker, leg.target.outcome.side]), [
    ["sisal", "over"],
    ["bet365", "under"],
  ]);
  assert.equal(result.value.plan.legs[0].target.deepLink, "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/real-rayo");
  assert.deepEqual(result.value.plan.legs[0].target.provenance, {
    kind: "structured-direct-pair",
    schemaVersion: DIRECT_PAIR_SCHEMA_VERSION,
    notificationId: "surebet-20260921-001",
    legIndex: 0,
  });
});

test("structured v1 rejects protocol drift, stale input, and ambiguous pair identity", () => {
  const withUnknown = { ...payload(), unexpected: true };
  const strict = normalizeDirectPairNotificationV1(withUnknown, { now });
  assert.equal(strict.ok, false);
  if (!strict.ok) assert.equal(strict.errors.some((item) => item.code === "INVALID_SCHEMA"), true);

  const stalePayload = { ...payload(), sentAt: "2026-09-21T12:50:00.000Z" };
  const stale = normalizeDirectPairNotificationV1(stalePayload, { now });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.errors.some((item) => item.code === "STALE_NOTIFICATION"), true);

  const sameBookmaker = payload();
  sameBookmaker.legs[1].bookmaker = "sisal";
  const duplicate = normalizeDirectPairNotificationV1(sameBookmaker, { now });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.errors.some((item) => item.code === "DUPLICATE_BOOKMAKER"), true);

  const sameSide = payload();
  sameSide.legs[1].outcome = "OVER";
  const sides = normalizeDirectPairNotificationV1(sameSide, { now });
  assert.equal(sides.ok, false);
  if (!sides.ok) assert.equal(sides.errors.some((item) => item.code === "INVALID_OUTCOME"), true);
});

test("structured v1 rejects unknown bookmakers and unsafe navigation candidates before orchestration", () => {
  const unsupported = payload();
  unsupported.legs[0].bookmaker = "unknownbet";
  const unknown = normalizeDirectPairNotificationV1(unsupported, { now });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.errors.some((item) => item.code === "UNSUPPORTED_BOOKMAKER"), true);

  const credentialUrl = payload();
  credentialUrl.legs[0].deepLink = "https://user:secret@www.sisal.it/event";
  const credentials = normalizeDirectPairNotificationV1(credentialUrl, { now });
  assert.equal(credentials.ok, false);
  if (!credentials.ok) assert.equal(credentials.errors.some((item) => item.code === "INVALID_DEEP_LINK"), true);

  const localUrl = payload();
  localUrl.legs[0].deepLink = "https://127.0.0.1/event";
  const local = normalizeDirectPairNotificationV1(localUrl, { now });
  assert.equal(local.ok, false);
  if (!local.ok) assert.equal(local.errors.some((item) => item.code === "INVALID_DEEP_LINK"), true);
});


test("structured v1 rejects impossible calendar instants instead of normalizing them", () => {
  const impossibleSentAt = payload();
  impossibleSentAt.sentAt = "2026-02-31T12:00:00Z";
  const sentAtResult = normalizeDirectPairNotificationV1(impossibleSentAt, {
    now: () => new Date("2026-03-03T12:01:00.000Z"),
  });
  assert.equal(sentAtResult.ok, false);
  if (!sentAtResult.ok) {
    assert.equal(sentAtResult.errors.some((item) => item.code === "INVALID_SENT_AT"), true);
  }

  const impossibleScheduledAt = payload();
  impossibleScheduledAt.event.scheduledAt = "2026-02-31T19:00:00+02:00";
  const eventResult = normalizeDirectPairNotificationV1(impossibleScheduledAt, { now });
  assert.equal(eventResult.ok, false);
  if (!eventResult.ok) {
    assert.equal(eventResult.errors.some((item) => item.code === "INVALID_EVENT"), true);
  }
});
