import type { AutomaticExecutionState } from "../../application/src/index.ts";

export const DESKTOP_IPC_CHANNELS = Object.freeze({
  GET_SNAPSHOT: "notifyhandler:get-snapshot",
  SUBMIT_NOTIFICATION: "notifyhandler:submit-notification",
  RECOVERY_COMMAND: "notifyhandler:recovery-command",
  SNAPSHOT_CHANGED: "notifyhandler:snapshot-changed",
} as const);

export type DesktopRecoveryCommand =
  | { readonly type: "RESUME_AUTH"; readonly legId: string; readonly attemptId: string }
  | { readonly type: "RETRY"; readonly legId: string; readonly attemptId: string }
  | { readonly type: "REOPEN"; readonly legId: string; readonly attemptId: string }
  | { readonly type: "CANCEL"; readonly legId: string; readonly attemptId: string }
  | { readonly type: "RESTART_PLAN"; readonly planId: string };

export interface DesktopLatencyMetrics {
  readonly notificationReceivedAtMs: number | null;
  readonly planReadyAtMs: number | null;
  readonly firstWorkerStartAtMs: number | null;
  readonly notificationToFirstWorkerStartMs: number | null;
}

export interface DesktopSnapshot {
  readonly revision: number;
  readonly execution: AutomaticExecutionState;
  readonly latency: DesktopLatencyMetrics;
}

export type DesktopIpcErrorCode =
  | "UNTRUSTED_RENDERER"
  | "INVALID_INPUT"
  | "MALFORMED_COMMAND"
  | "STALE_COMMAND"
  | "INVALID_STATE"
  | "APPLICATION_ERROR";

export interface DesktopIpcError {
  readonly code: DesktopIpcErrorCode;
  readonly message: string;
}

export type DesktopIpcResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DesktopIpcError };

export interface NotifyHandlerRendererBridge {
  getSnapshot(): Promise<DesktopIpcResult<DesktopSnapshot>>;
  submitNotification(text: string): Promise<DesktopIpcResult<DesktopSnapshot>>;
  resumeAfterManualAuth(legId: string, attemptId: string): Promise<DesktopIpcResult<DesktopSnapshot>>;
  retry(legId: string, attemptId: string): Promise<DesktopIpcResult<DesktopSnapshot>>;
  reopen(legId: string, attemptId: string): Promise<DesktopIpcResult<DesktopSnapshot>>;
  cancel(legId: string, attemptId: string): Promise<DesktopIpcResult<DesktopSnapshot>>;
  restartPlan(planId: string): Promise<DesktopIpcResult<DesktopSnapshot>>;
  onSnapshot(listener: (snapshot: DesktopSnapshot) => void): () => void;
}

export class DesktopIpcValidationError extends Error {
  readonly code: "INVALID_INPUT" | "MALFORMED_COMMAND";

  constructor(code: "INVALID_INPUT" | "MALFORMED_COMMAND", message: string) {
    super(message);
    this.name = "DesktopIpcValidationError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 512) {
    throw new DesktopIpcValidationError("MALFORMED_COMMAND", `${field} must be a non-empty bounded string.`);
  }
  return value;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

export function validateNotificationInput(value: unknown): string {
  if (typeof value !== "string") {
    throw new DesktopIpcValidationError("INVALID_INPUT", "Notification input must be text.");
  }
  if (value.trim().length === 0) {
    throw new DesktopIpcValidationError("INVALID_INPUT", "Notification input cannot be empty.");
  }
  if (value.length > 100_000) {
    throw new DesktopIpcValidationError("INVALID_INPUT", "Notification input exceeds the 100,000-character safety limit.");
  }
  return value;
}

export function parseDesktopRecoveryCommand(value: unknown): DesktopRecoveryCommand {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new DesktopIpcValidationError("MALFORMED_COMMAND", "Recovery command must be a typed object.");
  }

  switch (value.type) {
    case "RESUME_AUTH":
    case "RETRY":
    case "REOPEN":
    case "CANCEL": {
      if (!hasOnlyKeys(value, ["type", "legId", "attemptId"])) {
        throw new DesktopIpcValidationError("MALFORMED_COMMAND", "Recovery command contains unsupported fields.");
      }
      return {
        type: value.type,
        legId: nonEmptyString(value.legId, "legId"),
        attemptId: nonEmptyString(value.attemptId, "attemptId"),
      };
    }
    case "RESTART_PLAN": {
      if (!hasOnlyKeys(value, ["type", "planId"])) {
        throw new DesktopIpcValidationError("MALFORMED_COMMAND", "Restart command contains unsupported fields.");
      }
      return { type: "RESTART_PLAN", planId: nonEmptyString(value.planId, "planId") };
    }
    default:
      throw new DesktopIpcValidationError("MALFORMED_COMMAND", `Unsupported recovery command: ${value.type}`);
  }
}
