/**
 * Lightweight API helpers for Playwright tests.
 * Uses Playwright's APIRequestContext so all calls share cookies/headers.
 *
 * Browser login stores Sanctum session cookies on the Next.js origin
 * (`http://localhost:3000`). Direct calls to Laravel (`:8000/api/v1`) do not
 * send those cookies. Hit the Next rewrite prefix `/api/...` instead.
 */
import { APIRequestContext } from "@playwright/test";

/** Same-origin prefix that Next rewrites to Laravel `/api/v1`. */
export const WEB_API_PREFIX = "/api";

export function webApiUrl(path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${WEB_API_PREFIX}${normalised}`;
}

const WEB_ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/** Sanctum SPA auth requires Origin/Referer on the Next origin, not Laravel. */
export function webApiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: WEB_ORIGIN,
    Referer: `${WEB_ORIGIN}/`,
    "X-Requested-With": "XMLHttpRequest",
    ...extra,
  };
}

export function apiClient(request: APIRequestContext) {
  const headers = webApiHeaders();

  return {
    async get(path: string) {
      return request.get(webApiUrl(path), { headers });
    },
    async post(path: string, data: object = {}) {
      return request.post(webApiUrl(path), {
        headers,
        data,
      });
    },
    async put(path: string, data: object = {}) {
      return request.put(webApiUrl(path), {
        headers,
        data,
      });
    },
    async delete(path: string) {
      return request.delete(webApiUrl(path), { headers });
    },
  };
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
