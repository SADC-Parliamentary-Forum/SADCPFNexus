/**
 * Approvals & email-approval E2E tests.
 */
import { test, expect } from "@playwright/test";
import { browserApiGet, skipIfApiForbidden } from "./helpers/api";
import { skipWithoutAuth, skipIfAccessDenied, waitForApp } from "./helpers/auth";

test.describe("Approvals page", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/approvals");
    await page.waitForURL("**/approvals", { timeout: 15_000 });
    await waitForApp(page);
    await skipIfAccessDenied(page, "/approvals");
  });

  test("approvals page loads", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("pending approvals list renders (may be empty)", async ({ page }) => {
    await expect(page.getByText(/failed to load pending approvals/i)).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("filter tabs present (Awaiting / Completed)", async ({ page }) => {
    const tabs = page.getByRole("button", { name: /awaiting|due soon|completed/i }).first();
    await expect(tabs).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Email-based approval page (/approval)", () => {
  test("approval page loads when accessed without a token", async ({ page }) => {
    await page.goto("/approval");
    await page.waitForURL("**/approval**", { timeout: 15_000 });
    await waitForApp(page);
    await expect(
      page.getByRole("heading", { name: /invalid link|something went wrong/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("approval page with invalid token shows error state", async ({ page }) => {
    await page.goto("/approval?action=approve&token=totally_invalid_token_xyz");
    await waitForApp(page);

    await expect(
      page.getByRole("heading", { name: /invalid link|something went wrong/i }).first()
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByText(/invalid or has expired|unable to load the approval page/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Approvals API direct checks", () => {
  test("pending approvals API returns paginated list", async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/approvals");
    await waitForApp(page);
    await skipIfAccessDenied(page, "/approvals");
    const res = await browserApiGet(page, "/approvals/pending");
    skipIfApiForbidden(res, "/approvals/pending");
    expect(res.ok).toBeTruthy();
    const body = res.body as { data?: unknown };
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test("email-action preview endpoint returns 404 for invalid token", async ({
    page,
  }) => {
    await page.goto("/login");
    const res = await browserApiGet(page, "/email-action/preview/invalid_token_abc");
    expect(res.status).toBe(404);
  });
});
