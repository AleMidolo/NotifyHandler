import assert from "node:assert/strict";
import test from "node:test";
import { NavigationPolicy, isInternalHostname } from "../src/navigation-policy.ts";

test("navigation policy accepts only exact approved HTTPS origins without URL userinfo", () => {
  const policy = new NavigationPolicy(["https://www.sisal.it"]);
  assert.equal(policy.isAllowed("https://www.sisal.it/scommesse"), true);
  assert.equal(policy.isAllowed("https://www.sisal.it:443/scommesse"), true);
  assert.equal(policy.isAllowed("http://www.sisal.it/scommesse"), false);
  assert.equal(policy.isAllowed("https://user:secret@www.sisal.it/scommesse"), false);
  assert.equal(policy.isAllowed("https://sub.www.sisal.it/scommesse"), false);
  assert.equal(policy.isAllowed("https://example.invalid/scommesse"), false);
  assert.equal(policy.isAllowed("javascript:alert(1)"), false);
  assert.equal(policy.isAllowed("file:///etc/passwd"), false);
});

test("internal and loopback hosts are rejected independently of origin allowlisting", () => {
  for (const host of ["localhost", "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fd00::1", "fe80::1"]) {
    assert.equal(isInternalHostname(host), true, host);
  }
  assert.throws(() => new NavigationPolicy(["https://127.0.0.1"]));
});


test("resolved target policy fails closed on private, mixed, empty, and failed DNS answers", async () => {
  const publicOnly = new NavigationPolicy(["https://www.sisal.it"], async () => ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
  assert.equal(await publicOnly.isResolvedTargetAllowed("https://www.sisal.it/event"), true);

  const privateOnly = new NavigationPolicy(["https://www.sisal.it"], async () => ["127.0.0.1"]);
  assert.equal(await privateOnly.isResolvedTargetAllowed("https://www.sisal.it/event"), false);

  const mixed = new NavigationPolicy(["https://www.sisal.it"], async () => ["93.184.216.34", "10.0.0.7"]);
  assert.equal(await mixed.isResolvedTargetAllowed("https://www.sisal.it/event"), false);

  const empty = new NavigationPolicy(["https://www.sisal.it"], async () => []);
  assert.equal(await empty.isResolvedTargetAllowed("https://www.sisal.it/event"), false);

  const failed = new NavigationPolicy(["https://www.sisal.it"], async () => { throw new Error("dns failed"); });
  assert.equal(await failed.isResolvedTargetAllowed("https://www.sisal.it/event"), false);
});

test("internal hostname classifier rejects mapped IPv4, IPv6 multicast, and documentation ranges", () => {
  for (const host of ["::ffff:127.0.0.1", "ff02::1", "2001:db8::1", "198.51.100.4", "203.0.113.9"]) {
    assert.equal(isInternalHostname(host), true, host);
  }
});
