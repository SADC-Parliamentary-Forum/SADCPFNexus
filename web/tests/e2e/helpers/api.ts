/**
 * Lightweight API helpers for Playwright tests.
 * Uses Playwright's APIRequestContext so all calls share cookies/headers.
 */
import { APIRequestContext, expect } from "@playwright/test";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export function apiClient(request: APIRequestContext, token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async get(path: string) {
      const res = await request.get(`${API_BASE}${path}`, { headers });
      return res;
    },
    async post(path: string, data: object = {}) {
      const res = await request.post(`${API_BASE}${path}`, {
        headers,
        data,
      });
      return res;
    },
    async put(path: string, data: object = {}) {
      const res = await request.put(`${API_BASE}${path}`, {
        headers,
        data,
      });
      return res;
    },
    async delete(path: string) {
      const res = await request.delete(`${API_BASE}${path}`, { headers });
      return res;
    },
  };
}

/** Get the stored auth token from localStorage (call inside page.evaluate) */
export const GET_TOKEN_JS = `localStorage.getItem('sadcpf_token')`;

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
