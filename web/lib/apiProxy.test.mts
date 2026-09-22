import assert from "node:assert/strict";
import test from "node:test";
import {
  rewriteSetCookie,
  buildUpstreamHeaders,
  resolveApiUpstream,
  applyUpstreamSetCookies,
} from "./apiProxy.ts";

test("rewriteSetCookie drops internal API host so the browser binds the SPA origin", () => {
  const raw =
    "XSRF-TOKEN=abc; expires=Tue, 22 Sep 2026 12:00:00 GMT; Max-Age=7200; path=/; domain=10.20.30.8; secure; samesite=strict";
  const rewritten = rewriteSetCookie(raw, { publicHost: "nexus.sadcpf.org", secure: true });
  assert.match(rewritten, /XSRF-TOKEN=abc/);
  assert.doesNotMatch(rewritten, /10\.20\.30\.8/i);
  assert.doesNotMatch(rewritten, /domain=/i);
  assert.match(rewritten, /secure/i);
});

test("rewriteSetCookie strips the public API hostname from Domain", () => {
  const raw = "sadc-pf-nexus-session=xyz; path=/; domain=nexus-api.sadcpf.org; httponly; samesite=strict";
  const rewritten = rewriteSetCookie(raw, { publicHost: "nexus.sadcpf.org", secure: true });
  assert.doesNotMatch(rewritten, /nexus-api\.sadcpf\.org/i);
  assert.doesNotMatch(rewritten, /domain=/i);
  assert.match(rewritten, /httponly/i);
});

test("buildUpstreamHeaders forwards cookies and advertises the browser host", () => {
  const headers = buildUpstreamHeaders(
    new Headers({
      cookie: "XSRF-TOKEN=tok; sadc-pf-nexus-session=sess",
      origin: "https://nexus.sadcpf.org",
      referer: "https://nexus.sadcpf.org/login",
      "x-xsrf-token": "tok",
      accept: "application/json",
      host: "nexus.sadcpf.org",
      connection: "keep-alive",
      "x-forwarded-for": "203.0.113.50",
    }),
    { publicHost: "nexus.sadcpf.org", proto: "https" },
  );
  assert.equal(headers.get("cookie"), "XSRF-TOKEN=tok; sadc-pf-nexus-session=sess");
  assert.equal(headers.get("origin"), "https://nexus.sadcpf.org");
  assert.equal(headers.get("x-forwarded-host"), "nexus.sadcpf.org");
  assert.equal(headers.get("x-forwarded-proto"), "https");
  assert.equal(headers.get("x-forwarded-for"), "203.0.113.50");
  assert.equal(headers.get("x-xsrf-token"), "tok");
  assert.equal(headers.get("connection"), null);
  assert.equal(headers.get("host"), null);
});

test("resolveApiUpstream maps Next /api and /sanctum paths onto the Laravel origin", () => {
  const api = resolveApiUpstream("/api/auth/login", "http://10.20.30.8/api/v1");
  assert.equal(api, "http://10.20.30.8/api/v1/auth/login");
  const csrf = resolveApiUpstream("/sanctum/csrf-cookie", "http://10.20.30.8/api/v1");
  assert.equal(csrf, "http://10.20.30.8/sanctum/csrf-cookie");
});

test("applyUpstreamSetCookies copies every Set-Cookie and strips internal Domain", () => {
  const upstream = new Headers();
  upstream.append(
    "set-cookie",
    "XSRF-TOKEN=abc; path=/; domain=10.20.30.8; secure; samesite=lax",
  );
  upstream.append(
    "set-cookie",
    "sadc-pf-nexus-session=xyz; path=/; domain=nexus-api.sadcpf.org; httponly; samesite=lax",
  );
  const outgoing = new Headers();
  applyUpstreamSetCookies(upstream, outgoing, { publicHost: "nexus.sadcpf.org", secure: true });
  const cookies = outgoing.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /XSRF-TOKEN=abc/);
  assert.match(cookies[1], /sadc-pf-nexus-session=xyz/);
  for (const cookie of cookies) {
    assert.doesNotMatch(cookie, /domain=/i);
    assert.match(cookie, /secure/i);
  }
});
