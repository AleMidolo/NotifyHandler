import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { BookmakerAutomationPort, ExecutionPreflightPort } from "../../application/src/index.ts";
import { createBookmakerAutomationWorker, createWorkerExecutionPreflight } from "../../automation/src/index.ts";
import { composeLocalNotifyHandlerRuntime } from "../src/index.ts";

test("concrete automation worker is structurally compatible with application ports", async () => {
  const worker = createBookmakerAutomationWorker({ headless: true });
  const automation: BookmakerAutomationPort = worker;
  const preflight: ExecutionPreflightPort = createWorkerExecutionPreflight();
  assert.equal(typeof automation.start, "function");
  assert.equal(typeof automation.resumeAfterManualAuth, "function");
  assert.equal(typeof automation.continueWithObservedOdds, "function");
  assert.equal(typeof automation.retry, "function");
  assert.equal(typeof automation.reopen, "function");
  assert.equal(typeof automation.cancel, "function");
  assert.equal(typeof preflight.validate, "function");
  await worker.closeAll();
});

test("desktop composition exposes orchestration and cleanup without transaction capabilities", async () => {
  const worker = createBookmakerAutomationWorker({ headless: true });
  const runtime = composeLocalNotifyHandlerRuntime(worker, createWorkerExecutionPreflight(), { now: () => new Date("2026-09-13T09:40:00.000Z") });
  try {
    assert.equal(typeof runtime.orchestrator.receiveNotification, "function");
    assert.equal(typeof runtime.close, "function");
    const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(worker)).filter((name) => name !== "constructor");
    for (const method of publicMethods) {
      assert.doesNotMatch(method, /(credential|password|mfa|otp|captcha|stake|placebet|submitbet|confirmbet|finalizebet|deposit|withdraw|cashout)/iu);
    }
  } finally {
    await runtime.close();
  }
});

test("application source remains free of automation, Playwright, and bookmaker imports", () => {
  const source = readFileSync(new URL("../../application/src/orchestrator.ts", import.meta.url), "utf8").toLocaleLowerCase("en-US");
  assert.equal(source.includes("playwright"), false);
  assert.equal(source.includes("../../automation"), false);
  assert.equal(source.includes("../../bookmakers"), false);
});
