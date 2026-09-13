import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AutomaticExecutionOrchestrator } from "../src/orchestrator.ts";

test("production orchestrator exposes no manual start, pair selection, credential, stake, or wager-submission capability", () => {
  const publicMethods = Object.getOwnPropertyNames(AutomaticExecutionOrchestrator.prototype)
    .filter((name) => name !== "constructor");

  assert.equal(publicMethods.includes("start"), false);
  assert.equal(publicMethods.includes("selectRecommendedOption"), false);

  for (const method of publicMethods) {
    assert.doesNotMatch(
      method,
      /(credential|password|mfa|otp|captcha|stake|placebet|submitbet|confirmbet|finalizebet|deposit|withdraw|cashout|playwright|click)/iu,
    );
  }

  const source = readFileSync(new URL("../src/orchestrator.ts", import.meta.url), "utf8").toLocaleLowerCase("en-US");
  assert.equal(source.includes("from \"playwright"), false);
  assert.equal(source.includes("from \"../../bookmakers"), false);

  for (const forbidden of [
    "entercredentials",
    "setcredentials",
    "submitotp",
    "handlemfa",
    "solvecaptcha",
    "setstake",
    "enterstake",
    "placebet",
    "submitbet",
    "confirmbet",
    "finalizebet",
    "deposit",
    "withdraw",
    "cashout",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden production capability: ${forbidden}`);
  }
});
