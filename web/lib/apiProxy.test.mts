import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  rewriteSetCookie,
  buildUpstreamHeaders,
  resolveApiUpstream,
  applyUpstreamSetCookies,
  proxyLaravel,
  resolvePublicHop,
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

test("rewriteSetCookie keeps upstream Secure when the Next hop itself is HTTP", () => {
  const raw = "XSRF-TOKEN=abc; path=/; secure; samesite=lax";
  const rewritten = rewriteSetCookie(raw, { publicHost: "nexus.sadcpf.org", secure: false });
  assert.match(rewritten, /secure/i);
});

test("resolvePublicHop prefers the browser Origin over the CloudPanel loopback host", () => {
  const hop = resolvePublicHop(
    new Request("http://127.0.0.1:3000/sanctum/csrf-cookie", {
      headers: {
        origin: "https://nexus.sadcpf.org",
        host: "127.0.0.1:3000",
      },
    }),
  );
  assert.equal(hop.publicHost, "nexus.sadcpf.org");
  assert.equal(hop.proto, "https");
  assert.equal(hop.secure, true);
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

test("proxyLaravel forwards the browser hop and rewrites upstream Set-Cookie Domain", async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.origin, "https://nexus.sadcpf.org");
    assert.equal(req.headers["x-forwarded-host"], "nexus.sadcpf.org");
    assert.equal(req.headers["x-forwarded-proto"], "https");
    assert.equal(req.headers.cookie, "XSRF-TOKEN=tok");
    assert.match(req.url ?? "", /\/sanctum\/csrf-cookie$/);
    res.statusCode = 204;
    res.setHeader("Set-Cookie", [
      "XSRF-TOKEN=abc; path=/; domain=10.20.30.8; secure; samesite=lax",
      "sadc-pf-nexus-session=xyz; path=/; domain=nexus-api.sadcpf.org; httponly; samesite=lax",
    ]);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const previous = process.env.API_INTERNAL_URL;
  process.env.API_INTERNAL_URL = `http://127.0.0.1:${port}/api/v1`;
  try {
    const response = await proxyLaravel(
      new Request("https://nexus.sadcpf.org/sanctum/csrf-cookie", {
        headers: {
          origin: "https://nexus.sadcpf.org",
          host: "nexus.sadcpf.org",
          cookie: "XSRF-TOKEN=tok",
          "x-forwarded-proto": "https",
        },
      }),
    );
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("x-sadcpf-api-proxy"), "1");
    const cookies = response.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    for (const cookie of cookies) {
      assert.doesNotMatch(cookie, /domain=/i);
      assert.doesNotMatch(cookie, /10\.20\.30\.8/);
      assert.doesNotMatch(cookie, /nexus-api\.sadcpf\.org/);
    }
  } finally {
    if (previous === undefined) {
      delete process.env.API_INTERNAL_URL;
    } else {
      process.env.API_INTERNAL_URL = previous;
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("proxyLaravel advertises the SPA origin when CloudPanel talks to Next over HTTP", async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.headers["x-forwarded-host"], "nexus.sadcpf.org");
    assert.equal(req.headers["x-forwarded-proto"], "https");
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const previous = process.env.API_INTERNAL_URL;
  process.env.API_INTERNAL_URL = `http://127.0.0.1:${port}/api/v1`;
  try {
    const response = await proxyLaravel(
      new Request("http://127.0.0.1:3000/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://nexus.sadcpf.org",
          referer: "https://nexus.sadcpf.org/login",
          host: "127.0.0.1:3000",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-sadcpf-api-proxy"), "1");
  } finally {
    if (previous === undefined) {
      delete process.env.API_INTERNAL_URL;
    } else {
      process.env.API_INTERNAL_URL = previous;
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
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
