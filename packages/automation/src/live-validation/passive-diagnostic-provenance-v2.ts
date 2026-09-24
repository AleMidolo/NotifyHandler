import type { BookmakerWssFailureCode } from "../bookmaker-network-policy.ts";
import {
  validatePassiveDiagnosticSummary,
  type PassiveTransportProvenance,
} from "./passive-diagnostic-provenance.ts";

export const PASSIVE_DIAGNOSTIC_SCHEMA_VERSION_V2 = "passive-provenance.v2" as const;

export type PassiveTransportProvenanceV2 =
  | Readonly<{
      state: "CLEAR";
      websocket: "NONE_OBSERVED" | "ALLOWED_REVIEWED_WSS_OBSERVED";
    }>
  | Readonly<{
      state: "BLOCKED";
      trigger: "PUBLIC_HTTPS_TARGET_REJECTED" | "DISALLOWED_PROTOCOL";
      scope: "TOP_LEVEL" | "SUBRESOURCE";
    }>
  | Readonly<{
      state: "BLOCKED";
      trigger:
        | "INSECURE_WEBSOCKET"
        | "UNAPPROVED_WEBSOCKET"
        | "WEBSOCKET_PUBLIC_TARGET_REJECTED";
      scope: "SOCKET";
    }>;

export function initialTransportProvenanceV2(): PassiveTransportProvenanceV2 {
  return { state: "CLEAR", websocket: "NONE_OBSERVED" };
}

export function allowedReviewedWebSocketObserved(
  current: PassiveTransportProvenanceV2,
): PassiveTransportProvenanceV2 {
  if (current.state === "BLOCKED") return current;
  return { state: "CLEAR", websocket: "ALLOWED_REVIEWED_WSS_OBSERVED" };
}

export function blockedWebSocketTransportProvenanceV2(
  code: BookmakerWssFailureCode,
): PassiveTransportProvenanceV2 {
  switch (code) {
    case "BOOKMAKER_WSS_INSECURE":
      return { state: "BLOCKED", trigger: "INSECURE_WEBSOCKET", scope: "SOCKET" };
    case "BOOKMAKER_WSS_UNAPPROVED":
      return { state: "BLOCKED", trigger: "UNAPPROVED_WEBSOCKET", scope: "SOCKET" };
    case "BOOKMAKER_WSS_NETWORK_TARGET_BLOCKED":
      return {
        state: "BLOCKED",
        trigger: "WEBSOCKET_PUBLIC_TARGET_REJECTED",
        scope: "SOCKET",
      };
  }
}

export function ordinaryTransportProvenanceV2(
  protocol: string,
  isTopLevel: boolean,
  publicHttpsTarget: boolean | undefined,
): PassiveTransportProvenanceV2 {
  const scope = isTopLevel ? "TOP_LEVEL" : "SUBRESOURCE";
  if (protocol === "https:") {
    return publicHttpsTarget === true
      ? initialTransportProvenanceV2()
      : { state: "BLOCKED", trigger: "PUBLIC_HTTPS_TARGET_REJECTED", scope };
  }
  if (["data:", "blob:", "about:"].includes(protocol)) {
    return initialTransportProvenanceV2();
  }
  return { state: "BLOCKED", trigger: "DISALLOWED_PROTOCOL", scope };
}

export function retainTransportProvenanceV2(
  current: PassiveTransportProvenanceV2,
  candidate: PassiveTransportProvenanceV2,
): PassiveTransportProvenanceV2 {
  if (current.state === "BLOCKED") return current;
  if (candidate.state === "BLOCKED") return candidate;
  if (
    current.websocket === "ALLOWED_REVIEWED_WSS_OBSERVED"
    || candidate.websocket === "ALLOWED_REVIEWED_WSS_OBSERVED"
  ) {
    return { state: "CLEAR", websocket: "ALLOWED_REVIEWED_WSS_OBSERVED" };
  }
  return initialTransportProvenanceV2();
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
  label: string,
): void {
  const allowed = new Set(required);
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) throw new Error(label + " contains unknown field: " + key);
  }
  for (const key of required) {
    if (!(key in object)) throw new Error(label + " is missing field: " + key);
  }
}

function assertEnum(value: unknown, allowed: readonly string[], label: string): string {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(label + " has an unknown enum value.");
  }
  return value;
}

export function validateTransportProvenanceV2(
  value: unknown,
): PassiveTransportProvenanceV2 {
  const object = asObject(value, "transportProvenance");
  const state = assertEnum(object.state, ["CLEAR", "BLOCKED"], "transportProvenance.state");
  if (state === "CLEAR") {
    assertExactKeys(object, ["state", "websocket"], "transportProvenance");
    const websocket = assertEnum(
      object.websocket,
      ["NONE_OBSERVED", "ALLOWED_REVIEWED_WSS_OBSERVED"],
      "transportProvenance.websocket",
    );
    return {
      state: "CLEAR",
      websocket: websocket as "NONE_OBSERVED" | "ALLOWED_REVIEWED_WSS_OBSERVED",
    };
  }

  assertExactKeys(object, ["state", "trigger", "scope"], "transportProvenance");
  const trigger = assertEnum(
    object.trigger,
    [
      "PUBLIC_HTTPS_TARGET_REJECTED",
      "DISALLOWED_PROTOCOL",
      "INSECURE_WEBSOCKET",
      "UNAPPROVED_WEBSOCKET",
      "WEBSOCKET_PUBLIC_TARGET_REJECTED",
    ],
    "transportProvenance.trigger",
  );
  if (
    trigger === "INSECURE_WEBSOCKET"
    || trigger === "UNAPPROVED_WEBSOCKET"
    || trigger === "WEBSOCKET_PUBLIC_TARGET_REJECTED"
  ) {
    assertEnum(object.scope, ["SOCKET"], "transportProvenance.scope");
    return {
      state: "BLOCKED",
      trigger,
      scope: "SOCKET",
    } as PassiveTransportProvenanceV2;
  }

  const scope = assertEnum(
    object.scope,
    ["TOP_LEVEL", "SUBRESOURCE"],
    "transportProvenance.scope",
  );
  return {
    state: "BLOCKED",
    trigger: trigger as "PUBLIC_HTTPS_TARGET_REJECTED" | "DISALLOWED_PROTOCOL",
    scope: scope as "TOP_LEVEL" | "SUBRESOURCE",
  };
}

function v1TransportCompatibility(
  transport: PassiveTransportProvenanceV2,
): PassiveTransportProvenance {
  if (transport.state === "CLEAR") return { state: "CLEAR" };
  if (transport.scope === "SOCKET") {
    return { state: "BLOCKED", trigger: "WEBSOCKET_ATTEMPT", scope: "SOCKET" };
  }
  return transport;
}

export function validatePassiveDiagnosticSummaryV2(value: unknown): void {
  const object = asObject(value, "summary");
  if (object.diagnosticSchemaVersion !== PASSIVE_DIAGNOSTIC_SCHEMA_VERSION_V2) {
    throw new Error("diagnosticSchemaVersion has an unknown enum value.");
  }
  const transport = validateTransportProvenanceV2(object.transportProvenance);

  const v1Compatible = {
    ...object,
    diagnosticSchemaVersion: "passive-provenance.v1",
    transportProvenance: v1TransportCompatibility(transport),
  };

  validatePassiveDiagnosticSummary(v1Compatible);
}
