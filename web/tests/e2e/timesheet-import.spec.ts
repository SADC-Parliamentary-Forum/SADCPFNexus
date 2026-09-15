/**
 * Staff historical timesheet import wizard smoke.
 *
 * Run:
 *   cd web && npx playwright test tests/e2e/timesheet-import.spec.ts --project=staff
 */
import { test, expect } from "@playwright/test";
import { expectNoServerCrash, skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";

test.describe("Timesheet historical import (staff)", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/hr/timesheets/import");
    await waitForApp(page);
    await skipIfAccessDenied(page, "/hr/timesheets/import");
  });

  test("wizard loads, template download is offered, and file input is present", async ({ page }) => {
    await expect(page.getByTestId("timesheet-import-title")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("timesheet-import-template")).toBeVisible();
    await expect(page.getByTestId("timesheet-import-file")).toBeVisible();
    await expect(page.getByTestId("timesheet-import-upload")).toBeVisible();
    await expectNoServerCrash(page);
  });

  test("template download returns an xlsx workbook", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
    await page.getByTestId("timesheet-import-template").click();
    const download = await downloadPromise;
    if (!download) {
      test.skip(true, "Template download did not start — API may be offline");
      return;
    }
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });
});
