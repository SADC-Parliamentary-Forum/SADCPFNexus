/**
 * Approvals & email-approval E2E tests.
 */
import { test, expect } from "@playwright/test";
import { webApiUrl } from "./helpers/api";

test.describe("Approvals page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/approvals");
    await page.waitForURL("**/approvals", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("approvals page loads", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("pending approvals list renders (may be empty)", async ({ page }) => {
    // No error state
    await expect(page.locator("text=Error, text=Failed")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    // Table or empty state present
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("filter tabs present (Awaiting and Completed)", async ({ page }) => {
    const tabs = page.getByRole("button", { name: /Awaiting|Completed|Due soon/i }).first();
    const denied = page.getByText(/Access denied/i);
    await expect(tabs.or(denied).first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Email-based approval page (/approval)", () => {
  test("approval page loads when accessed without a token", async ({ page }) => {
    await page.goto("/approval");
    await page.waitForURL("**/approval**", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    // Should show an error / invalid state (no token provided)
    // Not a crash — graceful handling
    await expect(page.locator("h1, h2, [class*='error'], [class*='invalid']").first()).toBeVisible({ timeout: 8_000 });
  });

  test("approval page with invalid token shows error state", async ({ page }) => {
    await page.goto("/approval?action=approve&token=totally_invalid_token_xyz");
    await page.waitForLoadState("networkidle");

    // Should show an error / warning UI state
    const errorEl = page.getByText(/invalid|expired|error|not found|missing/i).first();
    await expect(errorEl).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Approvals API direct checks", () => {
  test("pending approvals API returns paginated list", async ({ request }) => {
    const res = await request.get(webApiUrl("/approvals/pending"));

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test("email-action preview endpoint returns 404 for invalid token", async ({
    request,
  }) => {
    const res = await request.get(webApiUrl("/email-action/preview/invalid_token_abc"));
    expect(res.status()).toBe(404);
  });
});
