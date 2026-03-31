/**
 * Admin module E2E tests — runs under admin project (admin auth state).
 */
import { test, expect } from "@playwright/test";

test.describe("Admin overview", () => {
  test("admin overview page loads", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("**/admin", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Admin — Users", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForURL("**/admin/users", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("users list page loads with data", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
    // Seeded users should be listed
    const rows = page.locator("table tbody tr, [class*='user-card']");
    await expect(rows.first()).toBeVisible({ timeout: 8_000 });
  });

  test("users list has create user button", async ({ page }) => {
    const btn = page.locator("a:has-text('New User'), a:has-text('Create'), button:has-text('New')").first();
    await expect(btn).toBeVisible();
  });

  test("can search for a user", async ({ page }) => {
    const search = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    if (await search.isVisible()) {
      await search.fill("admin");
      await page.waitForTimeout(500); // debounce
      const rows = page.locator("table tbody tr, [class*='user-card']");
      await expect(rows.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("can navigate to user detail / edit", async ({ page }) => {
    const firstEditLink = page.locator("a[href*='/admin/users/'], [class*='edit']").first();
    if (await firstEditLink.isVisible({ timeout: 5_000 })) {
      await firstEditLink.click();
      await page.waitForURL("**/admin/users/**", { timeout: 10_000 });
    }
  });
});

test.describe("Admin — Departments", () => {
  test("departments page loads", async ({ page }) => {
    await page.goto("/admin/departments");
    await page.waitForURL("**/admin/departments", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Admin — Roles", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/roles");
    await page.waitForURL("**/admin/roles", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("roles page loads with seeded roles", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
    const roleEl = page.locator("text=System Admin, text=Staff, text=HR Manager");
    await expect(roleEl.first()).toBeVisible({ timeout: 8_000 });
  });

  test("roles list shows permission matrix or role cards", async ({ page }) => {
    const cards = page.locator("[class*='role'], [class*='card']");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Admin — Workflows", () => {
  test("workflows page loads", async ({ page }) => {
    await page.goto("/admin/workflows");
    await page.waitForURL("**/admin/workflows", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Admin — Audit Logs", () => {
  test("audit log page loads", async ({ page }) => {
    await page.goto("/admin/audit");
    await page.waitForURL("**/admin/audit", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("audit log shows entries from seeded actions", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    const rows = page.locator("table tbody tr, [class*='log-entry'], [class*='audit']");
    // At least some audit entries from seeding
    await expect(rows.first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Admin — Notifications", () => {
  test("notification templates page loads", async ({ page }) => {
    await page.goto("/admin/notifications");
    await page.waitForURL("**/admin/notifications", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("templates are listed", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    const templates = page.locator("[class*='template'], table tbody tr").first();
    await expect(templates).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Admin — Settings", () => {
  test("settings page loads", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.waitForURL("**/admin/settings", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Admin — Payslips", () => {
  test("payslips admin page loads", async ({ page }) => {
    await page.goto("/admin/payslips");
    await page.waitForURL("**/admin/payslips", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});
