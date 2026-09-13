import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../src/index.ts";

async function collectTypescriptFiles(directoryUrl: URL): Promise<URL[]> {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files: URL[] = [];
  for (const entry of entries) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
    if (entry.isDirectory()) files.push(...await collectTypescriptFiles(url));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(url);
  }
  return files;
}

test("production automation public API exposes session capabilities but no raw Playwright object", async () => {
  assert.deepEqual(Object.keys(publicApi).sort(), ["launchBookmakerLegSession"]);
  const indexSource = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  for (const forbidden of ["BrowserContext", "Locator", "Page", "playwright-core", "credential", "stake", "submitBet", "placeBet"]) {
    assert.equal(indexSource.includes(forbidden), false, `public index leaked forbidden capability token: ${forbidden}`);
  }
});

test("application and bookmaker packages do not import Playwright directly", async () => {
  const directories = [
    new URL("../../application/src/", import.meta.url),
    new URL("../../bookmakers/src/", import.meta.url),
  ];
  for (const directory of directories) {
    for (const file of await collectTypescriptFiles(directory)) {
      const source = await readFile(file, "utf8");
      assert.equal(/(?:from\s+|import\s*\()["']playwright(?:-core)?["']/.test(source), false, file.pathname);
    }
  }
});
