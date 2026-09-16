/**
 * Remaining labelled pickers: access simulator, budget journal, correspondence, salary exceptions.
 */
import { test, expect } from "@playwright/test";
import { skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";

test.describe("Remaining labelled pickers (admin)", () => {
  test("access simulator uses a labelled user select, not a raw id field", async ({ page }) => {
    skipWithoutAuth("admin");

    await page.goto("/admin/access/simulator");
    await waitForApp(page);
    await skipIfAccessDenied(page, "access simulator");

    await expect(page.getByTestId("sim-user-select")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("User ID", { exact: true })).toHaveCount(0);
    await expect(page.locator("#sim-user")).toHaveCount(0);
  });

  test("budget journal posts against a labelled budget line select", async ({ page }) => {
    skipWithoutAuth("admin");

    await page.goto("/budget");
    await waitForApp(page);
    await skipIfAccessDenied(page, "budget journal picker");

    await expect(page.getByTestId("budget-journal-line")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[placeholder="Budget line ID"]')).toHaveCount(0);
  });

  test("workflow designer has no raw Role ID / User ID number fields", async ({ page }) => {
    skipWithoutAuth("admin");

    await page.goto("/admin/workflows/designer");
    await waitForApp(page);
    await skipIfAccessDenied(page, "workflow designer pickers");

    await expect(page.locator('input[placeholder="Role ID"]')).toHaveCount(0);
    await expect(page.locator('input[placeholder="User ID"]')).toHaveCount(0);
  });
});
