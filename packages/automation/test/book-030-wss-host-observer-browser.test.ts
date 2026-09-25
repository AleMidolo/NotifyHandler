import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright-core";

import {
  BOOK_030_SOURCE_TARGET,
  BOOK_030_WSS_HOST_OBSERVATION_SCHEMA,
  createBook030FirstSocketObserver,
} from "../src/live-validation/book-030-wss-host-observer.ts";

async function waitForObservation(
  observer: ReturnType<typeof createBook030FirstSocketObserver>,
): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (observer.firstAttemptObserved()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("fixture WebSocket was not intercepted");
}

test("pinned Chromium routeWebSocket retains only the first sanitized hostname and never opens it", async () => {
  const observer = createBook030FirstSocketObserver(async () => ["93.184.216.34"]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
  });

  try {
    await context.routeWebSocket("**/*", async (socket) => {
      await observer.handle(socket);
    });

    const page = await context.newPage();
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          <script>
            const first = new WebSocket("wss://first.bet365.test/feed?opaque=secret");
            first.onerror = () => {};
            const second = new WebSocket("wss://second.bet365.test/other");
            second.onerror = () => {};
          </script>
        </body>
      </html>
    `);

    await waitForObservation(observer);
    await page.waitForTimeout(50);

    assert.equal(observer.failedClosed(), false);
    assert.deepEqual(observer.observation(), {
      schemaVersion: BOOK_030_WSS_HOST_OBSERVATION_SCHEMA,
      bookmaker: "bet365",
      sourceTarget: BOOK_030_SOURCE_TARGET,
      candidateHostname: "first.bet365.test",
      publicDnsValidated: true,
      socketConnected: false,
      authorizesPolicy: false,
    });
  } finally {
    await context.close();
    await browser.close();
  }
});

test("pinned Chromium invalid first socket fails closed and a later safe socket cannot replace it", async () => {
  const observer = createBook030FirstSocketObserver(async () => ["93.184.216.34"]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    await context.routeWebSocket("**/*", async (socket) => {
      await observer.handle(socket);
    });

    const page = await context.newPage();
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          <script>
            const first = new WebSocket("wss://127.0.0.1/private");
            first.onerror = () => {};
            const second = new WebSocket("wss://safe.bet365.test/feed");
            second.onerror = () => {};
          </script>
        </body>
      </html>
    `);

    await waitForObservation(observer);
    await page.waitForTimeout(50);

    assert.equal(observer.failedClosed(), true);
    assert.equal(observer.observation(), undefined);
  } finally {
    await context.close();
    await browser.close();
  }
});


test("pinned Chromium popup WebSocket cannot become the source-page hostname observation", async () => {
  const observer = createBook030FirstSocketObserver(async () => ["93.184.216.34"]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.routeWebSocket("**/*", async (socket) => {
      await observer.handle(socket);
    });
    context.on("page", (openedPage) => {
      if (openedPage !== page) void openedPage.close().catch(() => undefined);
    });

    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          <script>
            const popup = window.open("about:blank", "_blank");
            if (popup) {
              popup.document.write(
                '<script>const rogue = new WebSocket("wss://popup.bet365.test/feed"); rogue.onerror = () => {};<\\/script>'
              );
              popup.document.close();
            }
            setTimeout(() => {
              const sourceSocket = new WebSocket("wss://source.bet365.test/feed");
              sourceSocket.onerror = () => {};
            }, 25);
          </script>
        </body>
      </html>
    `);

    await waitForObservation(observer);
    assert.equal(observer.failedClosed(), false);
    assert.equal(observer.observation()?.candidateHostname, "source.bet365.test");
  } finally {
    await context.close();
    await browser.close();
  }
});
