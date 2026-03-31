/**
 * Authentication E2E tests.
 * Run under the "auth" project (no pre-stored state — tests the login UI itself).
 */
import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL("**/login");
  });

  test("renders the login form", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator("text=SADC")).toBeVisible();
  });

  test("shows validation error for empty submission", async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    // Browser native validation or custom error message
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.locator('input[type="email"]').fill("nobody@example.com");
    await page.locator('input[type="password"]').fill("WrongPassword!");
    await page.locator('button[type="submit"]').click();

    // Wait for an error message to appear
    const errorEl = page.locator('[role="alert"], .text-red, [class*="error"]').first();
    await expect(errorEl).toBeVisible({ timeout: 8_000 });
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await page.locator('input[type="email"]').fill("staff@sadcpf.org");
    await page.locator('input[type="password"]').fill("Staff@2024!");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("token is stored in localStorage after login", async ({ page }) => {
    await page.locator('input[type="email"]').fill("staff@sadcpf.org");
    await page.locator('input[type="password"]').fill("Staff@2024!");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    const token = await page.evaluate(
      () => localStorage.getItem("sadcpf_token")
    );
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(20);
  });
});

test.describe("Auth protection", () => {
  test("unauthenticated access to /dashboard redirects to /login", async ({
    page,
  }) => {
    // Clear any existing state
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.context().clearCookies();

    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("login");
  });

  test("unauthenticated access to /travel redirects to /login", async ({
    page,
  }) => {
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();

    await page.goto("/travel");
    await page.waitForURL("**/login**", { timeout: 10_000 });
  });

  test("unauthenticated access to /admin redirects to /login", async ({
    page,
  }) => {
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();

    await page.goto("/admin");
    await page.waitForURL("**/login**", { timeout: 10_000 });
  });
});

test.describe("Logout", () => {
  test("logout clears auth and redirects to login", async ({ page }) => {
    // Log in first
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("staff@sadcpf.org");
    await page.locator('input[type="password"]').fill("Staff@2024!");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Click logout (look for logout button in header/nav)
    const logoutBtn = page
      .locator('button:has-text("Logout"), a:has-text("Logout"), [aria-label*="logout" i]')
      .first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // Try user menu dropdown first
      const userMenu = page.locator('[aria-label*="user" i], [class*="user-menu"], [class*="avatar"]').first();
      await userMenu.click();
      await page.locator('text=Logout, text=Sign out').first().click();
    }

    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("login");

    const token = await page.evaluate(() => localStorage.getItem("sadcpf_token"));
    expect(token).toBeNull();
  });
});
