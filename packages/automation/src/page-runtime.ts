import type { ElementHandle, Page, Route, WebSocketRoute } from "playwright-core";
import type {
  BookmakerPagePort,
  BookmakerReadQuery,
  ElementRef,
  SafeLocation,
} from "../../bookmakers/src/contracts.ts";
import type { BookmakerNetworkPolicy, BookmakerWssFailureCode } from "./bookmaker-network-policy.ts";
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
  "data-market-period",
  "data-market-line",
  "data-outcome-side",
  "data-odds",
  "aria-pressed",
]);

const BLOCKED_LOCATION: SafeLocation = Object.freeze({ href: "about:blank", origin: "notifyhandler://blocked" });

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function htmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function controlledRedirectDocument(url: string): string {
  return '<!doctype html><html><head><meta http-equiv="refresh" content="0;url='
    + htmlAttribute(url)
    + '"></head><body></body></html>';
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

export type RelayResolutionFailureCode =
  | "RELAY_INVALID"
  | "RELAY_SIGNAL_MISMATCH"
  | "RELAY_BOOKMAKER_MISMATCH"
  | "RELAY_NETWORK_TARGET_BLOCKED"
  | "RELAY_INTERMEDIARY_BLOCKED"
  | "RELAY_WRONG_FINAL_BOOKMAKER"
  | "RELAY_REDIRECT_LIMIT"
  | "RELAY_UNRESOLVED"
  | "RELAY_CHALLENGE_UNSUPPORTED";

export type RelayInvalidCategory =
  | "ENTRY_CONTRACT"
  | "TOP_LEVEL_METHOD"
  | "MALFORMED_NAVIGATION"
  | "CANONICAL_URL_BOUNDARY"
  | "UNREVIEWED_SAME_ORIGIN_PATH"
  | "MALFORMED_SIGNAL"
  | "CANONICAL_IDENTITY_MISMATCH"
  | "START_URL_MISMATCH";

export type RelayResolutionResult =
  | { readonly kind: "RESOLVED"; readonly finalLocation: SafeLocation }
  | {
      readonly kind: "FAILED";
      readonly code: "RELAY_INVALID";
      readonly invalidCategory: RelayInvalidCategory;
      readonly message: string;
    }
  | {
      readonly kind: "FAILED";
      readonly code: Exclude<RelayResolutionFailureCode, "RELAY_INVALID">;
      readonly message: string;
    };

export class BookmakerNetworkPolicyViolation extends Error {
  readonly code: BookmakerWssFailureCode;

  constructor(code: BookmakerWssFailureCode) {
    super("Bookmaker WebSocket transport violated the reviewed network policy.");
    this.name = "BookmakerNetworkPolicyViolation";
    this.code = code;
  }
}

export interface RelayResolutionOptions {
  readonly relayUrl: string;
  readonly relayPolicy: NavigationPolicy;
  readonly bookmakerPolicy: NavigationPolicy;
  readonly expectedOrigins: readonly string[];
  readonly knownBookmakerOrigins: readonly string[];
  readonly timeoutMs: number;
}

export interface WorkerPageRuntime {
  readonly port: BookmakerPagePort;
  beginAttempt(): void;
  cancelInFlight(): void;
  resolveRelay(options: RelayResolutionOptions): Promise<RelayResolutionResult>;
  activateSelection(ref: ElementRef): Promise<boolean>;
  isCurrentLocationAllowed(): boolean;
  currentNetworkFailure(): BookmakerWssFailureCode | undefined;
}

interface ActiveRelayResolution {
  readonly relayUrl: string;
  readonly relayOrigin: string;
  readonly signalId: string;
  readonly bookmakerSuffix: string;
  readonly relayPolicy: NavigationPolicy;
  readonly bookmakerPolicy: NavigationPolicy;
  readonly expectedOrigins: ReadonlySet<string>;
  readonly knownBookmakerOrigins: ReadonlySet<string>;
  phase: "EXPECT_RELAY" | "EXPECT_BOOKMAKER" | "ARRIVED";
  sameOriginHopCount: 0 | 1;
  failure?: Extract<RelayResolutionResult, { readonly kind: "FAILED" }>;
}

interface CanonicalRelayIdentity {
  readonly href: string;
  readonly signalId: string;
  readonly bookmakerSuffix: string;
}

const BETUP_RELAY_ORIGIN = "https://www.bet-up.it";
const RELAY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function relayInvalidFailure(
  invalidCategory: RelayInvalidCategory,
  message: string,
): Extract<RelayResolutionResult, { readonly kind: "FAILED"; readonly code: "RELAY_INVALID" }> {
  return { kind: "FAILED", code: "RELAY_INVALID", invalidCategory, message };
}

function parseCanonicalRelayIdentity(rawUrl: string): CanonicalRelayIdentity | undefined {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return undefined;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== BETUP_RELAY_ORIGIN ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    return undefined;
  }

  const match = /^\/lnk\/([0-9a-fA-F-]+)\/([a-z0-9]+)$/u.exec(parsed.pathname);
  if (match === null) return undefined;

  const signalId = (match[1] ?? "").toLowerCase();
  const bookmakerSuffix = match[2] ?? "";
  if (!RELAY_UUID.test(signalId) || bookmakerSuffix === "") return undefined;

  const href = `${BETUP_RELAY_ORIGIN}/lnk/${signalId}/${bookmakerSuffix}`;
  if (parsed.href !== href) return undefined;
  return { href, signalId, bookmakerSuffix };
}

class PlaywrightPageRuntime implements WorkerPageRuntime, BookmakerPagePort {
  readonly port: BookmakerPagePort = this;
  private readonly refs = new Map<string, RegisteredElement>();
  private readonly fixtureRouter: FixtureRouter | undefined;
  private readonly page: Page;
  private readonly networkPolicy: BookmakerNetworkPolicy;
  private policy: NavigationPolicy;
  private relayResolution: ActiveRelayResolution | undefined;
  private readonly mapping: SemanticDomMapping;
  private readonly navigationTimeoutMs: number;
  private generation = 0;
  private nextRef = 0;
  private blockingOperation = false;
  private cancelled = false;
  private crashed = false;
  private attemptGeneration = 0;
  private webSocketFailure: BookmakerWssFailureCode | undefined;
  private readonly allowedWebSockets = new Set<WebSocketRoute>();
  private lastSafeLocation: SafeLocation | undefined;

  constructor(
    page: Page,
    policy: NavigationPolicy,
    networkPolicy: BookmakerNetworkPolicy,
    mapping: SemanticDomMapping,
    fixtureDocuments: FixtureDocuments | undefined,
    navigationTimeoutMs: number,
  ) {
    this.page = page;
    this.policy = policy;
    this.networkPolicy = networkPolicy;
    this.mapping = mapping;
    this.navigationTimeoutMs = navigationTimeoutMs;
    this.fixtureRouter = fixtureDocuments === undefined ? undefined : new FixtureRouter(fixtureDocuments);
  }

  async initialize(): Promise<void> {
    await this.page.route("**/*", async (route) => this.handleRoute(route));
    await this.page.routeWebSocket("**/*", async (socket) => {
      if (this.relayResolution !== undefined) {
        this.relayResolution.failure = {
          kind: "FAILED",
          code: "RELAY_NETWORK_TARGET_BLOCKED",
          message: "Relay page attempted a WebSocket connection during restricted resolution.",
        };
        await socket.close({ code: 1008, reason: "Relay WebSocket blocked" }).catch(() => undefined);
        return;
      }

      const socketAttemptGeneration = this.attemptGeneration;
      const decision = await this.networkPolicy.evaluateWebSocket(
        socket.url(),
        this.page.url(),
        this.cancelled,
      );
      if (
        this.cancelled
        || socketAttemptGeneration !== this.attemptGeneration
      ) {
        await socket.close({ code: 1008, reason: "Bookmaker attempt no longer current" })
          .catch(() => undefined);
        return;
      }
      if (!decision.allowed) {
        this.webSocketFailure ??= decision.code;
        this.invalidateReferences();
        await socket.close({ code: 1008, reason: "Bookmaker WebSocket blocked" }).catch(() => undefined);
        return;
      }

      socket.connectToServer();
      this.allowedWebSockets.add(socket);
    });
    this.page.on("framenavigated", (frame) => {
      if (frame === this.page.mainFrame()) this.invalidateReferences();
    });
    this.page.on("crash", () => {
      this.crashed = true;
      this.allowedWebSockets.clear();
      this.invalidateReferences();
    });
    this.page.on("close", () => {
      this.allowedWebSockets.clear();
      this.invalidateReferences();
    });
  }

  beginAttempt(): void {
    if (this.page.isClosed() || this.crashed) throw new Error("Browser page is not available for a new attempt.");
    this.revokeAllowedWebSockets("Bookmaker attempt superseded");
    this.attemptGeneration += 1;
    this.invalidateReferences();
    this.cancelled = false;
    this.webSocketFailure = undefined;
  }

  cancelInFlight(): void {
    this.cancelled = true;
    this.revokeAllowedWebSockets("Bookmaker attempt cancelled");
    if (this.blockingOperation && !this.page.isClosed()) {
      void this.page.close({ runBeforeUnload: false }).catch(() => undefined);
    }
  }

  async openAllowed(url: string): Promise<{ readonly ok: boolean }> {
    if (this.cancelled) return { ok: true };
    this.throwIfNetworkFailed();
    if (this.page.isClosed() || this.crashed || !(await this.isAllowedNetworkTarget(url))) return { ok: false };

    this.blockingOperation = true;
    this.invalidateReferences();
    try {
      await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: this.navigationTimeoutMs });
      if (this.cancelled) return { ok: true };
      this.throwIfNetworkFailed();
      const current = this.locationFromHref(this.page.url());
      if (current === undefined || !this.policy.isAllowed(current.href)) return { ok: false };
      this.lastSafeLocation = current;
      return { ok: true };
    } catch {
      this.throwIfNetworkFailed();
      return { ok: this.cancelled };
    } finally {
      this.blockingOperation = false;
    }
  }

  async currentLocation(): Promise<SafeLocation> {
    this.throwIfNetworkFailed();
    if (this.page.isClosed()) return this.lastSafeLocation ?? BLOCKED_LOCATION;
    const current = this.locationFromHref(this.page.url());
    if (current === undefined) return BLOCKED_LOCATION;
    if (this.policy.isAllowed(current.href)) this.lastSafeLocation = current;
    return current;
  }

  async waitForPageReady(options?: { readonly timeoutMs?: number }): Promise<{ readonly ready: boolean }> {
    if (this.cancelled) return { ready: true };
    this.throwIfNetworkFailed();
    if (this.page.isClosed() || this.crashed) return { ready: false };
    this.blockingOperation = true;
    try {
      await this.page.waitForLoadState("domcontentloaded", { timeout: options?.timeoutMs ?? this.navigationTimeoutMs });
      this.throwIfNetworkFailed();
      return { ready: true };
    } catch {
      this.throwIfNetworkFailed();
      return { ready: this.cancelled };
    } finally {
      this.blockingOperation = false;
    }
  }

  async query(query: BookmakerReadQuery): Promise<readonly ElementRef[]> {
    this.throwIfNetworkFailed();
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
      this.throwIfNetworkFailed();
      return [];
    }
  }

  async readText(ref: ElementRef): Promise<string> {
    this.throwIfNetworkFailed();
    const entry = await this.liveEntry(ref);
    if (!entry) return "";
    try {
      return (await entry.handle.textContent()) ?? "";
    } catch {
      this.throwIfNetworkFailed();
      return "";
    }
  }

  async readAttribute(ref: ElementRef, name: string): Promise<string | null> {
    this.throwIfNetworkFailed();
    if (!SAFE_ATTRIBUTES.has(name)) return null;
    const entry = await this.liveEntry(ref);
    if (!entry) return null;
    try {
      return await entry.handle.getAttribute(name);
    } catch {
      this.throwIfNetworkFailed();
      return null;
    }
  }

  async isVisible(ref: ElementRef): Promise<boolean> {
    this.throwIfNetworkFailed();
    const entry = await this.liveEntry(ref);
    if (!entry) return false;
    try {
      return await entry.handle.isVisible();
    } catch {
      this.throwIfNetworkFailed();
      return false;
    }
  }

  async activateNavigationControl(action: Readonly<{ ref: ElementRef; purpose: "DISCLOSE_EVENT" | "DISCLOSE_MARKET" }>): Promise<{ readonly ok: boolean }> {
    if (this.cancelled) return { ok: false };
    this.throwIfNetworkFailed();
    if (this.page.isClosed() || this.crashed || !this.isCurrentLocationAllowed()) return { ok: false };
    const entry = await this.liveEntry(action.ref);
    if (!entry) return { ok: false };
    if (action.purpose === "DISCLOSE_EVENT" && entry.role !== "event") return { ok: false };
    if (action.purpose === "DISCLOSE_MARKET" && entry.role !== "market") return { ok: false };
    try {
      await entry.handle.click({ timeout: 3_000 });
      this.throwIfNetworkFailed();
      return { ok: true };
    } catch {
      this.throwIfNetworkFailed();
      return { ok: false };
    }
  }

  async resolveRelay(options: RelayResolutionOptions): Promise<RelayResolutionResult> {
    if (this.cancelled || this.page.isClosed() || this.crashed) {
      return { kind: "FAILED", code: "RELAY_UNRESOLVED", message: "Relay resolution cannot start on an unavailable browser page." };
    }

    const relayIdentity = parseCanonicalRelayIdentity(options.relayUrl);
    if (relayIdentity === undefined) {
      return relayInvalidFailure("ENTRY_CONTRACT", "Relay URL violates the canonical restricted navigation contract.");
    }
    const relay = new URL(relayIdentity.href);

    const expectedOrigins = new Set(options.expectedOrigins);
    if (
      expectedOrigins.size === 0 ||
      options.timeoutMs <= 0
    ) {
      return relayInvalidFailure("ENTRY_CONTRACT", "Relay resolution options violate the restricted navigation contract.");
    }

    this.invalidateReferences();
    this.policy = options.relayPolicy;
    this.relayResolution = {
      relayUrl: relayIdentity.href,
      relayOrigin: relay.origin,
      signalId: relayIdentity.signalId,
      bookmakerSuffix: relayIdentity.bookmakerSuffix,
      relayPolicy: options.relayPolicy,
      bookmakerPolicy: options.bookmakerPolicy,
      expectedOrigins,
      knownBookmakerOrigins: new Set(options.knownBookmakerOrigins),
      phase: "EXPECT_RELAY",
      sameOriginHopCount: 0,
    };
    this.blockingOperation = true;

    try {
      await this.page.goto(relay.href, { waitUntil: "domcontentloaded", timeout: options.timeoutMs }).catch(() => undefined);
      if (this.cancelled || this.page.isClosed()) {
        return { kind: "FAILED", code: "RELAY_UNRESOLVED", message: "Relay resolution was interrupted." };
      }

      const active = this.relayResolution;
      if (active?.failure) return active.failure;

      if (active?.phase !== "ARRIVED") {
        await Promise.race([
          this.page.waitForURL((url) => expectedOrigins.has(url.origin), { timeout: options.timeoutMs }).catch(() => undefined),
          delay(options.timeoutMs),
        ]);
      }

      const afterWait = this.relayResolution;
      if (afterWait?.failure) return afterWait.failure;

      if (afterWait?.phase !== "ARRIVED") {
        if (await this.detectRelayChallenge()) {
          return {
            kind: "FAILED",
            code: "RELAY_CHALLENGE_UNSUPPORTED",
            message: "The relay presented an authentication, CAPTCHA, consent, or other unsupported challenge.",
          };
        }
        return { kind: "FAILED", code: "RELAY_UNRESOLVED", message: "The relay did not reach the expected bookmaker within the bounded resolution window." };
      }

      const current = this.locationFromHref(this.page.url());
      if (current === undefined || !expectedOrigins.has(current.origin)) {
        return { kind: "FAILED", code: "RELAY_WRONG_FINAL_BOOKMAKER", message: "Relay resolution did not finish on the expected bookmaker origin." };
      }
      if (!(await options.bookmakerPolicy.isResolvedTargetAllowed(current.href))) {
        return { kind: "FAILED", code: "RELAY_NETWORK_TARGET_BLOCKED", message: "The resolved bookmaker destination failed network-target validation." };
      }

      this.policy = options.bookmakerPolicy;
      this.lastSafeLocation = current;
      return { kind: "RESOLVED", finalLocation: current };
    } finally {
      this.blockingOperation = false;
      this.relayResolution = undefined;
      this.policy = options.bookmakerPolicy;
    }
  }

  async activateSelection(ref: ElementRef): Promise<boolean> {
    if (this.cancelled) return false;
    this.throwIfNetworkFailed();
    if (this.page.isClosed() || this.crashed || !this.isCurrentLocationAllowed()) return false;
    const entry = await this.liveEntry(ref);
    if (!entry || entry.role !== "outcome") return false;
    try {
      await entry.handle.click({ timeout: 3_000 });
      this.throwIfNetworkFailed();
      return true;
    } catch {
      this.throwIfNetworkFailed();
      return false;
    }
  }

  isCurrentLocationAllowed(): boolean {
    this.throwIfNetworkFailed();
    if (this.page.isClosed() || this.crashed) return false;
    return this.policy.isAllowed(this.page.url());
  }

  currentNetworkFailure(): BookmakerWssFailureCode | undefined {
    return this.webSocketFailure;
  }

  private throwIfNetworkFailed(): void {
    if (this.webSocketFailure !== undefined) {
      throw new BookmakerNetworkPolicyViolation(this.webSocketFailure);
    }
  }

  private revokeAllowedWebSockets(reason: string): void {
    const sockets = [...this.allowedWebSockets];
    this.allowedWebSockets.clear();
    for (const socket of sockets) {
      void socket.close({ code: 1008, reason }).catch(() => undefined);
    }
  }

  private async handleRoute(route: Route): Promise<void> {
    const request = route.request();
    const mainFrameRequest = request.frame() === this.page.mainFrame();
    const topLevelNavigation = mainFrameRequest
      && (request.isNavigationRequest() || request.resourceType() === "document");

    try {
      if (
        topLevelNavigation
        && this.relayResolution !== undefined
        && request.method() !== "GET"
      ) {
        this.relayResolution.failure = relayInvalidFailure(
          "TOP_LEVEL_METHOD",
          "Relay top-level navigation used an unreviewed HTTP method.",
        );
        await route.abort("blockedbyclient");
        return;
      }

      if (!topLevelNavigation && this.relayResolution !== undefined) {
        const active = this.relayResolution;
        const allowed = await active.relayPolicy.isResolvedPublicHttpsTarget(request.url());
        if (!allowed) {
          active.failure = {
            kind: "FAILED",
            code: "RELAY_NETWORK_TARGET_BLOCKED",
            message: "Relay page attempted a non-public or otherwise unsafe network request.",
          };
          await route.abort("blockedbyclient");
          return;
        }

        if (this.fixtureRouter !== undefined) {
          const fixture = this.fixtureRouter.next(request.url());
          if (fixture === undefined) {
            await route.abort("blockedbyclient");
            return;
          }
          if ((fixture.delayMs ?? 0) > 0) await delay(fixture.delayMs ?? 0);
          if (fixture.kind === "redirect") {
            active.failure = {
              kind: "FAILED",
              code: "RELAY_NETWORK_TARGET_BLOCKED",
              message: "Relay subresource attempted an HTTP redirect during restricted resolution.",
            };
            await route.abort("blockedbyclient");
            return;
          }
          await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixture.body });
          return;
        }

        try {
          const response = await route.fetch({ maxRedirects: 0, timeout: this.navigationTimeoutMs });
          const status = response.status();
          if (status >= 300 && status < 400) {
            active.failure = {
              kind: "FAILED",
              code: "RELAY_NETWORK_TARGET_BLOCKED",
              message: "Relay subresource attempted an HTTP redirect during restricted resolution.",
            };
            await route.abort("blockedbyclient");
            return;
          }
          await route.fulfill({ response });
        } catch {
          active.failure = {
            kind: "FAILED",
            code: "RELAY_NETWORK_TARGET_BLOCKED",
            message: "Relay subresource could not be fetched without unsafe redirect behavior.",
          };
          await route.abort("blockedbyclient").catch(() => undefined);
        }
        return;
      }

      if (topLevelNavigation) {
        const url = request.url();
        this.invalidateReferences();
        const relayAllowed = this.relayResolution === undefined
          ? undefined
          : await this.allowRelayTopLevel(url);
        if (relayAllowed === false || (relayAllowed === undefined && !(await this.isAllowedNetworkTarget(url)))) {
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
          } else if (this.relayResolution !== undefined && url === this.relayResolution.relayUrl) {
            const candidate = await this.validateRelayDestinationCandidate(this.relayResolution, fixture.location, false);
            if (!candidate.ok) {
              await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><html><body></body></html>" });
              return;
            }
            await route.fulfill({
              status: 200,
              contentType: "text/html; charset=utf-8",
              body: controlledRedirectDocument(candidate.href),
            });
          } else {
            await route.fulfill({ status: fixture.status ?? 302, headers: { location: fixture.location }, body: "" });
          }
          return;
        }

        if (this.relayResolution !== undefined && url === this.relayResolution.relayUrl) {
          await this.fulfillRelayEntry(route);
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

  private async validateRelayDestinationCandidate(
    active: ActiveRelayResolution,
    rawUrl: string,
    consumeSameOriginHop: boolean,
  ): Promise<
    | { readonly ok: true; readonly href: string; readonly kind: "RELAY_REVISIT" | "BOOKMAKER" }
    | { readonly ok: false }
  > {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl, active.relayUrl);
    } catch {
      active.failure = relayInvalidFailure("MALFORMED_NAVIGATION", "Relay navigation produced a malformed top-level URL.");
      return { ok: false };
    }

    if (parsed.origin === active.relayOrigin) {
      if (
        parsed.protocol !== "https:" ||
        parsed.username !== "" ||
        parsed.password !== "" ||
        parsed.search !== "" ||
        parsed.hash !== ""
      ) {
        active.failure = relayInvalidFailure("CANONICAL_URL_BOUNDARY", "Relay revisit violated the canonical URL boundary.");
        return { ok: false };
      }

      const match = /^\/lnk\/([0-9a-fA-F-]+)\/([a-z0-9]+)$/u.exec(parsed.pathname);
      if (match === null) {
        active.failure = relayInvalidFailure("UNREVIEWED_SAME_ORIGIN_PATH", "Relay revisit used an unreviewed same-origin path.");
        return { ok: false };
      }

      const signalId = (match[1] ?? "").toLowerCase();
      const bookmakerSuffix = match[2] ?? "";
      if (!RELAY_UUID.test(signalId)) {
        active.failure = relayInvalidFailure("MALFORMED_SIGNAL", "Relay revisit contained a malformed signal identifier.");
        return { ok: false };
      }
      if (signalId !== active.signalId) {
        active.failure = { kind: "FAILED", code: "RELAY_SIGNAL_MISMATCH", message: "Relay revisit did not preserve the immutable signal identity." };
        return { ok: false };
      }
      if (bookmakerSuffix !== active.bookmakerSuffix) {
        active.failure = { kind: "FAILED", code: "RELAY_BOOKMAKER_MISMATCH", message: "Relay revisit did not preserve the immutable bookmaker binding." };
        return { ok: false };
      }

      const canonicalHref = `${active.relayOrigin}/lnk/${signalId}/${bookmakerSuffix}`;
      if (parsed.href !== canonicalHref || canonicalHref !== active.relayUrl) {
        active.failure = relayInvalidFailure("CANONICAL_IDENTITY_MISMATCH", "Relay revisit was not the exact canonical relay URL.");
        return { ok: false };
      }
      if (active.sameOriginHopCount >= 1) {
        active.failure = { kind: "FAILED", code: "RELAY_REDIRECT_LIMIT", message: "Relay revisit exceeded the fixed same-origin hop budget." };
        return { ok: false };
      }
      if (!(await active.relayPolicy.isResolvedTargetAllowed(parsed.href))) {
        active.failure = { kind: "FAILED", code: "RELAY_NETWORK_TARGET_BLOCKED", message: "Relay revisit failed network-target validation." };
        return { ok: false };
      }

      if (consumeSameOriginHop) active.sameOriginHopCount = 1;
      return { ok: true, href: parsed.href, kind: "RELAY_REVISIT" };
    }

    if (active.expectedOrigins.has(parsed.origin)) {
      if (!(await active.bookmakerPolicy.isResolvedTargetAllowed(parsed.href))) {
        active.failure = { kind: "FAILED", code: "RELAY_NETWORK_TARGET_BLOCKED", message: "Bookmaker destination failed network-target validation." };
        return { ok: false };
      }
      return { ok: true, href: parsed.href, kind: "BOOKMAKER" };
    }

    if (active.knownBookmakerOrigins.has(parsed.origin)) {
      active.failure = { kind: "FAILED", code: "RELAY_WRONG_FINAL_BOOKMAKER", message: "Relay reached a bookmaker different from the leg target." };
      return { ok: false };
    }

    active.failure = { kind: "FAILED", code: "RELAY_INTERMEDIARY_BLOCKED", message: "Relay attempted to navigate through an unreviewed intermediary origin." };
    return { ok: false };
  }

  private async fulfillRelayEntry(route: Route): Promise<void> {
    const active = this.relayResolution;
    if (active === undefined) {
      await route.abort("blockedbyclient");
      return;
    }

    try {
      const response = await route.fetch({ maxRedirects: 0, timeout: this.navigationTimeoutMs });
      const status = response.status();
      if (status >= 300 && status < 400) {
        const location = response.headers()["location"];
        if (location === undefined) {
          active.failure = { kind: "FAILED", code: "RELAY_UNRESOLVED", message: "Relay returned a redirect without a destination." };
          await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><html><body></body></html>" });
          return;
        }
        const candidate = await this.validateRelayDestinationCandidate(active, location, false);
        if (!candidate.ok) {
          await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><html><body></body></html>" });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: controlledRedirectDocument(candidate.href),
        });
        return;
      }

      await route.fulfill({ response });
    } catch {
      active.failure = { kind: "FAILED", code: "RELAY_UNRESOLVED", message: "Relay entry request could not be resolved safely." };
      await route.abort("blockedbyclient").catch(() => undefined);
    }
  }

  private async allowRelayTopLevel(url: string): Promise<boolean> {
    const active = this.relayResolution;
    if (active === undefined) return false;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      active.failure = relayInvalidFailure("MALFORMED_NAVIGATION", "Relay navigation produced a malformed top-level URL.");
      return false;
    }

    if (active.phase === "EXPECT_RELAY") {
      if (parsed.href !== active.relayUrl) {
        active.failure = relayInvalidFailure("START_URL_MISMATCH", "Relay navigation did not start from the exact validated relay URL.");
        return false;
      }
      if (!(await active.relayPolicy.isResolvedTargetAllowed(parsed.href))) {
        active.failure = { kind: "FAILED", code: "RELAY_NETWORK_TARGET_BLOCKED", message: "Relay origin failed network-target validation." };
        return false;
      }
      active.phase = "EXPECT_BOOKMAKER";
      return true;
    }

    const candidate = await this.validateRelayDestinationCandidate(active, parsed.href, true);
    if (!candidate.ok) return false;
    if (candidate.kind === "RELAY_REVISIT") return true;
    active.phase = "ARRIVED";
    return true;
  }

  private async detectRelayChallenge(): Promise<boolean> {
    if (this.page.isClosed()) return false;
    try {
      return await this.page.locator(
        '[data-nh-relay-challenge], input[type="password"], input[name*="captcha" i], [id*="captcha" i], [class*="captcha" i], iframe[src*="captcha" i]',
      ).first().isVisible().catch(() => false);
    } catch {
      return false;
    }
  }

  private async isAllowedNetworkTarget(url: string): Promise<boolean> {
    if (!this.policy.isAllowed(url)) return false;
    if (this.fixtureRouter !== undefined) return true;
    return this.policy.isResolvedTargetAllowed(url);
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
  networkPolicy: BookmakerNetworkPolicy;
  mapping: SemanticDomMapping;
  fixtureDocuments?: FixtureDocuments;
  navigationTimeoutMs?: number;
}>): Promise<WorkerPageRuntime> {
  const runtime = new PlaywrightPageRuntime(
    options.page,
    options.policy,
    options.networkPolicy,
    options.mapping,
    options.fixtureDocuments,
    options.navigationTimeoutMs ?? 15_000,
  );
  await runtime.initialize();
  return runtime;
}
