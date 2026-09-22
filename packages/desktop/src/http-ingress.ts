import { spawnSync } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname } from "node:path";
import {
  normalizeDirectPairNotification,
  type StructuredDirectPairCanonical,
  type StructuredDirectPairNormalizationResult,
} from "../../application/src/index.ts";
import type { DesktopAppController } from "./controller.ts";

export const DIRECT_PAIR_INGRESS_PATH = "/api/v1/notifications/direct-pair";
export const DEFAULT_DIRECT_PAIR_INGRESS_PORT = 43119;
export const MAX_DIRECT_PAIR_BODY_BYTES = 64 * 1024;
export const DEFAULT_IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60_000;

const MIN_IDEMPOTENCY_RETENTION_MS = 5 * 60_000;
const MAX_IDEMPOTENCY_RETENTION_MS = 30 * 24 * 60 * 60_000;
const MAX_IDEMPOTENCY_RECORDS = 2048;
const MAX_IDEMPOTENCY_STATE_BYTES = 512 * 1024;
const IDEMPOTENCY_STATE_VERSION = 1 as const;

export interface DirectPairIngressOptions {
  readonly controller: Pick<DesktopAppController, "receiveStructuredPlan">;
  readonly token: string;
  readonly idempotencyFilePath: string;
  readonly port?: number;
  readonly now?: () => Date;
  readonly maxBodyBytes?: number;
  readonly maxRequestsPerMinute?: number;
  readonly maxConcurrentRequests?: number;
  readonly idempotencyRetentionMs?: number;
}

export interface DirectPairIngressServer {
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly endpoint: string;
  close(): Promise<void>;
}

type IdempotencyRecordState = "pending" | "accepted";

interface IdempotencyRecord {
  readonly payloadHash: string;
  readonly executionId: string;
  readonly recordedAtMs: number;
  readonly state: IdempotencyRecordState;
  readonly recovered: boolean;
}

interface PersistedIdempotencyRecord {
  readonly notificationId: string;
  readonly payloadHash: string;
  readonly executionId: string;
  readonly recordedAtMs: number;
  readonly state: IdempotencyRecordState;
}

interface PendingRecord {
  readonly payloadHash: string;
  readonly result: Promise<AcceptanceResult>;
}

type AcceptanceResult =
  | { readonly accepted: true; readonly executionId: string }
  | { readonly accepted: false; readonly status: number; readonly code: string; readonly message: string };

type BodyResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly tooLarge: boolean };

function json(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  const serialized = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(serialized);
}

function constantTimeTokenMatch(expected: string, supplied: string): boolean {
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  const suppliedDigest = createHash("sha256").update(supplied, "utf8").digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

function bearerToken(request: IncomingMessage): string | null {
  const value = request.headers.authorization;
  if (typeof value !== "string") return null;
  const match = value.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/u);
  return match?.[1] ?? null;
}

function isJsonContentType(value: string | string[] | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.toLocaleLowerCase("en-US").replace(/\s+/gu, "");
  return normalized === "application/json"
    || normalized === "application/json;charset=utf-8";
}

function isLoopbackPeer(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function readBoundedBody(request: IncomingMessage, maxBytes: number): Promise<BodyResult> {
  const declared = request.headers["content-length"];
  if (typeof declared === "string") {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
      request.resume();
      return Promise.resolve({ ok: false, tooLarge: true });
    }
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let size = 0;
    const chunks: Buffer[] = [];

    const finish = (result: BodyResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    request.on("data", (chunk: Buffer | string) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;
      if (size > maxBytes) {
        chunks.length = 0;
        finish({ ok: false, tooLarge: true });
        request.resume();
        return;
      }
      chunks.push(buffer);
    });
    request.on("end", () => {
      if (!settled) finish({ ok: true, text: Buffer.concat(chunks).toString("utf8") });
    });
    request.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

function normalizedPayloadHash(payload: StructuredDirectPairCanonical): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function responseValidationErrors(result: Extract<StructuredDirectPairNormalizationResult, { ok: false }>) {
  return result.errors.map((item) => ({
    code: item.code,
    field: item.field,
    message: item.message,
  }));
}

function isValidLocalToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/u.test(token);
}

function loadExistingToken(filePath: string): string | null {
  try {
    const token = readFileSync(filePath, "utf8").trim();
    return isValidLocalToken(token) ? token : null;
  } catch {
    return null;
  }
}

function currentWindowsUserSid(): string {
  const result = spawnSync("whoami", ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error("Could not determine the current Windows user SID for ingress-token ACL hardening.");
  }
  const sid = result.stdout.match(/S-\d-(?:\d+-)+\d+/u)?.[0];
  if (sid === undefined) throw new Error("Windows user SID was not present in whoami output.");
  return sid;
}

/**
 * Applies user-only permissions to the local ingress capability.
 *
 * POSIX uses mode 0600. Windows resets explicit ACLs, removes inheritance, and
 * grants full access only to the current user SID. Failure is fatal so a packaged Windows build
 * never silently falls back to a broadly readable bearer-token file.
 */
export function hardenLocalIngressTokenPermissions(filePath: string): void {
  if (process.platform !== "win32") {
    chmodSync(filePath, 0o600);
    return;
  }

  const sid = currentWindowsUserSid();

  const runIcacls = (stage: string, args: readonly string[]): void => {
    const result = spawnSync(
      "icacls",
      [filePath, ...args],
      { encoding: "utf8", windowsHide: true, shell: false },
    );
    if (result.error !== undefined || result.status !== 0) {
      throw new Error(`Could not establish and verify a current-user-only Windows ACL for the local ingress token (stage ${stage}).`);
    }
  };

  // Reset removes every pre-existing explicit ACE (including a malicious
  // Everyone grant), then inheritance is removed before the single current-user
  // rule is installed. /verify checks the resulting ACL is structurally valid.
  runIcacls("RESET_DACL", ["/reset"]);
  runIcacls("REMOVE_INHERITANCE", ["/inheritance:r"]);
  runIcacls("GRANT_CURRENT_USER", ["/grant:r", `*${sid}:F`]);
  runIcacls("VERIFY_DACL", ["/verify"]);
}

function generateLocalIngressToken(): string {
  return randomBytes(32).toString("base64url");
}

function writeLocalIngressToken(filePath: string, token: string, flag: "w" | "wx"): void {
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  writeFileSync(filePath, token + "\n", { encoding: "utf8", flag, mode: 0o600 });
  hardenLocalIngressTokenPermissions(filePath);
}

/**
 * Creates or loads a 256-bit local ingress capability. The token is never
 * exposed through renderer IPC. Its file is hardened to the current OS user.
 */
export function loadOrCreateLocalIngressToken(filePath: string): string {
  const existing = loadExistingToken(filePath);
  if (existing !== null) {
    hardenLocalIngressTokenPermissions(filePath);
    return existing;
  }

  const token = generateLocalIngressToken();
  try {
    writeLocalIngressToken(filePath, token, "wx");
    return token;
  } catch (error) {
    const raced = loadExistingToken(filePath);
    if (raced !== null) {
      hardenLocalIngressTokenPermissions(filePath);
      return raced;
    }
    throw error;
  }
}

/**
 * Replaces the local ingress capability without changing the HTTP protocol.
 * Callers must restart/reconfigure the local sender with the new file value.
 */
export function rotateLocalIngressToken(filePath: string): string {
  const token = generateLocalIngressToken();
  writeLocalIngressToken(filePath, token, "w");
  return token;
}


function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyObjectKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function isValidNotificationId(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 128
    && /^[A-Za-z0-9._:-]+$/u.test(value);
}

function isValidPayloadHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isValidExecutionId(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 512
    && /^[\x20-\x7e]+$/u.test(value);
}

function serializeIdempotencyState(records: ReadonlyMap<string, IdempotencyRecord>): string {
  if (records.size > MAX_IDEMPOTENCY_RECORDS) {
    throw new Error("Local ingress idempotency state exceeded the bounded record limit.");
  }

  const persisted: PersistedIdempotencyRecord[] = [...records.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([notificationId, record]) => ({
      notificationId,
      payloadHash: record.payloadHash,
      executionId: record.executionId,
      recordedAtMs: record.recordedAtMs,
      state: record.state,
    }));
  const serialized = JSON.stringify({
    version: IDEMPOTENCY_STATE_VERSION,
    records: persisted,
  }) + "\n";
  if (Buffer.byteLength(serialized, "utf8") > MAX_IDEMPOTENCY_STATE_BYTES) {
    throw new Error("Local ingress idempotency state exceeded the bounded file-size limit.");
  }
  return serialized;
}

function persistIdempotencyState(
  filePath: string,
  records: ReadonlyMap<string, IdempotencyRecord>,
): void {
  const serialized = serializeIdempotencyState(records);
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  const fd = openSync(filePath, "w", 0o600);
  try {
    writeFileSync(fd, serialized, { encoding: "utf8" });
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  hardenLocalIngressTokenPermissions(filePath);
}

function loadIdempotencyState(
  filePath: string,
  nowMs: number,
  retentionMs: number,
): Map<string, IdempotencyRecord> {
  let raw: string;
  try {
    const size = statSync(filePath).size;
    if (size > MAX_IDEMPOTENCY_STATE_BYTES) {
      throw new Error("Local ingress idempotency state file is oversized.");
    }
    hardenLocalIngressTokenPermissions(filePath);
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as { readonly code?: unknown }).code === "ENOENT") return new Map();
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Local ingress idempotency state is corrupt JSON.");
  }
  if (
    !isPlainObject(parsed)
    || !hasOnlyObjectKeys(parsed, ["version", "records"])
    || parsed.version !== IDEMPOTENCY_STATE_VERSION
    || !Array.isArray(parsed.records)
    || parsed.records.length > MAX_IDEMPOTENCY_RECORDS
  ) {
    throw new Error("Local ingress idempotency state has an invalid schema.");
  }

  const records = new Map<string, IdempotencyRecord>();
  let evicted = false;
  for (const value of parsed.records) {
    if (
      !isPlainObject(value)
      || !hasOnlyObjectKeys(value, ["notificationId", "payloadHash", "executionId", "recordedAtMs", "state"])
      || !isValidNotificationId(value.notificationId)
      || !isValidPayloadHash(value.payloadHash)
      || !isValidExecutionId(value.executionId)
      || !Number.isSafeInteger(value.recordedAtMs)
      || (value.recordedAtMs as number) < 0
      || (value.recordedAtMs as number) > nowMs + 60_000
      || (value.state !== "pending" && value.state !== "accepted")
      || records.has(value.notificationId)
    ) {
      throw new Error("Local ingress idempotency state contains an invalid record.");
    }

    const recordedAtMs = value.recordedAtMs as number;
    if (recordedAtMs <= nowMs - retentionMs) {
      evicted = true;
      continue;
    }
    records.set(value.notificationId, {
      payloadHash: value.payloadHash,
      executionId: value.executionId,
      recordedAtMs,
      state: value.state,
      recovered: true,
    });
  }

  if (evicted) persistIdempotencyState(filePath, records);
  return records;
}

export async function startDirectPairIngressServer(
  options: DirectPairIngressOptions,
): Promise<DirectPairIngressServer> {
  if (typeof options.token !== "string" || options.token.length < 43 || options.token.length > 256) {
    throw new Error("Loopback ingress token must be a bounded capability generated from at least 256 bits.");
  }

  const host = "127.0.0.1" as const;
  const requestedPort = options.port ?? DEFAULT_DIRECT_PAIR_INGRESS_PORT;
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error("Loopback ingress port must be an integer between 0 and 65535.");
  }

  const maxBodyBytes = options.maxBodyBytes ?? MAX_DIRECT_PAIR_BODY_BYTES;
  const maxRequestsPerMinute = options.maxRequestsPerMinute ?? 30;
  const maxConcurrentRequests = options.maxConcurrentRequests ?? 4;
  const retentionMs = options.idempotencyRetentionMs ?? DEFAULT_IDEMPOTENCY_RETENTION_MS;
  if (
    !Number.isSafeInteger(retentionMs)
    || retentionMs < MIN_IDEMPOTENCY_RETENTION_MS
    || retentionMs > MAX_IDEMPOTENCY_RETENTION_MS
  ) {
    throw new Error("Loopback ingress idempotency retention must be between 5 minutes and 30 days.");
  }
  if (typeof options.idempotencyFilePath !== "string" || options.idempotencyFilePath.trim().length === 0) {
    throw new Error("Loopback ingress requires a durable idempotency state file path.");
  }
  const now = options.now ?? (() => new Date());
  const records = loadIdempotencyState(options.idempotencyFilePath, now().getTime(), retentionMs);
  const pending = new Map<string, PendingRecord>();
  let recentRequests: number[] = [];
  let activeRequests = 0;
  let authority = "";

  function evict(nowMs: number): void {
    recentRequests = recentRequests.filter((timestamp) => timestamp > nowMs - 60_000);
    let changed = false;
    for (const [key, record] of records) {
      if (record.recordedAtMs <= nowMs - retentionMs) {
        records.delete(key);
        changed = true;
      }
    }
    if (changed) persistIdempotencyState(options.idempotencyFilePath, records);
  }

  async function acceptNew(
    normalized: Extract<StructuredDirectPairNormalizationResult, { ok: true }>["value"],
  ): Promise<AcceptanceResult> {
    try {
      const snapshot = await options.controller.receiveStructuredPlan(normalized.plan);
      if (snapshot.execution.status === "PREFLIGHT_FAILED") {
        return {
          accepted: false,
          status: 422,
          code: snapshot.execution.preflightFailure?.code ?? "PREFLIGHT_FAILED",
          message: "Structured notification failed execution preflight.",
        };
      }
      if (snapshot.execution.plan === null || snapshot.execution.legs === null) {
        return {
          accepted: false,
          status: 503,
          code: "EXECUTION_NOT_CREATED",
          message: "Application did not create a runnable execution.",
        };
      }
      return { accepted: true, executionId: snapshot.execution.plan.id };
    } catch {
      return {
        accepted: false,
        status: 503,
        code: "APPLICATION_UNAVAILABLE",
        message: "Application could not create the execution.",
      };
    }
  }

  const server = createServer(async (request, response) => {
    try {
      if (!isLoopbackPeer(request.socket.remoteAddress)) {
        request.resume();
        json(response, 403, { accepted: false, error: { code: "NETWORK_POLICY", message: "Loopback ingress accepts local peers only." } });
        return;
      }
      if (request.headers.host !== authority) {
        request.resume();
        json(response, 403, { accepted: false, error: { code: "HOST_POLICY", message: "Host header does not match the configured loopback authority." } });
        return;
      }
      if (request.headers.origin !== undefined) {
        request.resume();
        json(response, 403, { accepted: false, error: { code: "ORIGIN_POLICY", message: "Browser-origin requests are not accepted." } });
        return;
      }
      if (request.url !== DIRECT_PAIR_INGRESS_PATH) {
        request.resume();
        json(response, 404, { accepted: false, error: { code: "NOT_FOUND", message: "Endpoint not found." } });
        return;
      }
      if (request.method !== "POST") {
        request.resume();
        response.setHeader("Allow", "POST");
        json(response, 405, { accepted: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is accepted." } });
        return;
      }
      if (!isJsonContentType(request.headers["content-type"])) {
        request.resume();
        json(response, 415, { accepted: false, error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json UTF-8." } });
        return;
      }

      const suppliedToken = bearerToken(request);
      if (suppliedToken === null || !constantTimeTokenMatch(options.token, suppliedToken)) {
        request.resume();
        json(response, 401, { accepted: false, error: { code: "UNAUTHORIZED", message: "Missing or invalid local ingress capability." } });
        return;
      }

      const nowMs = now().getTime();
      evict(nowMs);
      if (recentRequests.length >= maxRequestsPerMinute || activeRequests >= maxConcurrentRequests) {
        request.resume();
        json(response, 429, { accepted: false, error: { code: "RATE_LIMITED", message: "Local ingress request limit exceeded." } });
        return;
      }
      recentRequests.push(nowMs);
      activeRequests += 1;

      try {
        const body = await readBoundedBody(request, maxBodyBytes);
        if (!body.ok) {
          json(response, 413, { accepted: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the 64 KiB protocol ceiling." } });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(body.text);
        } catch {
          json(response, 400, { accepted: false, error: { code: "MALFORMED_JSON", message: "Request body is not valid JSON." } });
          return;
        }

        const normalized = normalizeDirectPairNotification(parsed, { now });
        if (!normalized.ok) {
          json(response, 422, {
            accepted: false,
            error: {
              code: "INVALID_NOTIFICATION",
              message: "Structured notification violates the declared direct-pair contract.",
              issues: responseValidationErrors(normalized),
            },
          });
          return;
        }

        const key = normalized.value.canonical.notificationId;
        const hash = normalizedPayloadHash(normalized.value.canonical);
        const prior = records.get(key);
        if (prior !== undefined) {
          if (prior.payloadHash !== hash) {
            json(response, 409, { accepted: false, error: { code: "IDEMPOTENCY_CONFLICT", message: "notificationId was already reserved for a different normalized payload." } });
            return;
          }

          if (prior.recovered) {
            json(response, 409, {
              accepted: false,
              error: {
                code: "IDEMPOTENCY_REPLAY_BLOCKED",
                message: "notificationId was recorded by an earlier NotifyHandler process; automatic replay is blocked.",
              },
            });
            return;
          }

          if (prior.state === "accepted") {
            json(response, 202, {
              accepted: true,
              duplicate: true,
              notificationId: key,
              executionId: prior.executionId,
            });
            return;
          }

          const inFlight = pending.get(key);
          if (inFlight === undefined) {
            json(response, 409, {
              accepted: false,
              error: {
                code: "IDEMPOTENCY_UNCERTAIN",
                message: "notificationId has an unresolved execution reservation; automatic replay is blocked.",
              },
            });
            return;
          }
          const result = await inFlight.result;
          if (!result.accepted) {
            json(response, result.status, { accepted: false, error: { code: result.code, message: result.message } });
            return;
          }
          json(response, 202, {
            accepted: true,
            duplicate: true,
            notificationId: key,
            executionId: result.executionId,
          });
          return;
        }

        if (records.size >= MAX_IDEMPOTENCY_RECORDS) {
          json(response, 503, {
            accepted: false,
            error: {
              code: "IDEMPOTENCY_CAPACITY",
              message: "Durable idempotency capacity is exhausted until retained records expire.",
            },
          });
          return;
        }

        const reserved: IdempotencyRecord = {
          payloadHash: hash,
          executionId: normalized.value.plan.id,
          recordedAtMs: nowMs,
          state: "pending",
          recovered: false,
        };
        records.set(key, reserved);
        try {
          persistIdempotencyState(options.idempotencyFilePath, records);
        } catch (error) {
          records.delete(key);
          throw error;
        }

        const acceptance = (async (): Promise<AcceptanceResult> => {
          const result = await acceptNew(normalized.value);
          if (result.accepted) {
            if (result.executionId !== reserved.executionId) {
              return {
                accepted: false,
                status: 503,
                code: "EXECUTION_ID_MISMATCH",
                message: "Application execution identity did not match the durable reservation.",
              };
            }
            const acceptedRecord: IdempotencyRecord = {
              ...reserved,
              state: "accepted",
            };
            records.set(key, acceptedRecord);
            try {
              persistIdempotencyState(options.idempotencyFilePath, records);
            } catch (error) {
              records.set(key, reserved);
              throw error;
            }
            return result;
          }

          if (result.status === 422) {
            records.delete(key);
            try {
              persistIdempotencyState(options.idempotencyFilePath, records);
            } catch (error) {
              records.set(key, reserved);
              throw error;
            }
          }
          return result;
        })();

        pending.set(key, { payloadHash: hash, result: acceptance });
        try {
          const result = await acceptance;
          if (!result.accepted) {
            json(response, result.status, { accepted: false, error: { code: result.code, message: result.message } });
            return;
          }

          json(response, 202, {
            accepted: true,
            duplicate: false,
            notificationId: key,
            executionId: result.executionId,
          });
        } finally {
          pending.delete(key);
        }
      } finally {
        activeRequests -= 1;
      }
    } catch {
      if (!response.headersSent) {
        json(response, 503, { accepted: false, error: { code: "INGRESS_FAILURE", message: "Local ingress could not process the request." } });
      } else {
        response.end();
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(requestedPort, host);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Loopback ingress failed to obtain a TCP authority.");
  }
  authority = host + ":" + address.port;

  return {
    host,
    port: address.port,
    endpoint: "http://" + authority + DIRECT_PAIR_INGRESS_PATH,
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}
