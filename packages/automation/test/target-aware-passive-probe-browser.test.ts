import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Page } from "playwright-core";

import {
  BOOK_024_TARGETS,
  collectPassiveRenderProvenance,
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


test("passive render provenance distinguishes DOM absence from non-visible target presence", async () => {
  const target = BOOK_024_TARGETS.sisal;
  await withFixture(
    target.url,
    "<!doctype html><html><head><title>Portogallo Galles - Nations League</title></head>" +
      "<body><div style=\"display:none\">Portogallo</div><main>shell</main></body></html>",
    async (page) => {
      const render = await collectPassiveRenderProvenance(
        page,
        target,
        "DOMCONTENTLOADED_CONFIRMED",
      );
      assert.equal(render.targetPresence.participantA.domPresent, true);
      assert.equal(render.targetPresence.participantA.visibleObservedWithinBound, false);
      assert.equal(render.targetPresence.scheduledTime.domPresent, false);
      assert.equal(render.targetPresence.scheduledTime.visibleObservedWithinBound, false);
      assert.equal(render.titlePredicates.participantPair, true);
      assert.equal(render.titlePredicates.competition, true);
      const serialized = JSON.stringify(render);
      assert.equal(serialized.includes("Portogallo Galles - Nations League"), false);
    },
  );
});

test("passive render provenance marks visibly observed target predicates without retaining hidden text", async () => {
  const target = BOOK_024_TARGETS.sisal;
  await withFixture(target.url, completeTargetHtml("UNDER", "4.25"), async (page) => {
    const render = await collectPassiveRenderProvenance(
      page,
      target,
      "DOMCONTENTLOADED_CONFIRMED",
    );
    assert.deepEqual(
      render.targetPresence.participantA,
      { domPresent: true, visibleObservedWithinBound: true },
    );
    assert.deepEqual(
      render.targetPresence.totalCornersMarket,
      { domPresent: true, visibleObservedWithinBound: true },
    );
    assert.deepEqual(
      render.targetPresence.requestedSideAtLine,
      { domPresent: true, visibleObservedWithinBound: true },
    );
  });
});

test("passive render provenance uses fixed DOM population buckets at architecture thresholds", async () => {
  const target = BOOK_024_TARGETS.sisal;
  const cases = [
    { count: 0, expected: "EMPTY" },
    { count: 1, expected: "SPARSE" },
    { count: 31, expected: "SPARSE" },
    { count: 32, expected: "POPULATED" },
  ] as const;

  for (const item of cases) {
    const descendants = Array.from(
      { length: item.count },
      (_, index) => "<span data-index=\"" + index + "\"></span>",
    ).join("");
    await withFixture(
      target.url,
      "<!doctype html><html><body>" + descendants + "</body></html>",
      async (page) => {
        const render = await collectPassiveRenderProvenance(
          page,
          target,
          "DOMCONTENTLOADED_CONFIRMED",
        );
        assert.equal(render.domPopulation, item.expected);
      },
    );
  }
});

test("existing readiness observation reports DOMContentLoaded confirmation without an added wait mode", async () => {
  const target = BOOK_024_TARGETS.bet365;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  try {
    await context.route("**/*", async (route) => {
      if (route.request().isNavigationRequest()) {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: "<!doctype html><html><body><main>ready</main></body></html>",
        });
        return;
      }
      await route.abort("blockedbyclient");
    });
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 2_000 });
    assert.equal(
      await waitForPassiveReadiness(page),
      "DOMCONTENTLOADED_CONFIRMED",
    );
  } finally {
    await context.close();
    await browser.close();
  }
});
