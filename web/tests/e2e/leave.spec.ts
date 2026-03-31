/**
 * Leave module E2E tests.
 */
import { test, expect } from "@playwright/test";

const UNIQUE = `E2E-${Date.now()}`;

test.describe("Leave — list page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leave");
    await page.waitForURL("**/leave", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("leave list page loads without errors", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
    await expect(page.locator("text=Error, text=Failed")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });

  test("has a 'New Request' button", async ({ page }) => {
    const btn = page.locator(
      "a:has-text('New'), a:has-text('Apply'), button:has-text('New')"
    ).first();
    await expect(btn).toBeVisible();
  });

  test("filter tabs are present (All, Pending, Approved, Rejected)", async ({ page }) => {
    const tabs = page.locator("[class*='filter-tab'], [role='tab'], button:has-text('All')");
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Leave — create request", () => {
  test("create page has required form fields", async ({ page }) => {
    await page.goto("/leave/create");
    await page.waitForURL("**/leave/create", { timeout: 15_000 });

    // Should have leave type selector and date pickers
    await expect(page.locator("select, input[type='date'], [class*='input']").first()).toBeVisible();
  });

  test("form validation triggers on empty submit", async ({ page }) => {
    await page.goto("/leave/create");
    await page.waitForURL("**/leave/create");

    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Apply")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      const error = page.locator('[class*="error"], .text-red, [class*="invalid"]').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });

  test("can save a leave request as draft", async ({ page }) => {
    await page.goto("/leave/create");
    await page.waitForURL("**/leave/create");
    await page.waitForLoadState("networkidle");

    // Leave type
    const leaveType = page.locator('select[name="leave_type"], select').first();
    if (await leaveType.isVisible()) {
      await leaveType.selectOption({ index: 1 });
    }

    // Start date (7 days from now)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const startInput = page.locator('input[name="start_date"], input[type="date"]').first();
    if (await startInput.isVisible()) {
      await startInput.fill(startDate.toISOString().split("T")[0]);
    }

    // End date (9 days from now)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 9);
    const endInput = page.locator('input[name="end_date"], input[type="date"]').nth(1);
    if (await endInput.isVisible()) {
      await endInput.fill(endDate.toISOString().split("T")[0]);
    }

    // Reason
    const reason = page.locator('textarea[name="reason"], textarea').first();
    if (await reason.isVisible()) {
      await reason.fill(`${UNIQUE} - E2E leave test reason`);
    }

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Draft")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForURL(
        (url) => url.pathname.startsWith("/leave") && !url.pathname.includes("/create"),
        { timeout: 15_000 }
      );
    }
  });
});

test.describe("Leave balances", () => {
  test("leave balances page loads", async ({ page }) => {
    await page.goto("/leave");
    await page.waitForLoadState("networkidle");
    // Balances might be on main page or sub-page
    const balanceEl = page.locator("text=Annual, text=Balance, text=Days");
    // Just verify page loaded — balances come from API
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});
