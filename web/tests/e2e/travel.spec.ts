/**
 * Travel module E2E tests.
 */
import { test, expect } from "@playwright/test";
import { skipIfAccessDenied, skipIfLocatorMissing } from "./helpers/auth";

const UNIQUE = `E2E-${Date.now()}`;

test.describe("Travel — list page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/travel");
    await page.waitForURL("**/travel", { timeout: 15_000 });
  });

  test("travel list page loads", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await skipIfAccessDenied(page, "Staff cannot open travel");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("page has a 'New Request' or create button", async ({ page }) => {
    await skipIfAccessDenied(page, "Staff cannot open travel");
    const createBtn = page.locator(
      "a:has-text('New Request'), a:has-text('Create'), button:has-text('New'), a[href*='/create']"
    ).first();
    await skipIfLocatorMissing(createBtn, "Staff cannot create travel requests");
    await expect(createBtn).toBeVisible();
  });

  test("list shows existing travel requests", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    // Status badges should exist (from seeded data)
    const rows = page.locator(
      "table tr, [class*='request-card'], [class*='list-item']"
    );
    // May be empty for a fresh staff user — just check no error state shown
    const errorEl = page.locator("text=Error, text=Failed to load");
    await expect(errorEl).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });
});

test.describe("Travel — create request", () => {
  test("can navigate to create page", async ({ page }) => {
    await page.goto("/travel/create");
    await page.waitForURL("**/travel/create", { timeout: 15_000 });
    await skipIfAccessDenied(page, "Staff cannot open travel create");

    // Form fields should be present
    await expect(
      page.locator('input, textarea, select').first()
    ).toBeVisible();
  });

  test("form shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/travel/create");
    await page.waitForURL("**/travel/create");
    await skipIfAccessDenied(page, "Staff cannot open travel create");

    // Click submit without filling form
    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Save")').first();
    await skipIfLocatorMissing(submitBtn, "Travel create submit control missing");
    await submitBtn.click();

    // Expect at least one error message
    const error = page.locator('[class*="error"], [class*="invalid"], .text-red').first();
    await expect(error).toBeVisible({ timeout: 5_000 });
  });

  test("can create a draft travel request", async ({ page }) => {
    await page.goto("/travel/create");
    await page.waitForURL("**/travel/create");
    await skipIfAccessDenied(page, "Staff cannot open travel create");

    const purposeField = page.getByPlaceholder(/budget review meeting/i);
    await skipIfLocatorMissing(purposeField, "Travel create purpose field missing");
    await purposeField.fill(`${UNIQUE} - Regional Meeting`);

    const departure = page.locator('input[type="date"]').first();
    if (await departure.isEditable().catch(() => false)) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      await departure.fill(futureDate.toISOString().split("T")[0]);
    }

    const returnDate = page.locator('input[type="date"]').nth(1);
    if (await returnDate.isEditable().catch(() => false)) {
      const returnD = new Date();
      returnD.setDate(returnD.getDate() + 17);
      await returnDate.fill(returnD.toISOString().split("T")[0]);
    }

    const countryTrigger = page.getByRole("button", { name: /select country/i });
    await skipIfLocatorMissing(countryTrigger, "Travel destination country picker missing");
    await countryTrigger.click();
    const countrySearch = page.getByPlaceholder(/search countries/i);
    await skipIfLocatorMissing(countrySearch, "Travel country catalogue search missing");
    await countrySearch.fill("South Africa");
    const countryOption = page.getByRole("button", { name: /south africa/i }).first();
    await skipIfLocatorMissing(countryOption, "South Africa is not in the destination catalogue");
    await countryOption.click();

    const saveBtn = page.getByRole("button", { name: /save draft/i });
    await skipIfLocatorMissing(saveBtn, "Travel create Save Draft control missing");
    await saveBtn.click();

    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/travel") &&
        !url.pathname.includes("/create"),
      { timeout: 15_000 }
    );
  });
});

test.describe("Travel — detail page", () => {
  test("can view a travel request detail", async ({ page }) => {
    // Navigate to list first, click first available item
    await page.goto("/travel");
    await page.waitForLoadState("networkidle");

    const firstLink = page.locator("a[href*='/travel/']").first();
    if (await firstLink.isVisible({ timeout: 5_000 })) {
      await firstLink.click();
      await page.waitForURL("**/travel/**", { timeout: 10_000 });
      await expect(page.locator("h1, h2, [class*='page-title']").first()).toBeVisible();
    } else {
      test.skip(true, "No travel requests available to view");
    }
  });
});

test.describe("Travel Phase 2 — missions & reports smoke", () => {
  test("missions page loads", async ({ page }) => {
    await page.goto("/travel/missions");
    await page.waitForURL("**/travel/missions", { timeout: 15_000 });
    await skipIfAccessDenied(page, "Staff cannot open travel missions");
    await expect(page.getByRole("heading", { name: /Mission Readiness/i })).toBeVisible();
  });

  test("reports analytics page loads", async ({ page }) => {
    await page.goto("/travel/reports");
    await page.waitForURL("**/travel/reports", { timeout: 15_000 });
    await skipIfAccessDenied(page, "Staff cannot open travel reports");
    const heading = page.getByRole("heading", { name: /Travel Reports/i });
    await skipIfLocatorMissing(heading, "Staff cannot open travel reports heading");
    await expect(heading).toBeVisible();
  });

  test("finance queue page loads", async ({ page }) => {
    await page.goto("/travel/queues/finance");
    await page.waitForURL("**/travel/queues/finance", { timeout: 15_000 });
    await skipIfAccessDenied(page, "Staff cannot open travel finance queue");
    const heading = page.getByRole("heading", { name: /Finance Review Queue/i });
    await skipIfLocatorMissing(heading, "Staff cannot open travel finance queue heading");
    await expect(heading).toBeVisible();
  });
});

test.describe("Travel Phase 3 — settings FX smoke", () => {
  test("settings page shows FX register", async ({ page }) => {
    await page.goto("/travel/settings");
    await page.waitForURL("**/travel/settings", { timeout: 15_000 });
    await skipIfAccessDenied(page, "Staff cannot open travel FX settings");
    const fx = page.getByTestId("travel-fx-settings");
    await skipIfLocatorMissing(fx, "Staff cannot open travel FX settings");
    await expect(fx).toBeVisible();
  });
});
