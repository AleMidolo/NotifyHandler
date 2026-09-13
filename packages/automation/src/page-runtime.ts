import type { ElementHandle, Page, Route } from "playwright-core";
import type {
  BookmakerPagePort,
  BookmakerReadQuery,
  ElementRef,
  SafeLocation,
} from "../../bookmakers/src/contracts.ts";
import type { SemanticDomMapping, SemanticElementRole } from "./dom-mapping.ts";
import { NavigationPolicy } from "./navigation-policy.ts";

export type FixtureResponse =
  | { readonly kind: "html"; readonly body: string; readonly delayMs?: number }
  | { readonly kind: "redirect"; readonly location: string; readonly status?: 301 | 302 | 303 | 307 | 308; readonly delayMs?: number };
export type FixtureDocument = FixtureResponse | readonly FixtureResponse[];
export type FixtureDocuments = Readonly<Record<string, FixtureDocument>>;

interface RegisteredElement {
  readonly handle: ElementHandle<HTMLElement | SVGElement>;
  readonly generation: number;
  readonly role: SemanticElementRole;
}

const SAFE_ATTRIBUTES = new Set([
  "data-event-participant-a",
  "data-event-participant-b",
  "data-event-competition",
  "data-event-scheduled-at",
  "data-market-family",
  "data-market-context",
  "data-market-line",
  "data-outcome-side",
  "data-odds",
  "aria-pressed",
]);

const BLOCKED_LOCATION: SafeLocation = Object.freeze({ href: "about:blank", origin: "notifyhandler://blocked" });

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FixtureRouter {
  private readonly indices = new Map<string, number>();
  private readonly documents: FixtureDocuments;

  constructor(documents: FixtureDocuments) {
    this.documents = documents;
  }

  next(url: string): FixtureResponse | undefined {
    const document = this.documents[url];
    if (document === undefined) return undefined;
    const sequence: readonly FixtureResponse[] = Array.isArray(document) ? document : [document];
    if (sequence.length === 0) return undefined;
    const index = this.indices.get(url) ?? 0;
    this.indices.set(url, index + 1);
    return sequence[Math.min(index, sequence.length - 1)];
  }
}

export interface WorkerPageRuntime {
  readonly port: BookmakerPagePort;
  beginAttempt(): void;
  cancelInFlight(): void;
  activateSelection(ref: ElementRef): Promise<boolean>;
  isCurrentLocationAllowed(): boolean;
}

class PlaywrightPageRuntime implements WorkerPageRuntime, BookmakerPagePort {
  readonly port: BookmakerPagePort = this;
  private readonly refs = new Map<string, RegisteredElement>();
  private readonly fixtureRouter: FixtureRouter | undefined;
  private readonly page: Page;
  private readonly policy: NavigationPolicy;
  private readonly mapping: SemanticDomMapping;
  private readonly navigationTimeoutMs: number;
  private generation = 0;
  private nextRef = 0;
  private blockingOperation = false;
  private cancelled = false;
  private crashed = false;
  private lastSafeLocation: SafeLocation | undefined;

  constructor(
    page: Page,
    policy: NavigationPolicy,
    mapping: SemanticDomMapping,
    fixtureDocuments: FixtureDocuments | undefined,
    navigationTimeoutMs: number,
  ) {
    this.page = page;
    this.policy = policy;
    this.mapping = mapping;
    this.navigationTimeoutMs = navigationTimeoutMs;
    this.fixtureRouter = fixtureDocuments === undefined ? undefined : new FixtureRouter(fixtureDocuments);
  }

  async initialize(): Promise<void> {
    await this.page.route("**/*", async (route) => this.handleRoute(route));
    this.page.on("framenavigated", (frame) => {
      if (frame === this.page.mainFrame()) this.invalidateReferences();
    });
    this.page.on("crash", () => {
      this.crashed = true;
      this.invalidateReferences();
    });
    this.page.on("close", () => this.invalidateReferences());
  }

  beginAttempt(): void {
    if (this.page.isClosed() || this.crashed) throw new Error("Browser page is not available for a new attempt.");
    this.invalidateReferences();
    this.cancelled = false;
  }

  cancelInFlight(): void {
    this.cancelled = true;
    if (this.blockingOperation && !this.page.isClosed()) {
      void this.page.close({ runBeforeUnload: false }).catch(() => undefined);
    }
  }

  async openAllowed(url: string): Promise<{ readonly ok: boolean }> {
    if (this.cancelled) return { ok: true };
    if (!this.policy.isAllowed(url) || this.page.isClosed() || this.crashed) return { ok: false };

    this.blockingOperation = true;
    this.invalidateReferences();
    try {
      await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: this.navigationTimeoutMs });
      if (this.cancelled) return { ok: true };
      const current = this.locationFromHref(this.page.url());
      if (current === undefined || !this.policy.isAllowed(current.href)) return { ok: false };
      this.lastSafeLocation = current;
      return { ok: true };
    } catch {
      return { ok: this.cancelled };
    } finally {
      this.blockingOperation = false;
    }
  }

  async currentLocation(): Promise<SafeLocation> {
    if (this.page.isClosed()) return this.lastSafeLocation ?? BLOCKED_LOCATION;
    const current = this.locationFromHref(this.page.url());
    if (current === undefined) return BLOCKED_LOCATION;
    if (this.policy.isAllowed(current.href)) this.lastSafeLocation = current;
    return current;
  }

  async waitForPageReady(options?: { readonly timeoutMs?: number }): Promise<{ readonly ready: boolean }> {
    if (this.cancelled) return { ready: true };
    if (this.page.isClosed() || this.crashed) return { ready: false };
    this.blockingOperation = true;
    try {
      await this.page.waitForLoadState("domcontentloaded", { timeout: options?.timeoutMs ?? this.navigationTimeoutMs });
      return { ready: true };
    } catch {
      return { ready: this.cancelled };
    } finally {
      this.blockingOperation = false;
    }
  }

  async query(query: BookmakerReadQuery): Promise<readonly ElementRef[]> {
    if (this.page.isClosed() || this.crashed) return [];
    try {
      if (query.kind === "auth-wall") return this.registerMany(await this.page.$$(this.mapping.authWall), "auth");
      if (query.kind === "event-candidate") return this.registerMany(await this.page.$$(this.mapping.eventCandidate), "event");

      const parent = await this.liveEntry(query.within);
      if (!parent) return [];
      const selector = query.kind === "market-candidate" ? this.mapping.marketCandidate : this.mapping.outcomeCandidate;
      const role: SemanticElementRole = query.kind === "market-candidate" ? "market" : "outcome";
      return this.registerMany(await parent.handle.$$(selector), role);
    } catch {
      return [];
    }
  }

  async readText(ref: ElementRef): Promise<string> {
    const entry = await this.liveEntry(ref);
    if (!entry) return "";
    try {
      return (await entry.handle.textContent()) ?? "";
    } catch {
      return "";
    }
  }

  async readAttribute(ref: ElementRef, name: string): Promise<string | null> {
    if (!SAFE_ATTRIBUTES.has(name)) return null;
    const entry = await this.liveEntry(ref);
    if (!entry) return null;
    try {
      return await entry.handle.getAttribute(name);
    } catch {
      return null;
    }
  }

  async isVisible(ref: ElementRef): Promise<boolean> {
    const entry = await this.liveEntry(ref);
    if (!entry) return false;
    try {
      return await entry.handle.isVisible();
    } catch {
      return false;
    }
  }

  async activateNavigationControl(action: Readonly<{ ref: ElementRef; purpose: "DISCLOSE_EVENT" | "DISCLOSE_MARKET" }>): Promise<{ readonly ok: boolean }> {
    if (this.cancelled || this.page.isClosed() || this.crashed || !this.isCurrentLocationAllowed()) return { ok: false };
    const entry = await this.liveEntry(action.ref);
    if (!entry) return { ok: false };
    if (action.purpose === "DISCLOSE_EVENT" && entry.role !== "event") return { ok: false };
    if (action.purpose === "DISCLOSE_MARKET" && entry.role !== "market") return { ok: false };
    try {
      await entry.handle.click({ timeout: 3_000 });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  async activateSelection(ref: ElementRef): Promise<boolean> {
    if (this.cancelled || this.page.isClosed() || this.crashed || !this.isCurrentLocationAllowed()) return false;
    const entry = await this.liveEntry(ref);
    if (!entry || entry.role !== "outcome") return false;
    try {
      await entry.handle.click({ timeout: 3_000 });
      return true;
    } catch {
      return false;
    }
  }

  isCurrentLocationAllowed(): boolean {
    if (this.page.isClosed() || this.crashed) return false;
    return this.policy.isAllowed(this.page.url());
  }

  private async handleRoute(route: Route): Promise<void> {
    const request = route.request();
    const topLevelNavigation = request.isNavigationRequest() && request.frame() === this.page.mainFrame();

    try {
      if (topLevelNavigation) {
        const url = request.url();
        this.invalidateReferences();
        if (!this.policy.isAllowed(url)) {
          await route.abort("blockedbyclient");
          return;
        }

        if (this.fixtureRouter) {
          const fixture = this.fixtureRouter.next(url);
          if (!fixture) {
            await route.abort("blockedbyclient");
            return;
          }
          if ((fixture.delayMs ?? 0) > 0) await delay(fixture.delayMs ?? 0);
          if (this.cancelled || this.page.isClosed()) {
            await route.abort("blockedbyclient").catch(() => undefined);
            return;
          }
          if (fixture.kind === "html") {
            await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixture.body });
          } else {
            await route.fulfill({ status: fixture.status ?? 302, headers: { location: fixture.location } });
          }
          return;
        }
      }

      if (this.fixtureRouter) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    } catch {
      await route.abort("blockedbyclient").catch(() => undefined);
    }
  }

  private registerMany(handles: readonly ElementHandle<HTMLElement | SVGElement>[], role: SemanticElementRole): readonly ElementRef[] {
    return handles.map((handle) => {
      const id = `pw:${this.generation}:${++this.nextRef}`;
      this.refs.set(id, { handle, generation: this.generation, role });
      return { id };
    });
  }

  private async liveEntry(ref: ElementRef): Promise<RegisteredElement | undefined> {
    const entry = this.refs.get(ref.id);
    if (!entry || entry.generation !== this.generation) return undefined;
    try {
      const connected = await entry.handle.evaluate((node) => node.isConnected);
      return connected ? entry : undefined;
    } catch {
      return undefined;
    }
  }

  private invalidateReferences(): void {
    this.generation += 1;
    const stale = [...this.refs.values()];
    this.refs.clear();
    for (const entry of stale) void entry.handle.dispose().catch(() => undefined);
  }

  private locationFromHref(href: string): SafeLocation | undefined {
    try {
      const parsed = new URL(href);
      return { href: parsed.href, origin: parsed.origin };
    } catch {
      return undefined;
    }
  }
}

export async function createWorkerPageRuntime(options: Readonly<{
  page: Page;
  policy: NavigationPolicy;
  mapping: SemanticDomMapping;
  fixtureDocuments?: FixtureDocuments;
  navigationTimeoutMs?: number;
}>): Promise<WorkerPageRuntime> {
  const runtime = new PlaywrightPageRuntime(
    options.page,
    options.policy,
    options.mapping,
    options.fixtureDocuments,
    options.navigationTimeoutMs ?? 15_000,
  );
  await runtime.initialize();
  return runtime;
}
