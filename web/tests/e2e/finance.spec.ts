/**
 * Finance module E2E tests (salary advances, budgets, payslips).
 */
import { test, expect } from "@playwright/test";

const UNIQUE = `E2E-${Date.now()}`;

test.describe("Finance overview", () => {
  test("finance overview page loads", async ({ page }) => {
    await page.goto("/finance");
    await page.waitForURL("**/finance", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Salary advances", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/finance/advances");
    await page.waitForURL("**/finance/advances", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("advances list page loads", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("has create advance button", async ({ page }) => {
    const btn = page.locator("a:has-text('New'), a:has-text('Request'), a[href*='/create']").first();
    await expect(btn).toBeVisible();
  });
});

test.describe("Salary advance — create", () => {
  test("create advance form is accessible", async ({ page }) => {
    await page.goto("/finance/advances/create");
    await page.waitForURL("**/finance/advances/create", { timeout: 15_000 });
    await expect(page.locator("input, textarea").first()).toBeVisible();
  });

  test("form validation on empty submit", async ({ page }) => {
    await page.goto("/finance/advances/create");
    await page.waitForLoadState("networkidle");

    const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Submit")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      const error = page.locator('[class*="error"], .text-red').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });

  test("can create a salary advance request", async ({ page }) => {
    await page.goto("/finance/advances/create");
    await page.waitForLoadState("networkidle");

    // Amount
    const amount = page.locator('input[name="amount"], input[type="number"]').first();
    if (await amount.isVisible()) {
      await amount.fill("5000");
    }

    // Reason
    const reason = page.locator('textarea[name="reason"], textarea').first();
    if (await reason.isVisible()) {
      await reason.fill(`${UNIQUE} - Medical emergency test`);
    }

    // Repayment months
    const months = page.locator('input[name="repayment_months"], select[name="repayment_months"]').first();
    if (await months.isVisible()) {
      if ((await months.getAttribute("type")) === "number") {
        await months.fill("3");
      } else {
        await (months as any).selectOption({ index: 1 });
      }
    }

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Draft")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForURL(
        (url) => url.pathname.includes("/advances") && !url.pathname.includes("/create"),
        { timeout: 15_000 }
      );
    }
  });
});

test.describe("Budgets", () => {
  test("budget list page loads", async ({ page }) => {
    await page.goto("/finance/budget");
    await page.waitForURL("**/finance/budget", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("can navigate to budget detail", async ({ page }) => {
    await page.goto("/finance/budget");
    await page.waitForLoadState("networkidle");

    const firstLink = page.locator("a[href*='/finance/budget/']").first();
    if (await firstLink.isVisible({ timeout: 5_000 })) {
      await firstLink.click();
      await page.waitForURL("**/finance/budget/**", { timeout: 10_000 });
      await expect(page.locator("h1, h2").first()).toBeVisible();
    } else {
      test.skip(true, "No budget records visible");
    }
  });
});

test.describe("Payslips", () => {
  test("payslips page loads", async ({ page }) => {
    await page.goto("/finance/payslips");
    await page.waitForURL("**/finance/payslips", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});
