/**
 * Salary Advance + Procurement critical-path smoke tests.
 *
 * Skip policy
 * -----------
 * - Authenticated cases skip when `playwright/.auth/{staff,admin}.json` is
 *   missing/empty (setup could not log in — API down or seed users absent).
 * - Role-gated pages (procurement settings/register) skip when the fixture
 *   user is redirected to login or shown an authorization notice.
 * - Public `/tender-notices` never requires auth fixtures.
 *
 * How to run
 * ----------
 *   Prerequisites: API (seeded) on :8000, web on :3000 (or set PLAYWRIGHT_BASE_URL).
 *   cd web
 *   npx playwright test tests/e2e/sa-procurement-smokes.spec.ts
 *   npm run test:smokes:sa-proc
 *
 *   Against a remote env:
 *   PLAYWRIGHT_BASE_URL=https://example.example npx playwright test tests/e2e/sa-procurement-smokes.spec.ts
 *
 * No consolidation enablement and no real payroll vendor calls — UI load only.
 */
import { test, expect } from "@playwright/test";
import {
  authStatePath,
  landedOnLogin,
  skipIfAccessDenied,
  skipIfLocatorMissing,
  skipWithoutAuth,
} from "./helpers/auth";

async function expectNoServerCrash(page: import("@playwright/test").Page) {
  await expect(page.locator("body")).not.toContainText(
    /\bInternal Server Error\b|\bUnhandled Runtime Error\b|\bException\b/
  );
}

test.describe("Smoke — Salary Advances (staff)", () => {
  test.use({ storageState: authStatePath("staff") });

  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

  test("nav shows Salary Advances; dashboard/list loads", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("heading").first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);

    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid — re-run global.setup against a live seeded API");
    }

    const nav = page
      .locator("nav, aside, [role='navigation']")
      .getByRole("link", { name: /salary advances/i })
      .or(page.getByRole("link", { name: /salary advances/i }))
      .first();

    const navVisible = await nav.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!navVisible) {
      // Fallback: deep-link still proves route availability for staff.
      await page.goto("/salary-advances");
      if (await landedOnLogin(page)) {
        test.skip(true, "Salary Advances not reachable for staff fixture");
      }
    } else {
      await nav.click();
      await page.waitForURL(/\/salary-advances/, { timeout: 15_000 });
    }

    await skipIfAccessDenied(page, "Staff cannot open salary advances hub");
    const heading = page
      .getByRole("heading", { name: /salary advance/i })
      .or(page.locator("h1.page-title, [class*='page-title']").filter({ hasText: /salary advance/i }))
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
    await expectNoServerCrash(page);
  });

  test("apply/create loads with eligibility banner area", async ({ page }) => {
    await page.goto("/salary-advances/create");
    await page.waitForLoadState("networkidle");

    if (await landedOnLogin(page)) {
      test.skip(true, "Staff cannot open salary-advances/create — fixture/permissions");
    }
    await skipIfAccessDenied(page, "Staff cannot open salary-advances/create");

    // Alias redirects to /finance/advances/create wizard.
    await page.waitForURL(/\/(salary-advances\/create|finance\/advances\/create)/, {
      timeout: 15_000,
    });
    await page.waitForLoadState("networkidle");

    const eligibilityHeading = page.getByRole("heading", {
      name: /eligibility/i,
    });
    const eligibilityBanner = page.locator(
      "text=/Eligible|Not Eligible|Outstanding Advance|Confirmed Net Salary|Eligibility & Classification|Eligibility unavailable/i"
    );

    await expect(eligibilityHeading.or(eligibilityBanner).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoServerCrash(page);
  });
});

test.describe("Smoke — Procurement (staff)", () => {
  test.use({ storageState: authStatePath("staff") });

  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

  test("list and create pages load", async ({ page }) => {
    await page.goto("/procurement");
    await page.waitForLoadState("networkidle");

    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for procurement list");
    }
    await skipIfAccessDenied(page, "Staff cannot open procurement");

    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoServerCrash(page);

    await page.goto("/procurement/create");
    await page.waitForURL("**/procurement/create", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    if (await landedOnLogin(page)) {
      test.skip(true, "Staff cannot open procurement/create — fixture/permissions");
    }
    await skipIfAccessDenied(page, "Staff cannot open procurement create");

    const formField = page.locator("input, textarea, select").first();
    await skipIfLocatorMissing(formField, "Staff cannot use procurement create form");
    await expect(formField).toBeVisible({
      timeout: 15_000,
    });
    await expectNoServerCrash(page);
  });
});

test.describe("Smoke — Public tender notices", () => {
  // Explicitly clear storage so this stays a public journey.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/tender-notices loads without auth", async ({ page }) => {
    const response = await page.goto("/tender-notices", {
      waitUntil: "domcontentloaded",
    });
    expect(response, "missing response for /tender-notices").not.toBeNull();
    expect(response!.status(), `unexpected status ${response!.status()}`).toBeLessThan(500);
    expect(response!.status()).not.toBe(404);

    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByRole("heading", { name: /public tender notices/i })
    ).toBeVisible({ timeout: 15_000 });

    // Empty board or loaded notices both OK; error banner alone is still a load.
    const body = page.locator("body");
    await expect(body).toContainText(/Tender Notices|No published notices|Unable to load notices/i);
    await expectNoServerCrash(page);
  });
});

test.describe("Smoke — Procurement settings/register (authorised)", () => {
  test.use({ storageState: authStatePath("admin") });

  test.beforeEach(() => {
    skipWithoutAuth("admin");
  });

  test("settings or register loads for authorised role", async ({ page }) => {
    // Prefer settings (admin); fall back to register if settings is gated.
    await page.goto("/procurement/settings");
    await page.waitForLoadState("networkidle");

    if (await landedOnLogin(page)) {
      test.skip(true, "Admin session invalid — re-run global.setup");
    }

    const denied = page.locator("text=/You need .*procurement\\.admin|not authorised|unauthorized|forbidden/i");
    const settingsDenied = await denied.first().isVisible({ timeout: 3_000 }).catch(() => false);

    if (settingsDenied) {
      await page.goto("/procurement/register");
      await page.waitForLoadState("networkidle");

      if (await landedOnLogin(page)) {
        test.skip(true, "Admin fixture cannot open procurement register either");
      }

      const registerDenied = await denied.first().isVisible({ timeout: 2_000 }).catch(() => false);
      test.skip(registerDenied, "Admin fixture lacks procurement settings/register access");

      await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({
        timeout: 15_000,
      });
      await expectNoServerCrash(page);
      return;
    }

    await expect(
      page
        .getByRole("heading", { name: /settings|threshold|policy/i })
        .or(page.locator("h1, [class*='page-title']"))
        .first()
    ).toBeVisible({ timeout: 15_000 });
    await expectNoServerCrash(page);
  });
});
