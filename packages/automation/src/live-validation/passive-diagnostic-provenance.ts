export const PASSIVE_DIAGNOSTIC_SCHEMA_VERSION = "passive-provenance.v1" as const;

export type PassiveTransportScope = "TOP_LEVEL" | "SUBRESOURCE" | "SOCKET";

export type PassiveTransportProvenance =
  | Readonly<{ state: "CLEAR" }>
  | Readonly<{
      state: "BLOCKED";
      trigger: "WEBSOCKET_ATTEMPT";
      scope: "SOCKET";
    }>
  | Readonly<{
      state: "BLOCKED";
      trigger: "PUBLIC_HTTPS_TARGET_REJECTED" | "DISALLOWED_PROTOCOL";
      scope: "TOP_LEVEL" | "SUBRESOURCE";
    }>;

export type TargetPredicatePresence = Readonly<{
  domPresent: boolean;
  visibleObservedWithinBound: boolean;
}>;

export type PassiveReadinessProvenance =
  | "DOMCONTENTLOADED_CONFIRMED"
  | "DOMCONTENTLOADED_NOT_CONFIRMED";

export type PassiveDomPopulation = "EMPTY" | "SPARSE" | "POPULATED";

export const PASSIVE_TARGET_PRESENCE_KEYS = [
  "participantA",
  "participantB",
  "competition",
  "scheduledDate",
  "scheduledTime",
  "broadCornerContext",
  "totalCornersMarket",
  "fullMatchContext",
  "exactLine",
  "requestedSideAtLine",
  "expectedOdds",
] as const;

export type PassiveTargetPresenceKey = typeof PASSIVE_TARGET_PRESENCE_KEYS[number];

export interface PassiveRenderProvenance {
  readonly readiness: PassiveReadinessProvenance;
  readonly titlePredicates: Readonly<{
    participantPair: boolean;
    competition: boolean;
  }>;
  readonly targetPresence: Readonly<Record<PassiveTargetPresenceKey, TargetPredicatePresence>>;
  readonly domPopulation: PassiveDomPopulation;
}

export function webSocketTransportProvenance(): PassiveTransportProvenance {
  return {
    state: "BLOCKED",
    trigger: "WEBSOCKET_ATTEMPT",
    scope: "SOCKET",
  };
}

export function ordinaryTransportProvenance(
  protocol: string,
  isTopLevel: boolean,
  publicHttpsTarget: boolean | undefined,
): PassiveTransportProvenance {
  const scope = isTopLevel ? "TOP_LEVEL" : "SUBRESOURCE";
  if (protocol === "https:") {
    return publicHttpsTarget === false
      ? { state: "BLOCKED", trigger: "PUBLIC_HTTPS_TARGET_REJECTED", scope }
      : { state: "CLEAR" };
  }
  if (["data:", "blob:", "about:"].includes(protocol)) {
    return { state: "CLEAR" };
  }
  return { state: "BLOCKED", trigger: "DISALLOWED_PROTOCOL", scope };
}

export function retainFirstTransportProvenance(
  current: PassiveTransportProvenance,
  candidate: PassiveTransportProvenance,
): PassiveTransportProvenance {
  if (current.state === "BLOCKED" || candidate.state === "CLEAR") return current;
  return candidate;
}

export function readinessProvenance(confirmed: boolean): PassiveReadinessProvenance {
  return confirmed ? "DOMCONTENTLOADED_CONFIRMED" : "DOMCONTENTLOADED_NOT_CONFIRMED";
}

export function domPopulationBucket(descendantCount: number): PassiveDomPopulation {
  if (!Number.isInteger(descendantCount) || descendantCount < 0) {
    throw new Error("Passive DOM population count must be a non-negative integer.");
  }
  if (descendantCount === 0) return "EMPTY";
  if (descendantCount <= 31) return "SPARSE";
  return "POPULATED";
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(label + " must be an object.");
  }
  return value as JsonObject;
}

function assertExactKeys(
  object: JsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
  label = "object",
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) throw new Error(label + " contains unknown field: " + key);
  }
  for (const key of required) {
    if (!(key in object)) throw new Error(label + " is missing field: " + key);
  }
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== "boolean") throw new Error(label + " must be boolean.");
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") throw new Error(label + " must be string.");
}

function assertEnum(value: unknown, allowed: readonly string[], label: string): asserts value is string {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(label + " has an unknown enum value.");
  }
}

function validateTransport(value: unknown): PassiveTransportProvenance {
  const object = asObject(value, "transportProvenance");
  assertEnum(object.state, ["CLEAR", "BLOCKED"], "transportProvenance.state");
  if (object.state === "CLEAR") {
    assertExactKeys(object, ["state"], [], "transportProvenance");
    return { state: "CLEAR" };
  }

  assertExactKeys(object, ["state", "trigger", "scope"], [], "transportProvenance");
  assertEnum(
    object.trigger,
    ["WEBSOCKET_ATTEMPT", "PUBLIC_HTTPS_TARGET_REJECTED", "DISALLOWED_PROTOCOL"],
    "transportProvenance.trigger",
  );
  if (object.trigger === "WEBSOCKET_ATTEMPT") {
    assertEnum(object.scope, ["SOCKET"], "transportProvenance.scope");
    return { state: "BLOCKED", trigger: "WEBSOCKET_ATTEMPT", scope: "SOCKET" };
  }
  assertEnum(object.scope, ["TOP_LEVEL", "SUBRESOURCE"], "transportProvenance.scope");
  return {
    state: "BLOCKED",
    trigger: object.trigger as "PUBLIC_HTTPS_TARGET_REJECTED" | "DISALLOWED_PROTOCOL",
    scope: object.scope as "TOP_LEVEL" | "SUBRESOURCE",
  };
}

function validatePresence(value: unknown, label: string): TargetPredicatePresence {
  const object = asObject(value, label);
  assertExactKeys(object, ["domPresent", "visibleObservedWithinBound"], [], label);
  assertBoolean(object.domPresent, label + ".domPresent");
  assertBoolean(object.visibleObservedWithinBound, label + ".visibleObservedWithinBound");
  if (object.visibleObservedWithinBound && !object.domPresent) {
    throw new Error(label + " cannot be visible when absent from the DOM.");
  }
  return {
    domPresent: object.domPresent,
    visibleObservedWithinBound: object.visibleObservedWithinBound,
  };
}

function validateRender(value: unknown): PassiveRenderProvenance {
  const object = asObject(value, "renderProvenance");
  assertExactKeys(
    object,
    ["readiness", "titlePredicates", "targetPresence", "domPopulation"],
    [],
    "renderProvenance",
  );
  assertEnum(
    object.readiness,
    ["DOMCONTENTLOADED_CONFIRMED", "DOMCONTENTLOADED_NOT_CONFIRMED"],
    "renderProvenance.readiness",
  );
  assertEnum(object.domPopulation, ["EMPTY", "SPARSE", "POPULATED"], "renderProvenance.domPopulation");

  const title = asObject(object.titlePredicates, "renderProvenance.titlePredicates");
  assertExactKeys(title, ["participantPair", "competition"], [], "renderProvenance.titlePredicates");
  assertBoolean(title.participantPair, "renderProvenance.titlePredicates.participantPair");
  assertBoolean(title.competition, "renderProvenance.titlePredicates.competition");

  const targetPresence = asObject(object.targetPresence, "renderProvenance.targetPresence");
  assertExactKeys(
    targetPresence,
    PASSIVE_TARGET_PRESENCE_KEYS,
    [],
    "renderProvenance.targetPresence",
  );
  const validatedPresence = Object.fromEntries(
    PASSIVE_TARGET_PRESENCE_KEYS.map((key) => [
      key,
      validatePresence(targetPresence[key], "renderProvenance.targetPresence." + key),
    ]),
  ) as Record<PassiveTargetPresenceKey, TargetPredicatePresence>;

  return {
    readiness: object.readiness as PassiveReadinessProvenance,
    titlePredicates: {
      participantPair: title.participantPair,
      competition: title.competition,
    },
    targetPresence: validatedPresence,
    domPopulation: object.domPopulation as PassiveDomPopulation,
  };
}

const SIGNAL_KEYS = [
  "participantA",
  "participantB",
  "competition",
  "scheduledDate",
  "scheduledTime",
  "broadCornerContext",
  "totalCornersMarket",
  "fullMatchContext",
  "exactLine",
  "requestedSideAtLine",
  "expectedOdds",
] as const;

function validateSignalEvidence(value: unknown, label: string): void {
  const object = asObject(value, label);
  assertExactKeys(object, ["observed", "snippets"], [], label);
  assertBoolean(object.observed, label + ".observed");
  if (!Array.isArray(object.snippets) || object.snippets.some((item) => typeof item !== "string")) {
    throw new Error(label + ".snippets must be a string array.");
  }
  if (object.snippets.length > 3 || object.snippets.some((item) => item.length > 220)) {
    throw new Error(label + ".snippets exceeds the BOOK-024 retention bound.");
  }
  if (object.observed !== (object.snippets.length > 0)) {
    throw new Error(label + ".observed does not match retained snippets.");
  }
}

function validateEvidence(value: unknown): void {
  const object = asObject(value, "evidence");
  assertExactKeys(
    object,
    [...SIGNAL_KEYS, "displayedOddsCandidates", "dimensionsObserved", "requiredChainObserved"],
    [],
    "evidence",
  );
  for (const key of SIGNAL_KEYS) validateSignalEvidence(object[key], "evidence." + key);

  if (
    !Array.isArray(object.displayedOddsCandidates)
    || object.displayedOddsCandidates.some((item) => typeof item !== "string")
    || object.displayedOddsCandidates.length > 6
  ) {
    throw new Error("evidence.displayedOddsCandidates is invalid.");
  }

  const dimensions = asObject(object.dimensionsObserved, "evidence.dimensionsObserved");
  const dimensionKeys = [
    "event",
    "competition",
    "scheduledTime",
    "totalCornersMarket",
    "fullMatchPeriod",
    "exactLine",
    "requestedSide",
    "displayedOdds",
  ];
  assertExactKeys(dimensions, dimensionKeys, [], "evidence.dimensionsObserved");
  for (const key of dimensionKeys) assertBoolean(dimensions[key], "evidence.dimensionsObserved." + key);
  assertBoolean(object.requiredChainObserved, "evidence.requiredChainObserved");
}

function validateTarget(value: unknown): void {
  const object = asObject(value, "target");
  const keys = [
    "participantA",
    "participantB",
    "competition",
    "scheduledDate",
    "scheduledTime",
    "marketPeriod",
    "marketContext",
    "line",
    "side",
    "expectedOdds",
  ];
  assertExactKeys(object, keys, [], "target");
  for (const key of ["participantA", "participantB", "competition", "scheduledDate", "scheduledTime", "line", "expectedOdds"]) {
    assertString(object[key], "target." + key);
  }
  assertEnum(object.marketPeriod, ["full_match"], "target.marketPeriod");
  assertEnum(object.marketContext, ["total_corners"], "target.marketContext");
  assertEnum(object.side, ["OVER", "UNDER"], "target.side");
}

export function validatePassiveDiagnosticSummary(value: unknown): void {
  const object = asObject(value, "summary");
  assertExactKeys(
    object,
    [
      "diagnosticSchemaVersion",
      "bookmaker",
      "approvedOrigin",
      "navigationKind",
      "requestedPath",
      "finalPath",
      "requestedFragmentPresent",
      "fragmentPreserved",
      "status",
      "target",
      "transportProvenance",
      "authorizesProductionMapping",
      "note",
    ],
    ["blockReason", "renderProvenance", "evidence"],
    "summary",
  );

  assertEnum(object.diagnosticSchemaVersion, [PASSIVE_DIAGNOSTIC_SCHEMA_VERSION], "diagnosticSchemaVersion");
  assertEnum(object.bookmaker, ["sisal", "bet365"], "bookmaker");
  assertString(object.approvedOrigin, "approvedOrigin");
  assertEnum(object.navigationKind, ["BOOKMAKER_DIRECT"], "navigationKind");
  assertString(object.requestedPath, "requestedPath");
  assertString(object.finalPath, "finalPath");
  assertBoolean(object.requestedFragmentPresent, "requestedFragmentPresent");
  assertBoolean(object.fragmentPreserved, "fragmentPreserved");
  assertEnum(object.status, ["COMPLETE", "BLOCKED"], "status");
  assertBoolean(object.authorizesProductionMapping, "authorizesProductionMapping");
  if (object.authorizesProductionMapping !== false) {
    throw new Error("authorizesProductionMapping must remain false.");
  }
  assertString(object.note, "note");
  validateTarget(object.target);

  if (object.blockReason !== undefined) {
    assertEnum(
      object.blockReason,
      [
        "AUTH_REQUIRED",
        "CAPTCHA_OR_ANTIBOT",
        "ACCESS_RESTRICTION",
        "CONSENT_REQUIRED",
        "UNAPPROVED_NAVIGATION",
        "PRIVATE_OR_INTERNAL_DESTINATION",
        "PAGE_CLOSED",
      ],
      "blockReason",
    );
  }

  const transport = validateTransport(object.transportProvenance);

  if (object.status === "COMPLETE") {
    if (object.blockReason !== undefined) {
      throw new Error("COMPLETE summary cannot contain blockReason.");
    }
    if (transport.state !== "CLEAR") {
      throw new Error("COMPLETE summary requires CLEAR transport provenance.");
    }
    if (object.renderProvenance === undefined || object.evidence === undefined) {
      throw new Error("COMPLETE summary requires render provenance and bounded evidence.");
    }
  } else {
    if (object.blockReason === undefined) {
      throw new Error("BLOCKED summary requires blockReason.");
    }
    if (object.renderProvenance !== undefined || object.evidence !== undefined) {
      throw new Error("BLOCKED summary must omit render provenance and target evidence.");
    }
  }

  if (transport.state === "BLOCKED" && object.blockReason !== "PRIVATE_OR_INTERNAL_DESTINATION") {
    throw new Error("Blocked transport provenance requires the compatibility network block reason.");
  }

  if (object.renderProvenance !== undefined) {
    validateRender(object.renderProvenance);
  }

  if (object.evidence !== undefined) {
    validateEvidence(object.evidence);
  }
}
