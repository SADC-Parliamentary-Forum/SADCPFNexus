/**
 * Lightweight API helpers for Playwright tests.
 *
 * Authenticated calls MUST go through the Next.js origin (`/api/...`) so the
 * Sanctum session cookie (set on :3000) is sent. Direct calls to :8000 are a
 * different origin, so SameSite cookies are dropped.
 *
 * Next rewrite: `/api/:path*` → Laravel `/api/v1/:path*`.
 *
 * Playwright's isolated `request` fixture often omits the browser session
 * even with storageState. Prefer `browserApiGet(page, path)` after a
 * same-origin navigation.
 */
import { APIRequestContext, Page, test } from "@playwright/test";

function origin(): string {
  return (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Same-origin API root used by the Next rewrite (axios `baseURL: "/api"`). */
export function apiRoot(): string {
  return `${origin()}/api`;
}

export function apiClient(request: APIRequestContext) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async get(path: string) {
      return request.get(`${apiRoot()}${path}`, { headers });
    },
    async post(path: string, data: object = {}) {
      return request.post(`${apiRoot()}${path}`, { headers, data });
    },
    async put(path: string, data: object = {}) {
      return request.put(`${apiRoot()}${path}`, { headers, data });
    },
    async delete(path: string) {
      return request.delete(`${apiRoot()}${path}`, { headers });
    },
  };
}

export type BrowserApiResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

/** In-page fetch so the real browser cookies (and CSRF) are sent. */
export async function browserApiGet(page: Page, path: string): Promise<BrowserApiResult> {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return page.evaluate(async (p) => {
    const res = await fetch(`/api${p}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON */
    }
    return { ok: res.ok, status: res.status, body };
  }, suffix);
}

/** Skip when the fixture user is not allowed to call this API. */
export function skipIfApiForbidden(result: BrowserApiResult, path: string): void {
  if (result.status === 401 || result.status === 403) {
    test.skip(true, `${path} returned ${result.status} for this role`);
  }
}

/** Wait for the page to show a toast or success indicator */
export async function waitForToast(
  page: import("@playwright/test").Page,
  text?: string
) {
  const locator = text
    ? page.locator(`[role="status"]:has-text("${text}")`)
    : page.locator('[role="status"]');
  await locator.waitFor({ state: "visible", timeout: 10_000 });
}
