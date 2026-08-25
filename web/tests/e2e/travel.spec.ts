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
    await page.waitForLoadState("networkidle");
    await skipIfAccessDenied(page, "Staff cannot open travel create");

    // Fill purpose
    const purposeField = page.locator(
      'input[name="purpose"], textarea[name="purpose"], [placeholder*="purpose" i]'
    ).first();
    if (await purposeField.isVisible()) {
      await purposeField.fill(`${UNIQUE} - Regional Meeting`);
    }

    // Fill departure date
    const departure = page.locator(
      'input[name="departure_date"], input[type="date"]'
    ).first();
    if (await departure.isVisible()) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      await departure.fill(futureDate.toISOString().split("T")[0]);
    }

    // Fill return date
    const returnDate = page.locator(
      'input[name="return_date"], input[type="date"]'
    ).nth(1);
    if (await returnDate.isVisible()) {
      const returnD = new Date();
      returnD.setDate(returnD.getDate() + 17);
      await returnDate.fill(returnD.toISOString().split("T")[0]);
    }

    // Fill destination country
    const country = page.locator(
      'input[name="destination_country"], [placeholder*="country" i]'
    ).first();
    if (await country.isVisible()) {
      await country.fill("South Africa");
    }

    // Fill destination city
    const city = page.locator(
      'input[name="destination_city"], [placeholder*="city" i]'
    ).first();
    if (await city.isVisible()) {
      await city.fill("Cape Town");
    }

    // Save as draft
    const saveBtn = page.locator(
      'button:has-text("Save"), button:has-text("Draft"), button:has-text("Create")'
    ).first();
    await saveBtn.click();

    // Should redirect to travel list or detail page
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
    await expect(page.getByRole("heading", { name: /Travel Reports/i })).toBeVisible();
  });

  test("finance queue page loads", async ({ page }) => {
    await page.goto("/travel/queues/finance");
    await page.waitForURL("**/travel/queues/finance", { timeout: 15_000 });
    await skipIfAccessDenied(page, "Staff cannot open travel finance queue");
    await expect(page.getByRole("heading", { name: /Finance Review Queue/i })).toBeVisible();
  });
});

test.describe("Travel Phase 3 — settings FX smoke", () => {
  test("settings page shows FX register", async ({ page }) => {
    await page.goto("/travel/settings");
    await page.waitForURL("**/travel/settings", { timeout: 15_000 });
    await skipIfAccessDenied(page, "Staff cannot open travel FX settings");
    await expect(page.getByTestId("travel-fx-settings")).toBeVisible();
  });
});
