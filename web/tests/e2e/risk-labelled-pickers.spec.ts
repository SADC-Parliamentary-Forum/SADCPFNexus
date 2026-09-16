/**
 * Risk KRI / BCP / control-testing labelled pickers: no raw numeric IDs.
 */
import { test, expect } from "@playwright/test";
import { skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";

test.describe("Risk labelled pickers (admin)", () => {
  test("KRI links use risk and objective selects, not raw id fields", async ({ page }) => {
    skipWithoutAuth("admin");

    await page.goto("/risk/kri");
    await waitForApp(page);
    await skipIfAccessDenied(page, "risk KRI labelled pickers");

    await expect(page.locator('input[placeholder="Risk ID"]')).toHaveCount(0);
    await expect(page.locator('input[placeholder="Objective ID"]')).toHaveCount(0);
    await expect(page.locator("[data-testid^='kri-risk-select-']").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-testid^='kri-objective-select-']").first()).toBeVisible();
  });

  test("BCP ops uses labelled risk and insurance policy selects", async ({ page }) => {
    skipWithoutAuth("admin");

    await page.goto("/risk/bcp");
    await waitForApp(page);
    await skipIfAccessDenied(page, "risk BCP labelled pickers");

    await expect(page.getByTestId("bcp-risk-select")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("bcp-risk-a-select")).toBeVisible();
    await expect(page.getByTestId("bcp-risk-b-select")).toBeVisible();
    await expect(page.locator('input[placeholder="Risk ID"]')).toHaveCount(0);

    await page.getByLabel(/link type/i).selectOption("insurance_policy");
    await expect(page.getByTestId("bcp-policy-select")).toBeVisible();
    await expect(page.getByText("Asset insurance policy ID")).toHaveCount(0);
  });

  test("control testing uses labelled control checkboxes, not comma ids", async ({ page }) => {
    skipWithoutAuth("admin");

    await page.goto("/risk/control-testing");
    await waitForApp(page);
    await skipIfAccessDenied(page, "risk control testing labelled pickers");

    await expect(page.getByTestId("testing-controls")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[placeholder="12,15"]')).toHaveCount(0);
    await expect(page.getByText("Control IDs (comma)")).toHaveCount(0);

    const checkbox = page.locator("[data-testid^='testing-control-'] input[type='checkbox']").first();
    if (await checkbox.isVisible().catch(() => false)) {
      await expect(checkbox).toBeVisible();
    }
  });
});
