import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Page } from "playwright-core";

import {
  BOOK_024_TARGETS,
  collectTargetAwarePageEvidence,
  waitForPassiveReadiness,
} from "../src/live-validation/target-aware-passive-probe.ts";

async function withFixture(
  url: string,
  html: string,
  fn: (page: Page) => Promise<void>,
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  try {
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: html,
        });
        return;
      }
      await route.abort("blockedbyclient");
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 2_000 });
    await waitForPassiveReadiness(page);
    await fn(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

function completeTargetHtml(side: "OVER" | "UNDER", odds: string): string {
  return "<!doctype html><html><body><main>" +
    "<h1>Portogallo - Galles</h1>" +
    "<div>Nations League</div>" +
    "<time>24/09/2026 20:45</time>" +
    "<section><h2>Totale Corner - Partita intera</h2>" +
    "<div><span>" + side + " 6.5</span><strong>" + odds + "</strong></div>" +
    "</section></main></body></html>";
}

test("BET365 passive fixture preserves SPA hash and observes hydrated target labels without activation", async () => {
  const target = BOOK_024_TARGETS.bet365;
  const html = "<!doctype html><html><body><main id=\"app\">Loading</main>" +
    "<script>setTimeout(function () {" +
    "document.getElementById('app').innerHTML=" +
    "'<h1>Portogallo - Galles</h1><div>Nations League</div><time>24/09/2026 20:45</time>' +" +
    "'<section><h2>Totale Corner - Partita intera</h2><div><span>OVER 6.5</span><strong>1.14</strong></div></section>';" +
    "}, 50);</script></body></html>";

  await withFixture(target.url, html, async (page) => {
    assert.equal(new URL(page.url()).hash, new URL(target.url).hash);
    const evidence = await collectTargetAwarePageEvidence(page, target);
    assert.equal(evidence.dimensionsObserved.event, true);
    assert.equal(evidence.dimensionsObserved.competition, true);
    assert.equal(evidence.dimensionsObserved.scheduledTime, true);
    assert.equal(evidence.dimensionsObserved.totalCornersMarket, true);
    assert.equal(evidence.dimensionsObserved.fullMatchPeriod, true);
    assert.equal(evidence.dimensionsObserved.exactLine, true);
    assert.equal(evidence.dimensionsObserved.requestedSide, true);
    assert.equal(evidence.expectedOdds.observed, true);
    assert.equal(evidence.requiredChainObserved, true);
  });
});

test("BET365 generic landing remains insufficient on the exact fragment-bearing direct URL", async () => {
  const target = BOOK_024_TARGETS.bet365;
  await withFixture(
    target.url,
    "<!doctype html><html><body><h1>bet365 - Scommesse sportive online</h1></body></html>",
    async (page) => {
      assert.equal(new URL(page.url()).hash, new URL(target.url).hash);
      const evidence = await collectTargetAwarePageEvidence(page, target);
      assert.equal(evidence.requiredChainObserved, false);
      assert.equal(evidence.dimensionsObserved.event, false);
      assert.equal(evidence.dimensionsObserved.totalCornersMarket, false);
    },
  );
});

test("SISAL exact full-match corners line side and odds are retained as bounded passive evidence", async () => {
  const target = BOOK_024_TARGETS.sisal;
  await withFixture(target.url, completeTargetHtml("UNDER", "4.25"), async (page) => {
    const evidence = await collectTargetAwarePageEvidence(page, target);
    assert.equal(evidence.dimensionsObserved.event, true);
    assert.equal(evidence.dimensionsObserved.competition, true);
    assert.equal(evidence.dimensionsObserved.scheduledTime, true);
    assert.equal(evidence.dimensionsObserved.totalCornersMarket, true);
    assert.equal(evidence.dimensionsObserved.fullMatchPeriod, true);
    assert.equal(evidence.dimensionsObserved.exactLine, true);
    assert.equal(evidence.dimensionsObserved.requestedSide, true);
    assert.equal(evidence.expectedOdds.observed, true);
    assert.equal(evidence.requiredChainObserved, true);
    assert.ok(evidence.participantA.snippets.every((snippet) => snippet.length <= 220));
  });
});

test("SISAL broad CORNER category alone cannot imply full target identity", async () => {
  const target = BOOK_024_TARGETS.sisal;
  const html = "<!doctype html><html><body>" +
    "<h1>Portogallo - Galles</h1><div>Nations League</div><time>24/09/2026 20:45</time>" +
    "<nav><button>CORNER</button></nav></body></html>";

  await withFixture(target.url, html, async (page) => {
    const evidence = await collectTargetAwarePageEvidence(page, target);
    assert.equal(evidence.broadCornerContext.observed, true);
    assert.equal(evidence.dimensionsObserved.totalCornersMarket, false);
    assert.equal(evidence.dimensionsObserved.fullMatchPeriod, false);
    assert.equal(evidence.dimensionsObserved.exactLine, false);
    assert.equal(evidence.dimensionsObserved.requestedSide, false);
    assert.equal(evidence.dimensionsObserved.displayedOdds, false);
    assert.equal(evidence.requiredChainObserved, false);
  });
});

test("wrong time period line or side cannot produce the requested chain", async () => {
  const target = BOOK_024_TARGETS.sisal;
  const cases = [
    completeTargetHtml("UNDER", "4.25").replace("20:45", "21:45"),
    completeTargetHtml("UNDER", "4.25").replace("Partita intera", "Primo tempo"),
    completeTargetHtml("UNDER", "4.25").replace(/6\.5/g, "7.5"),
    completeTargetHtml("UNDER", "4.25").replace("UNDER 6.5", "OVER 6.5"),
  ];

  for (const html of cases) {
    await withFixture(target.url, html, async (page) => {
      const evidence = await collectTargetAwarePageEvidence(page, target);
      assert.equal(evidence.requiredChainObserved, false);
    });
  }
});

test("changed odds are observed but never become expected-odds evidence", async () => {
  const target = BOOK_024_TARGETS.sisal;
  await withFixture(target.url, completeTargetHtml("UNDER", "4.10"), async (page) => {
    const evidence = await collectTargetAwarePageEvidence(page, target);
    assert.equal(evidence.expectedOdds.observed, false);
    assert.ok(
      evidence.displayedOddsCandidates.includes("4.10"),
      JSON.stringify({
        exactLine: evidence.exactLine,
        requestedSideAtLine: evidence.requestedSideAtLine,
        totalCornersMarket: evidence.totalCornersMarket,
        fullMatchContext: evidence.fullMatchContext,
        displayedOddsCandidates: evidence.displayedOddsCandidates,
      }),
    );
  });
});
