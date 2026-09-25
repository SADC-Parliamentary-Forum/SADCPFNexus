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

  test("register exposes search and status filters", async ({ page }) => {
    await expect(page.getByRole("searchbox").or(page.getByLabel(/search/i)).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^(All|Tous|Todos)$/ }).first()).toBeVisible();
  });
});
