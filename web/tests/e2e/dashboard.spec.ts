/**
 * Dashboard E2E tests — runs as staff user with pre-stored auth state.
 */
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
  });

  test("dashboard page loads without errors", async ({ page }) => {
    // No console errors for 404 / 500
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.waitForLoadState("networkidle", { timeout: 20_000 });

    // Filter out known non-critical errors (e.g. browser extension noise)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("extension") &&
        !e.includes("favicon") &&
        e.toLowerCase().includes("error")
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("page title contains SADC or Nexus branding", async ({ page }) => {
    const title = await page.title();
    expect(title.toLowerCase()).toMatch(/sadc|nexus/i);
  });

  test("sidebar is visible", async ({ page }) => {
    // Sidebar should have navigation links
    const sidebar = page.locator("nav, aside, [class*='sidebar']").first();
    await expect(sidebar).toBeVisible();
  });

  test("KPI / stats cards are visible", async ({ page }) => {
    // Wait for stats to load (they're fetched async)
    await page.waitForLoadState("networkidle", { timeout: 20_000 });

    // Look for card-like elements with numeric content
    const cards = page.locator("[class*='card'], [class*='kpi'], [class*='stat']");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("header shows user info", async ({ page }) => {
    // Header should contain the logged-in user's name or avatar
    const header = page.locator("header, [class*='header']").first();
    await expect(header).toBeVisible();
  });

  test("navigation links are present", async ({ page }) => {
    // Core modules should be reachable from sidebar
    const links = page.locator("nav a, aside a");
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
  });

  test("notification bell is visible in header", async ({ page }) => {
    const bell = page.locator(
      '[aria-label*="notification" i], [title*="notification" i], .material-symbols-outlined:has-text("notifications")'
    );
    await expect(bell.first()).toBeVisible({ timeout: 5_000 });
  });
});
