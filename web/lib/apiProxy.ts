const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export type CookieRewriteOptions = {
  publicHost: string;
  secure: boolean;
};

export type UpstreamHeaderOptions = {
  publicHost: string;
  proto: string;
};

export function rewriteSetCookie(raw: string, options: CookieRewriteOptions): string {
  const parts = raw.split(";").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return raw;
  }

  const nameValue = parts[0];
  const attributes: string[] = [];
  let hasSecure = false;

  for (const attribute of parts.slice(1)) {
    const [rawKey] = attribute.split("=");
    const key = rawKey.trim().toLowerCase();
    if (key === "domain") {
      continue;
    }
    if (key === "secure") {
      hasSecure = true;
    }
    attributes.push(attribute);
  }

  if (options.secure && !hasSecure) {
    attributes.push("secure");
  }

  return [nameValue, ...attributes].join("; ");
}

export function buildUpstreamHeaders(
  incoming: Headers,
  options: UpstreamHeaderOptions,
): Headers {
  const headers = new Headers();
  incoming.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return;
    }
    headers.set(key, value);
  });
  headers.set("x-forwarded-host", options.publicHost);
  headers.set("x-forwarded-proto", options.proto);
  return headers;
}

export function resolveApiUpstream(path: string, apiInternalUrl: string): string {
  const base = apiInternalUrl.replace(/\/$/, "");
  const origin = new URL(base).origin;
  if (path === "/sanctum/csrf-cookie" || path.startsWith("/sanctum/")) {
    return `${origin}${path}`;
  }
  const suffix = path.replace(/^\/api(?=\/|$)/, "");
  return `${base}${suffix}`;
}

export function applyUpstreamSetCookies(
  upstream: Headers,
  outgoing: Headers,
  options: CookieRewriteOptions,
): void {
  const cookies = typeof upstream.getSetCookie === "function" ? upstream.getSetCookie() : [];
  for (const cookie of cookies) {
    outgoing.append("set-cookie", rewriteSetCookie(cookie, options));
  }
}

function firstForwardedValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function parseBrowserOrigin(request: Request): { host: string; proto: string } | null {
  const raw = request.headers.get("origin") || request.headers.get("referer");
  if (!raw) {
    return null;
  }
  try {
    const parsed = new URL(raw);
    if (!parsed.host) {
      return null;
    }
    return { host: parsed.host, proto: parsed.protocol.replace(":", "") };
  } catch {
    return null;
  }
}

export function resolvePublicHop(request: Request): CookieRewriteOptions & { proto: string } {
  const url = new URL(request.url);
  const browser = parseBrowserOrigin(request);
  const publicHost =
    browser?.host
    ?? firstForwardedValue(request.headers.get("x-forwarded-host"))
    ?? request.headers.get("host")
    ?? url.host;
  const proto =
    browser?.proto
    ?? firstForwardedValue(request.headers.get("x-forwarded-proto"))
    ?? url.protocol.replace(":", "");
  return { publicHost, proto, secure: proto === "https" };
}

export async function proxyLaravel(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000/api/v1";
  const upstreamUrl = `${resolveApiUpstream(url.pathname, apiInternalUrl)}${url.search}`;
  const hop = resolvePublicHop(request);
  const headers = buildUpstreamHeaders(request.headers, {
    publicHost: hop.publicHost,
    proto: hop.proto,
  });

  if (!headers.has("x-forwarded-for")) {
    const forwarded =
      firstForwardedValue(request.headers.get("x-real-ip"))
      ?? "127.0.0.1";
    headers.set("x-forwarded-for", forwarded);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(upstreamUrl, init);
  const outgoing = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie" || HOP_BY_HOP_HEADERS.has(lower)) {
      return;
    }
    outgoing.append(key, value);
  });
  applyUpstreamSetCookies(upstream.headers, outgoing, hop);
  outgoing.set("x-sadcpf-api-proxy", "1");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outgoing,
  });
}
