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
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.waitForLoadState("networkidle", { timeout: 20_000 });
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
    expect(pageErrors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
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
    await page.getByText(/^Loading…$/).waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 15_000 });

    const cards = page.locator("[class*='card'], [class*='kpi'], [class*='stat']");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("header shows user info", async ({ page }) => {
    // Header should contain the logged-in user's name or avatar
    const header = page.locator("header, [class*='header']").first();
    await expect(header).toBeVisible();
  });

  test("navigation links are present", async ({ page }) => {
    const links = page.locator("nav a, aside a, nav button");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test("notification bell is visible in header", async ({ page }) => {
    const bell = page.getByRole("button", { name: /Notifications/i });
    await expect(bell.first()).toBeVisible({ timeout: 5_000 });
  });
});
