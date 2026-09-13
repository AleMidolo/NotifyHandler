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
