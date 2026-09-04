/**
 * Asset register import / public QR smokes.
 */
import { test, expect } from "@playwright/test";
import { skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";

test.describe("Assets import (admin)", () => {
  test("import page loads for an authorised admin", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/assets/import");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets import");
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="file"]').first()).toBeVisible();
  });

  test("labels page is authorised", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/assets/labels");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets labels");
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Public QR page", () => {
  test("unknown token does not leak serial or value", async ({ page }) => {
    await page.goto("/a/not-a-real-token");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/serial|book value|NAD|custodian/i)).toHaveCount(0);
  });
});
