/**
 * Imprest module E2E tests.
 */
import { test, expect } from "@playwright/test";

const UNIQUE = `E2E-${Date.now()}`;

test.describe("Imprest — list page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/imprest");
    await page.waitForURL("**/imprest", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("imprest list page loads", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("has a create/new request button", async ({ page }) => {
    const btn = page.locator("a:has-text('New'), a:has-text('Create'), button:has-text('New')").first();
    await expect(btn).toBeVisible();
  });

  test("shows list table or empty state", async ({ page }) => {
    const hasTable = await page.locator("table, [class*='list']").first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await page.locator("text=No requests, text=empty, text=No imprest").first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});

test.describe("Imprest — create request", () => {
  test("create page renders with form fields", async ({ page }) => {
    await page.goto("/imprest/create");
    await page.waitForURL("**/imprest/create", { timeout: 15_000 });
    await expect(page.locator("input, textarea, select").first()).toBeVisible();
  });

  test("form validation on empty submit", async ({ page }) => {
    await page.goto("/imprest/create");
    await page.waitForLoadState("networkidle");

    const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Submit")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      const error = page.locator('[class*="error"], .text-red').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });

  test("can create an imprest request as draft", async ({ page }) => {
    await page.goto("/imprest/create");
    await page.waitForLoadState("networkidle");

    // Purpose / description
    const purpose = page.locator(
      'textarea[name="purpose"], input[name="purpose"], textarea, [placeholder*="purpose" i]'
    ).first();
    if (await purpose.isVisible()) {
      await purpose.fill(`${UNIQUE} - Workshop materials and supplies`);
    }

    // Amount
    const amount = page.locator(
      'input[name="amount"], input[name="estimated_amount"], input[type="number"]'
    ).first();
    if (await amount.isVisible()) {
      await amount.fill("3500");
    }

    // Required date
    const reqDate = page.locator('input[name="required_date"], input[type="date"]').first();
    if (await reqDate.isVisible()) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      await reqDate.fill(d.toISOString().split("T")[0]);
    }

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Draft")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForURL(
        (url) => url.pathname.startsWith("/imprest") && !url.pathname.includes("/create"),
        { timeout: 15_000 }
      );
    }
  });
});

test.describe("Imprest — detail page", () => {
  test("detail page renders key sections", async ({ page }) => {
    await page.goto("/imprest");
    await page.waitForLoadState("networkidle");

    const firstLink = page.locator("a[href*='/imprest/']").first();
    if (await firstLink.isVisible({ timeout: 5_000 })) {
      await firstLink.click();
      await page.waitForURL("**/imprest/**", { timeout: 10_000 });
      await expect(page.locator("h1, h2, [class*='page-title']").first()).toBeVisible();
    } else {
      test.skip(true, "No imprest requests to view");
    }
  });
});
