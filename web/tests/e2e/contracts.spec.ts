/**
 * Contract Management module E2E smokes.
 *
 * Uses the shared auth fixtures (helpers/auth.ts). Specs skip gracefully when
 * the fixture is missing or the role lacks access, matching the other modules.
 */
import { test, expect } from "@playwright/test";
import { landedOnLogin, skipWithoutAuth, skipIfAccessDenied } from "./helpers/auth";

test.describe("Contracts — dashboard", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/contracts");
    await page.waitForURL("**/contracts", { timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded");
    if (await landedOnLogin(page)) test.skip(true, "Staff session invalid for /contracts");
    await skipIfAccessDenied(page, "/contracts");
  });

  test("contracts dashboard loads with KPI cards", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
    await expect(page.getByText(/Total Contracts|Active Contracts/i).first()).toBeVisible();
  });

  test("register link is reachable", async ({ page }) => {
    const registerLink = page.locator("a[href='/contracts/register']").first();
    await expect(registerLink).toBeVisible();
  });
});

test.describe("Contracts — register", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/contracts/register");
    await page.waitForURL("**/contracts/register", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) test.skip(true, "Staff session invalid for /contracts/register");
    await skipIfAccessDenied(page, "/contracts/register");
  });

  test("register page shows the contract table or empty state", async ({ page }) => {
    const table = page.locator("table.data-table");
    const empty = page.getByText(/No contracts found/i);
    await expect(table.or(empty).first()).toBeVisible({ timeout: 10_000 });
  });

  test("register exposes a New Contract action", async ({ page }) => {
    await expect(page.getByRole("button", { name: /New Contract/i }).first()).toBeVisible();
  });
});

test.describe("Contracts — reports", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/contracts/reports");
    await page.waitForURL("**/contracts/reports", { timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded");
    if (await landedOnLogin(page)) test.skip(true, "Staff session invalid for /contracts/reports");
    await skipIfAccessDenied(page, "/contracts/reports");
  });

  test("reports desk shows labelled tabs and export actions", async ({ page }) => {
    await expect(page.getByTestId("contract-reports-tabs")).toBeVisible();
    await expect(page.getByTestId("contract-reports-register")).toBeVisible();
    await expect(page.getByTestId("contract-reports-kpis")).toBeVisible();
    await expect(page.getByTestId("contract-reports-print")).toBeVisible();
    await expect(page.getByTestId("contract-reports-export-csv")).toBeVisible();
    await expect(page.getByTestId("contract-reports-export-xlsx")).toBeVisible();
    await expect(page.getByTestId("contract-reports-search")).toBeVisible();
    await page.getByTestId("contract-reports-exceptions").click();
    await expect(page).toHaveURL(/type=exceptions/);
    await expect(page.getByTestId("contract-reports-severity")).toBeVisible();
  });
});
