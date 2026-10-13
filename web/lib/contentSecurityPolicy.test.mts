import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentSecurityPolicy, createCspNonce } from "./contentSecurityPolicy.ts";

function directive(csp: string, name: string): string {
  return csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
}

test("script-src uses the nonce and never unsafe-inline or unsafe-eval", () => {
  const csp = buildContentSecurityPolicy("abc123");
  const scriptSrc = directive(csp, "script-src");
  assert.match(scriptSrc, /'nonce-abc123'/);
  assert.doesNotMatch(scriptSrc, /unsafe-inline|unsafe-eval/);
});

test("connect-src is limited to self, the public API origin and captcha hosts", () => {
  const csp = buildContentSecurityPolicy("n", "https://nexus-api.sadcpf.org/api/v1");
  const connectSrc = directive(csp, "connect-src");
  assert.match(connectSrc, /https:\/\/nexus-api\.sadcpf\.org(\s|$)/);
  assert.doesNotMatch(connectSrc, /\shttps:(\s|$)/);
});

test("invalid public API URLs are ignored", () => {
  assert.equal(directive(buildContentSecurityPolicy("n", "javascript:alert(1)"), "connect-src").includes("javascript"), false);
  assert.equal(directive(buildContentSecurityPolicy("n", "not a url"), "connect-src").includes("not"), false);
});

test("nonces are unique base64 values", () => {
  const a = createCspNonce();
  const b = createCspNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
});
