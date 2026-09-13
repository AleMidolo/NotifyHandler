import type { BookmakerPagePort, SafeLocation } from "./contracts.ts";

const BLOCKED_LOCATION: SafeLocation = Object.freeze({
  href: "about:blank",
  origin: "notifyhandler://blocked",
});

export function isApprovedFinalLocation(
  location: SafeLocation,
  supportedOrigins: readonly string[],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(location.href);
  } catch {
    return false;
  }

  return (
    parsed.protocol === "https:" &&
    parsed.username === "" &&
    parsed.password === "" &&
    supportedOrigins.includes(parsed.origin) &&
    location.origin === parsed.origin
  );
}

/**
 * Restricts `currentLocation()` so adapter cores cannot accidentally accept a
 * same-origin redirect carrying forbidden URL userinfo or inconsistent origin
 * metadata. Invalid final locations are converted to an unapproved sentinel;
 * adapter cores then return their normal `BLOCKED_REDIRECT` safe failure before
 * authentication/matching/activation logic is reachable.
 */
export function withValidatedFinalLocation(
  browser: BookmakerPagePort,
  supportedOrigins: readonly string[],
): BookmakerPagePort {
  return new Proxy(browser, {
    get(target, property, receiver) {
      if (property === "currentLocation") {
        return async (): Promise<SafeLocation> => {
          const location = await target.currentLocation();
          return isApprovedFinalLocation(location, supportedOrigins) ? location : BLOCKED_LOCATION;
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
