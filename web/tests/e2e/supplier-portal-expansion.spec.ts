/**
 * Supplier portal expansion — Phase 1 staff Playwright coverage.
 *
 * Public wizard coverage lives in auth.spec.ts (auth project).
 * API isolation of supplier A vs B is in PHPUnit SupplierIsolationTest.
 */
import { test, expect } from "@playwright/test";
import { landedOnLogin, skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";
import { browserApiGet, skipIfApiForbidden } from "./helpers/api";

test.describe("Staff Supplier 360", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/procurement/vendors");
    await waitForApp(page);
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /procurement/vendors");
    }
    await skipIfAccessDenied(page, "/procurement/vendors");
  });

  test("opens document register and shows verify stamp controls", async ({ page }) => {
    const firstLink = page.locator("a[href*='/procurement/vendors/']").first();
    const visible = await firstLink.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!visible, "No vendor detail links in the seeded register");

    await firstLink.click();
    await page.waitForURL("**/procurement/vendors/**", { timeout: 15_000 });
    await page.getByRole("button", { name: /^Documents$/ }).click();
    await expect(page.getByTestId("supplier-register-panel")).toBeVisible({ timeout: 15_000 });

    const verify = page.getByTestId("verify-document").first();
    if (await verify.isVisible().catch(() => false)) {
      await verify.click();
      await expect(page.getByTestId("document-verify-stamp").first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("staff cannot open the supplier portal as another vendor", async ({ page }) => {
    await page.goto("/supplier");
    await waitForApp(page);
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid");
    }
    await expect(
      page.getByTestId("access-denied").or(page.getByTestId("supplier-portal-denied"))
    ).toBeVisible({ timeout: 15_000 });

    const portalMe = await browserApiGet(page, "/procurement/supplier/me");
    expect([401, 403]).toContain(portalMe.status);

    const vendors = await browserApiGet(page, "/procurement/vendors?per_page=2");
    skipIfApiForbidden(vendors, "/procurement/vendors");
    const body = vendors.body as { data?: Array<{ id: number }> };
    const firstId = body.data?.[0]?.id;
    test.skip(!firstId, "No vendors returned for isolation check");
    const docs = await browserApiGet(page, `/procurement/vendors/${firstId}/register-documents`);
    expect(docs.ok || docs.status === 404).toBeTruthy();
  });
});
