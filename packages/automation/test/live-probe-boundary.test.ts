import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { runBet365PublicProbe } from "../src/live-validation/bet365-public-probe.ts";
import { runLottomaticaPublicProbe } from "../src/live-validation/lottomatica-public-probe.ts";
import { runSisalPublicProbe } from "../src/live-validation/sisal-public-probe.ts";

const FORBIDDEN_TOKENS = [
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
] as const;

async function assertReadOnlyProbeSource(path: string, originConstPattern: RegExp, originName: string): Promise<void> {
  const source = await readFile(new URL(path, import.meta.url), "utf8");

  for (const forbidden of FORBIDDEN_TOKENS) {
    assert.equal(
      source.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `${originName} live probe contains forbidden capability token: ${forbidden}`,
    );
  }

  assert.match(source, originConstPattern);
  assert.match(source, /parsed\.username !== ""/);
  assert.match(source, /parsed\.password !== ""/);
  assert.match(source, /acceptDownloads: false/);
  assert.match(source, /serviceWorkers: "block"/);
}

test("SISAL public probe is read-only and does not acquire transaction/auth capabilities", async () => {
  await assertReadOnlyProbeSource(
    "../src/live-validation/sisal-public-probe.ts",
    /const SISAL_ORIGIN = "https:\/\/www\.sisal\.it"/,
    "SISAL",
  );
});

test("SISAL public probe rejects unsafe targets before attempting browser collection", async () => {
  for (const url of [
    "http://www.sisal.it/scommesse-matchpoint/sport/calcio",
    "https://user@www.sisal.it/scommesse-matchpoint/sport/calcio",
    "https://user:secret@www.sisal.it/scommesse-matchpoint/sport/calcio",
    "https://sisal.it/scommesse-matchpoint/sport/calcio",
    "https://example.com/scommesse-matchpoint/sport/calcio",
  ]) {
    await assert.rejects(
      runSisalPublicProbe({ url, headless: true }),
      /only accepts credential-free HTTPS URLs on https:\/\/www\.sisal\.it/,
      `expected unsafe live probe target to be rejected: ${url}`,
    );
  }
});

test("BET365 public probe is read-only and cannot authorize production mapping by itself", async () => {
  await assertReadOnlyProbeSource(
    "../src/live-validation/bet365-public-probe.ts",
    /const BET365_ORIGIN = "https:\/\/www\.bet365\.it"/,
    "BET365",
  );

  const source = await readFile(
    new URL("../src/live-validation/bet365-public-probe.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /mappingEvidenceSufficient: false/);
});

test("BET365 public probe rejects unsafe targets before attempting browser collection", async () => {
  for (const url of [
    "http://www.bet365.it/hub/it-it/football",
    "https://user@www.bet365.it/hub/it-it/football",
    "https://user:secret@www.bet365.it/hub/it-it/football",
    "https://bet365.it/hub/it-it/football",
    "https://example.com/hub/it-it/football",
  ]) {
    await assert.rejects(
      runBet365PublicProbe({ url, headless: true }),
      /only accepts credential-free HTTPS URLs on https:\/\/www\.bet365\.it/,
      `expected unsafe live probe target to be rejected: ${url}`,
    );
  }
});

test("LOTTOMATICA public probe is read-only and cannot authorize production mapping by itself", async () => {
  await assertReadOnlyProbeSource(
    "../src/live-validation/lottomatica-public-probe.ts",
    /const LOTTOMATICA_ORIGIN = "https:\/\/www\.lottomatica\.it"/,
    "LOTTOMATICA",
  );

  const source = await readFile(
    new URL("../src/live-validation/lottomatica-public-probe.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /mappingEvidenceSufficient: false/);
  assert.match(source, /process\.exitCode = 2/);
});

test("LOTTOMATICA public probe rejects unsafe targets before attempting browser collection", async () => {
  for (const url of [
    "http://www.lottomatica.it/scommesse",
    "https://user@www.lottomatica.it/scommesse",
    "https://user:secret@www.lottomatica.it/scommesse",
    "https://lottomatica.it/scommesse",
    "https://example.com/scommesse",
  ]) {
    await assert.rejects(
      runLottomaticaPublicProbe({ url, headless: true }),
      /only accepts credential-free HTTPS URLs on https:\/\/www\.lottomatica\.it/,
      `expected unsafe live probe target to be rejected: ${url}`,
    );
  }
});
