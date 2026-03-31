/**
 * HR module E2E tests.
 */
import { test, expect } from "@playwright/test";

test.describe("HR Overview", () => {
  test("hr overview page loads", async ({ page }) => {
    await page.goto("/hr");
    await page.waitForURL("**/hr", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Timesheets", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hr/timesheets");
    await page.waitForURL("**/hr/timesheets", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("timesheets page loads", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("timesheet entries table or empty state renders", async ({ page }) => {
    await expect(page.locator("table, [class*='timesheet'], text=No timesheet").first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Leave balances (HR admin view)", () => {
  test("leave balances page loads", async ({ page }) => {
    await page.goto("/hr/leave/balances");
    await page.waitForURL("**/hr/leave/balances", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Appraisals", () => {
  test("appraisals list page loads", async ({ page }) => {
    await page.goto("/hr/appraisals");
    await page.waitForURL("**/hr/appraisals", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Conduct records", () => {
  test("conduct page loads", async ({ page }) => {
    await page.goto("/hr/conduct");
    await page.waitForURL("**/hr/conduct", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("HR Incidents", () => {
  test("incidents page loads", async ({ page }) => {
    await page.goto("/hr/incidents");
    await page.waitForURL("**/hr/incidents", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Personal Files", () => {
  test("personal files list page loads", async ({ page }) => {
    await page.goto("/hr/files");
    await page.waitForURL("**/hr/files", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Profile", () => {
  test("user profile page loads", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL("**/profile", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("profile shows user name and email", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    // The logged-in user's details should appear
    const emailEl = page.locator("text=@sadcpf.org, text=staff@, text=admin@").first();
    await expect(emailEl).toBeVisible({ timeout: 8_000 });
  });
});
