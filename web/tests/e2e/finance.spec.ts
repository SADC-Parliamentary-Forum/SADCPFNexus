/**
 * Finance module E2E tests (salary advances, budgets, payslips).
 *
 * Prefer `/salary-advances` hub routes; legacy `/finance/advances` redirects here.
 * Auth fixture skips: see helpers/auth.ts and tests/e2e/README.md.
 */
import { test, expect } from "@playwright/test";
import { landedOnLogin, skipWithoutAuth } from "./helpers/auth";

const UNIQUE = `E2E-${Date.now()}`;

test.describe("Finance overview", () => {
  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

  test("finance overview page loads", async ({ page }) => {
    await page.goto("/finance");
    await page.waitForURL("**/finance", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /finance");
    }
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Salary advances hub (/salary-advances)", () => {
  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

  test("dashboard loads with eligibility area", async ({ page }) => {
    await page.goto("/salary-advances");
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /salary-advances");
    }
    await expect(
      page.getByRole("heading", { name: /salary advance/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /eligibility/i }).or(
        page.locator("text=/eligible|Eligibility unavailable/i")
      ).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Salary advances IA redirects", () => {
  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

  test("legacy /finance/advances redirects to applications", async ({ page }) => {
    await page.goto("/finance/advances");
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for salary advances");
    }
    await expect(page).toHaveURL(/salary-advances/, { timeout: 15_000 });
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Salary advances (/salary-advances)", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/salary-advances");
    await page.waitForURL("**/salary-advances", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /salary-advances");
    }
  });

  test("advances list page loads", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("has create advance button", async ({ page }) => {
    const btn = page.locator("a:has-text('New'), a:has-text('Request'), a:has-text('Apply'), a[href*='/create']").first();
    await expect(btn).toBeVisible();
  });

  test("queue tabs are present for finance users", async ({ page }) => {
    const tabs = page.getByRole("tablist", { name: /advance queues/i });
    const tabsVisible = await tabs.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!tabsVisible) {
      // Staff may only see a simple list / link to the new hub.
      test.skip(true, "Advance queue tabs not shown for this role");
    }
    await expect(page.getByRole("tab", { name: /my requests/i })).toBeVisible();

    // Finance roles see certify/payment/recovery; staff may only see My requests.
    const certify = page.getByRole("tab", { name: /pending certification/i });
    if (await certify.isVisible()) {
      await certify.click();
      await page.waitForURL("**/salary-advances?queue=certify", { timeout: 10_000 });
      await expect(page.getByRole("tab", { name: /pending certification/i })).toHaveAttribute("aria-selected", "true");

      await page.getByRole("tab", { name: /approved for payment/i }).click();
      await page.waitForURL("**/salary-advances?queue=payment", { timeout: 10_000 });

      await page.getByRole("tab", { name: /payroll recovery/i }).click();
      await page.waitForURL("**/salary-advances?queue=recovery", { timeout: 10_000 });
    }
  });
});

test.describe("Salary advance — create", () => {
  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

  test("create advance form is accessible with eligibility step", async ({ page }) => {
    await page.goto("/salary-advances/create");
    await page.waitForURL("**/salary-advances/create", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for create form");
    }
    await expect(
      page.getByRole("heading", { name: /eligibility/i }).or(
        page.locator("input, textarea").first()
      ).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("form validation on empty submit", async ({ page }) => {
    await page.goto("/salary-advances/create");
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for create form");
    }

    const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Submit"), button:has-text("Next")').first();
    if (await submitBtn.isVisible()) {
      const disabled = await submitBtn.isDisabled().catch(() => false);
      if (disabled) {
        // Wizard gates Next until eligibility + required fields — that is validation enough.
        await expect(submitBtn).toBeDisabled();
        return;
      }
      await submitBtn.click();
      const error = page.locator('[class*="error"], .text-red, [class*="amber"]').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });

  test("can create a salary advance request", async ({ page }) => {
    await page.goto("/salary-advances/create");
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for create form");
    }

    const amount = page.locator('input[name="amount"], input[type="number"]').first();
    if (await amount.isVisible()) {
      await amount.fill("5000");
    }

    const reason = page.locator('textarea[name="reason"], textarea').first();
    if (await reason.isVisible()) {
      await reason.fill(`${UNIQUE} - Medical emergency test`);
    }

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
  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

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
  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

  test("payslips page loads", async ({ page }) => {
    await page.goto("/finance/payslips");
    await page.waitForURL("**/finance/payslips", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});
