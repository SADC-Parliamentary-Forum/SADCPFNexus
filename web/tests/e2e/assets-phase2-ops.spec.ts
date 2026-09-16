/**
 * Asset Phase 2 operations overlays: kits, role templates, scan basket, delegate, labelled pickers.
 */
import { test, expect } from "@playwright/test";
import { skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";

test.describe("Asset Phase 2 operations (admin)", () => {
  test("kits, operations pickers, scan basket, and handover delegate are labelled", async ({ page }) => {
    skipWithoutAuth("admin");

    await page.goto("/assets/kits");
    await waitForApp(page);
    await skipIfAccessDenied(page, "asset kits");
    await expect(page.getByTestId("kit-create-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("kit-name")).toBeVisible();
    await expect(page.locator("[data-testid^='kit-asset-'] input[type='checkbox']").first()).toBeVisible({ timeout: 20_000 });

    const kitName = `E2E kit ${Date.now()}`;
    await page.getByTestId("kit-name").fill(kitName);
    await page.locator("[data-testid^='kit-asset-'] input[type='checkbox']").first().check();
    const created = page.waitForResponse(
      (r) => r.url().includes("/asset-kits") && r.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.getByTestId("kit-create").click();
    expect((await created).ok(), await created.then((r) => r.text())).toBeTruthy();
    await expect(page.getByText(kitName).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/assets/operations");
    await waitForApp(page);
    await skipIfAccessDenied(page, "asset operations");
    await expect(page.getByTestId("ops-template-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("ops-template-name")).toBeVisible();
    await expect(page.getByTestId("ops-attest-assets")).toBeVisible();
    await expect(page.locator("[data-testid^='ops-attest-asset-']").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[placeholder="asset ids"]')).toHaveCount(0);
    await expect(page.getByTestId("ops-planner-asset")).toBeVisible();
    await expect(page.getByTestId("ops-room-location")).toBeVisible();

    const templateName = `E2E template ${Date.now()}`;
    await page.getByTestId("ops-template-name").fill(templateName);
    await page.getByTestId("ops-template-role").fill("staff");
    await page.getByTestId("ops-template-categories").fill("ICT");
    const savedTemplate = page.waitForResponse(
      (r) => r.url().includes("/asset-equipment-templates") && r.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.getByTestId("ops-template-save").click();
    expect((await savedTemplate).ok(), await savedTemplate.then((r) => r.text())).toBeTruthy();
    await expect(page.getByText(templateName).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/assets/scan");
    await waitForApp(page);
    await skipIfAccessDenied(page, "asset scan");
    await expect(page.getByTestId("scan-basket")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("scan-basket-user")).toBeVisible();
    await expect(page.getByTestId("scan-basket-start")).toBeVisible();
    await expect(page.getByTestId("scan-nfc-input")).toBeVisible();

    await page.goto("/assets/handovers/new");
    await waitForApp(page);
    await skipIfAccessDenied(page, "asset handover create");
    await expect(page.getByTestId("handover-create-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("handover-delegate")).toBeVisible();
    await expect(page.getByTestId("handover-to-user")).toBeVisible();
  });

  test("asset profile parent link is a labelled select, not a raw id field", async ({ page }) => {
    skipWithoutAuth("admin");

    await page.goto("/assets");
    await waitForApp(page);
    await skipIfAccessDenied(page, "asset register for parent picker");

    const listed = await page.evaluate(async () => {
      const res = await fetch("/api/assets?per_page=5", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return res.json() as Promise<{ data?: { id?: number }[] }>;
    }).catch(() => ({ data: [] as { id?: number }[] }));

    const assetId = listed.data?.[0]?.id;
    test.skip(!assetId, "No seeded assets to open a profile");

    await page.goto(`/assets/${assetId}`);
    await waitForApp(page);
    await skipIfAccessDenied(page, "asset profile parent");
    await expect(page.getByTestId("asset-view-title")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("asset-parent-select")).toBeVisible();
    await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(0);
  });
});
