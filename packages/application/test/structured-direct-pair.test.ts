import assert from "node:assert/strict";
import test from "node:test";
import {
  DIRECT_PAIR_SCHEMA_VERSION,
  DIRECT_PAIR_SCHEMA_VERSION_V2,
  normalizeDirectPairNotification,
  normalizeDirectPairNotificationV1,
  normalizeDirectPairNotificationV2,
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

test("structured v1 remains wire-frozen and still requires expectedOdds", () => {
  const value = payload();
  Reflect.deleteProperty(value.legs[0], "expectedOdds");
  const result = normalizeDirectPairNotificationV1(value, { now });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.some((item) => item.code === "INVALID_ODDS"), true);
  }
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


function payloadV2() {
  const signal = "11111111-2222-4333-8444-555555555555";
  return {
    schemaVersion: DIRECT_PAIR_SCHEMA_VERSION_V2,
    notificationId: "surebet-20260922-v2-001",
    sentAt: "2026-09-22T12:20:00.000Z",
    event: {
      participantA: "Kosovo",
      participantB: "Irlanda",
      competition: "Nations League",
      scheduledAt: "2026-09-24T20:45:00+02:00",
    },
    market: {
      family: "total",
      context: "corners",
      period: "full_match",
      line: "10.5",
      sourceLabel: "U/O CORNER 10.5",
    },
    legs: [
      {
        bookmaker: "sisal",
        outcome: "over",
        expectedOdds: "2.10",
        navigation: {
          kind: "betup-relay",
          url: "https://www.bet-up.it/lnk/" + signal + "/sisal",
        },
      },
      {
        bookmaker: "bet365",
        outcome: "under",
        expectedOdds: "1.90",
        navigation: {
          kind: "betup-relay",
          url: "https://www.bet-up.it/lnk/" + signal + "/bet365",
        },
      },
    ],
  };
}

const nowV2 = () => new Date("2026-09-22T12:22:00.000Z");

test("structured v2 normalizes typed bet-up relay navigation without projecting it to deepLink", () => {
  const result = normalizeDirectPairNotificationV2(payloadV2(), { now: nowV2 });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.plan.recommendedOptionId, "direct-pair-v2");
  const first = result.value.plan.legs[0].target;
  const second = result.value.plan.legs[1].target;
  assert.equal(first.deepLink, undefined);
  assert.deepEqual(first.navigation, {
    kind: "BETUP_RELAY",
    url: "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/sisal",
    signalId: "11111111-2222-4333-8444-555555555555",
    bookmaker: "sisal",
  });
  assert.equal(second.navigation?.kind, "BETUP_RELAY");
  assert.deepEqual(first.provenance, {
    kind: "structured-direct-pair",
    schemaVersion: DIRECT_PAIR_SCHEMA_VERSION_V2,
    notificationId: "surebet-20260922-v2-001",
    legIndex: 0,
  });
});

test("structured v2 accepts absent expectedOdds and preserves valid present price only as metadata", () => {
  const withoutPrice = payloadV2();
  Reflect.deleteProperty(withoutPrice.legs[0], "expectedOdds");
  Reflect.deleteProperty(withoutPrice.legs[1], "expectedOdds");

  const absent = normalizeDirectPairNotificationV2(withoutPrice, { now: nowV2 });
  assert.equal(absent.ok, true);
  if (!absent.ok) return;
  assert.equal(absent.value.canonical.legs[0].expectedOdds, undefined);
  assert.equal(absent.value.canonical.legs[1].expectedOdds, undefined);
  assert.equal(absent.value.plan.legs[0].target.expectedOdds, undefined);
  assert.equal(absent.value.plan.legs[1].target.expectedOdds, undefined);

  const withPrice = payloadV2();
  withPrice.legs[0].expectedOdds = "2.100";
  const present = normalizeDirectPairNotificationV2(withPrice, { now: nowV2 });
  assert.equal(present.ok, true);
  if (present.ok) {
    assert.equal(present.value.canonical.legs[0].expectedOdds, "2.1");
    assert.equal(present.value.plan.legs[0].target.expectedOdds, "2.1");
  }
});

test("structured v2 rejects malformed present expectedOdds as metadata validation", () => {
  const value = payloadV2();
  value.legs[0].expectedOdds = "not-a-price";
  const result = normalizeDirectPairNotificationV2(value, { now: nowV2 });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.errors.some(
        (item) => item.code === "INVALID_ODDS" && item.field === "legs[0].expectedOdds",
      ),
      true,
    );
  }
});

test("structured v2 supports typed direct-bookmaker candidates and exact schema dispatch", () => {
  const value = payloadV2();
  value.legs[0].navigation = {
    kind: "bookmaker-direct",
    url: "https://www.sisal.it/scommesse-matchpoint/sport/calcio/event/fixture",
  };
  value.legs[1].navigation = {
    kind: "bookmaker-direct",
    url: "https://www.bet365.it/#/AC/B1/C1/D100/Efixture/",
  };

  const direct = normalizeDirectPairNotificationV2(value, { now: nowV2 });
  assert.equal(direct.ok, true);
  if (direct.ok) {
    assert.deepEqual(direct.value.plan.legs.map((leg) => leg.target.navigation?.kind), [
      "BOOKMAKER_DIRECT",
      "BOOKMAKER_DIRECT",
    ]);
    assert.equal(direct.value.plan.legs[0].target.deepLink, undefined);
  }

  const dispatched = normalizeDirectPairNotification(value, { now: nowV2 });
  assert.equal(dispatched.ok, true);
  if (dispatched.ok) assert.equal(dispatched.value.canonical.schemaVersion, DIRECT_PAIR_SCHEMA_VERSION_V2);

  const unknown = { ...value, schemaVersion: "notifyhandler.direct-pair.v99" };
  const rejected = normalizeDirectPairNotification(unknown, { now: nowV2 });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.errors.some((item) => item.code === "UNSUPPORTED_SCHEMA_VERSION"), true);
});

test("structured v2 rejects malformed relay grammar and bookmaker binding before execution", () => {
  const cases: Array<{ mutate(value: ReturnType<typeof payloadV2>): void; code: string }> = [
    {
      mutate(value) { value.legs[0].navigation.url += "?token=nope"; },
      code: "INVALID_RELAY_URL",
    },
    {
      mutate(value) { value.legs[0].navigation.url += "#fragment"; },
      code: "INVALID_RELAY_URL",
    },
    {
      mutate(value) { value.legs[0].navigation.url = "https://user:secret@www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/sisal"; },
      code: "INVALID_RELAY_URL",
    },
    {
      mutate(value) { value.legs[0].navigation.url = "https://www.bet-up.it/lnk/not-a-uuid/sisal"; },
      code: "INVALID_RELAY_URL",
    },
    {
      mutate(value) { value.legs[0].navigation.url = "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/unknown"; },
      code: "UNKNOWN_RELAY_SUFFIX",
    },
    {
      mutate(value) { value.legs[0].navigation.url = "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/bet365"; },
      code: "RELAY_BOOKMAKER_MISMATCH",
    },
    {
      mutate(value) { value.legs[1].navigation.url = "https://www.bet-up.it/lnk/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/bet365"; },
      code: "RELAY_SIGNAL_MISMATCH",
    },
  ];

  for (const { mutate, code } of cases) {
    const value = payloadV2();
    mutate(value);
    const result = normalizeDirectPairNotificationV2(value, { now: nowV2 });
    assert.equal(result.ok, false, code);
    if (!result.ok) assert.equal(result.errors.some((item) => item.code === code), true, code);
  }
});

test("structured v2 rejects suffix/direct-origin mismatches, unsupported workers, and v2-to-v1 fallback", () => {
  const wrongDirect = payloadV2();
  wrongDirect.legs[0].navigation = {
    kind: "bookmaker-direct",
    url: "https://www.bet365.it/wrong-bookmaker",
  };
  const direct = normalizeDirectPairNotificationV2(wrongDirect, { now: nowV2 });
  assert.equal(direct.ok, false);
  if (!direct.ok) assert.equal(direct.errors.some((item) => item.code === "INVALID_NAVIGATION"), true);

  const unsupported = payloadV2();
  unsupported.legs[0].bookmaker = "lottomatica";
  unsupported.legs[0].navigation.url = "https://www.bet-up.it/lnk/11111111-2222-4333-8444-555555555555/lottomatica";
  const worker = normalizeDirectPairNotificationV2(unsupported, { now: nowV2 });
  assert.equal(worker.ok, false);
  if (!worker.ok) assert.equal(worker.errors.some((item) => item.code === "UNSUPPORTED_BOOKMAKER"), true);

  const oldShape = payload();
  const invalidV2 = { ...oldShape, schemaVersion: DIRECT_PAIR_SCHEMA_VERSION_V2 };
  const noFallback = normalizeDirectPairNotification(invalidV2, { now });
  assert.equal(noFallback.ok, false);
  if (!noFallback.ok) assert.equal(noFallback.errors.some((item) => item.code === "INVALID_LEGS" || item.code === "INVALID_NAVIGATION"), true);
});


test("structured v2 preserves full-match period in the immutable selection target", () => {
  const result = normalizeDirectPairNotificationV2(payloadV2(), {
    now: () => new Date("2026-09-22T12:20:30.000Z"),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  for (const leg of result.value.plan.legs) {
    assert.equal(
      leg.target.market.period,
      "full_match",
      "full-match vs first-half is an identity dimension and must survive structured normalization",
    );
  }
});
