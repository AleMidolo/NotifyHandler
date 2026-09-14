import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("SISAL public probe is read-only and does not acquire transaction/auth capabilities", async () => {
  const source = await readFile(
    new URL("../src/live-validation/sisal-public-probe.ts", import.meta.url),
    "utf8",
  );

  for (const forbidden of [
    ".click(",
    ".fill(",
    ".type(",
    ".check(",
    ".selectOption(",
    ".setInputFiles(",
    ".cookies(",
    "storageState",
    "screenshot",
    "tracing",
    "stake",
    "placeBet",
    "submitBet",
    "confirmBet",
    "captcha",
    "otp",
    "mfa",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, `live probe contains forbidden capability token: ${forbidden}`);
  }

  assert.match(source, /const SISAL_ORIGIN = "https:\/\/www\.sisal\.it"/);
  assert.match(source, /parsed\.origin !== SISAL_ORIGIN/);
  assert.match(source, /parsed\.username !== ""/);
  assert.match(source, /parsed\.password !== ""/);
  assert.match(source, /acceptDownloads: false/);
  assert.match(source, /serviceWorkers: "block"/);
});
