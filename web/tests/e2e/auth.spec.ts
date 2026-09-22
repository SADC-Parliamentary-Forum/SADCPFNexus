/**
 * Authentication E2E tests.
 * Run under the "auth" project (no pre-stored state — tests the login UI itself).
 */
import { test, expect } from "@playwright/test";
import { clearBrowserAuth, completeLoginCaptcha } from "./helpers/auth";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL("**/login");
  });

  test("renders the login form", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.getByText(/SADC/i).first()).toBeVisible();
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
    await completeLoginCaptcha(page);
    await page.locator('button[type="submit"]').click();

    // Wait for an error message to appear
    const errorEl = page.locator('[role="alert"], .text-red, [class*="error"]').first();
    await expect(errorEl).toBeVisible({ timeout: 8_000 });
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await page.locator('input[type="email"]').fill("staff@sadcpf.org");
    await page.locator('input[type="password"]').fill("Staff@2024!");
    await completeLoginCaptcha(page);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("successful login establishes a browser session", async ({ page }) => {
    await page.locator('input[type="email"]').fill("staff@sadcpf.org");
    await page.locator('input[type="password"]').fill("Staff@2024!");
    await completeLoginCaptcha(page);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    const stored = await page.evaluate(() => {
      const raw = sessionStorage.getItem("sadcpf_user") || localStorage.getItem("sadcpf_user");
      return raw ? (JSON.parse(raw) as { email?: string }) : null;
    });
    expect(stored?.email).toBe("staff@sadcpf.org");

    const me = await page.evaluate(async () => {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, body };
    });
    if (me.ok) {
      const email = (me.body as { email?: string; data?: { email?: string } } | null)?.email
        ?? (me.body as { data?: { email?: string } } | null)?.data?.email;
      expect(email).toBe("staff@sadcpf.org");
    }
  });

  test("forgot-password link opens and stays on the reset form", async ({ page }) => {
    await page.getByRole("link", { name: /reset password/i }).click();
    await page.waitForURL("**/forgot-password", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("request-password link opens and stays on the access form", async ({ page }) => {
    await page.getByRole("link", { name: /request a password/i }).click();
    await page.waitForURL("**/request-password", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /request a password/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page).toHaveURL(/\/request-password/);
  });
});

test.describe("Public auth pages", () => {
  test("direct /forgot-password does not bounce to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toContain("/forgot-password");
    expect(page.url()).not.toContain("/login");
  });

  test("direct /request-password does not bounce to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/request-password");
    await expect(page.getByRole("heading", { name: /request a password/i })).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toContain("/request-password");
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("Auth protection", () => {
  test("unauthenticated access to /dashboard redirects to /login", async ({
    page,
  }) => {
    await clearBrowserAuth(page);
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("login");
  });

  test("unauthenticated access to /travel redirects to /login", async ({
    page,
  }) => {
    await clearBrowserAuth(page);
    await page.goto("/travel");
    await page.waitForURL("**/login**", { timeout: 10_000 });
  });

  test("unauthenticated access to /admin redirects to /login", async ({
    page,
  }) => {
    await clearBrowserAuth(page);
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
    await completeLoginCaptcha(page);
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
      await page.getByRole("button", { name: /log ?out|sign out/i }).or(page.getByRole("link", { name: /log ?out|sign out/i })).first().click();
    }

    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("login");

    const meResponse = await page.request.get("/api/auth/me", {
      headers: { Accept: "application/json" },
    });
    expect(meResponse.status()).toBe(401);
  });
});

test.describe("Supplier portal login", () => {
  test("renders a supplier-only sign-in page", async ({ page }) => {
    await page.goto("/supplier/login");
    await expect(page.getByRole("heading", { name: /supplier sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /register your supplier account/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /staff sign in/i }).first()).toBeVisible();
    await expect(page.getByText(/travel & mission/i)).toHaveCount(0);
  });

  test("login CSRF mismatch shows a friendly retry instead of raw Laravel copy", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 419,
        contentType: "application/json",
        body: JSON.stringify({ message: "CSRF token mismatch." }),
      });
    });

    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@sadcpf.org");
    await page.locator('input[type="password"]').fill("Admin@2024!");
    await completeLoginCaptcha(page);
    await page.locator('button[type="submit"]').click();

    const errorEl = page.getByRole("alert");
    await expect(errorEl).toBeVisible({ timeout: 8_000 });
    await expect(errorEl).toContainText(/session expired/i);
    await expect(errorEl).not.toContainText(/CSRF token mismatch/i);
  });

  test("supplier login CSRF mismatch shows the same friendly retry", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 419,
        contentType: "application/json",
        body: JSON.stringify({ message: "CSRF token mismatch." }),
      });
    });

    await page.goto("/supplier/login");
    await page.locator('input[type="email"]').fill("supplier@example.org");
    await page.locator('input[type="password"]').fill("Supplier@2024!");
    await completeLoginCaptcha(page);
    await page.locator('button[type="submit"]').click();

    const errorEl = page.getByRole("alert");
    await expect(errorEl).toBeVisible({ timeout: 8_000 });
    await expect(errorEl).toContainText(/session expired/i);
    await expect(errorEl).not.toContainText(/CSRF token mismatch/i);
  });

  test("staff login page links to the supplier portal", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /staff sign in/i })).toBeVisible();
    const supplierLink = page.getByRole("link", { name: /go to the supplier portal/i });
    await expect(supplierLink).toBeVisible();
    await expect(supplierLink).toHaveAttribute("href", "/supplier/login");
    await expect(page.getByText(/are you a supplier\?/i)).toBeVisible();
    await supplierLink.click();
    await page.waitForURL("**/supplier/login", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /supplier sign in/i })).toBeVisible();
  });

  test("registration wizard shows eight steps and blocks create without documents", async ({ page }) => {
    await page.goto("/supplier/register");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("supplier-wizard")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("supplier-wizard-steps")).toContainText(/Company Profile/i);
    await expect(page.getByTestId("supplier-wizard-steps")).toContainText(/Review/i);

    await page.getByRole("button", { name: /8\.\s*Review/i }).click();
    const create = page.getByTestId("create-supplier-account");
    await expect(create).toBeVisible();
    await expect(create).toBeDisabled();
  });

  test("email verification page reports missing link parameters", async ({ page }) => {
    await page.goto("/supplier/verify-email");
    await expect(page.getByTestId("verify-email-message")).toContainText(/missing required parameters/i);
  });
});
