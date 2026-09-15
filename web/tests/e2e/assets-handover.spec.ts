/**
 * Acquisition lot → print labels → issue handover → staff partial accept/dispute.
 */
import { test, expect } from "@playwright/test";
import { authFixtureExists, skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";

test.describe("Asset issuance handover (admin + staff)", () => {
  test("create a lot of 2, print labels, issue to staff, accept one and dispute one", async ({ page, browser }) => {
    skipWithoutAuth("admin");
    test.skip(!authFixtureExists("staff"), "Staff auth fixture missing");

    const lotName = `E2E lot ${Date.now()}`;
    await page.goto("/assets/batches");
    await waitForApp(page);
    await skipIfAccessDenied(page, "asset batches");

    await page.getByTestId("batch-qty").fill("2");
    await page.getByTestId("batch-description").fill(lotName);
    const created = page.waitForResponse(
      (r) => r.url().includes("/asset-batches") && r.request().method() === "POST" && !r.url().includes("create-assets") && !r.url().includes("print-labels"),
      { timeout: 30_000 },
    );
    await page.getByTestId("batch-create").click();
    expect((await created).ok()).toBeTruthy();
    await expect(page.getByText(lotName).first()).toBeVisible({ timeout: 20_000 });

    const lotRow = page.locator("tr", { hasText: lotName }).first();
    await expect(lotRow).toBeVisible();
    const printResp = page.waitForResponse(
      (r) => r.url().includes("/print-labels") && r.request().method() === "POST",
      { timeout: 20_000 },
    ).catch(() => null);
    await lotRow.getByRole("button", { name: /Print all labels|Imprimer toutes les étiquettes|Imprimir todas as etiquetas/i }).click();
    await printResp;

    await lotRow.getByRole("link", { name: /New handover|Nouvelle remise|Nova entrega/i }).click();
    await waitForApp(page);
    await expect(page.getByTestId("handover-create-form")).toBeVisible({ timeout: 15_000 });

    const userSelect = page.getByTestId("handover-to-user");
    await expect(userSelect).toBeVisible();
    const staffValue = await userSelect.locator("option", { hasText: /Demo Staff|staff@sadcpf\.org/i }).first().getAttribute("value");
    expect(staffValue).toBeTruthy();
    await userSelect.selectOption(staffValue!);

    const checkboxes = page.locator("[data-testid^='handover-asset-'] input[type='checkbox']");
    await expect(checkboxes.first()).toBeVisible({ timeout: 15_000 });
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < Math.min(count, 2); i++) {
      if (!(await checkboxes.nth(i).isChecked())) {
        await checkboxes.nth(i).check();
      }
    }

    await page.getByTestId("handover-send").click();
    await expect(page).toHaveURL(/\/assets\/handovers\/\d+/, { timeout: 20_000 });
    const handoverUrl = page.url();

    const staffContext = await browser.newContext({ storageState: "playwright/.auth/staff.json" });
    const staffPage = await staffContext.newPage();
    await staffPage.goto(handoverUrl);
    await waitForApp(staffPage);
    await skipIfAccessDenied(staffPage, "staff handover accept");

    const lines = staffPage.locator("[data-testid^='handover-line-']");
    await expect(lines).toHaveCount(2, { timeout: 15_000 });
    await lines.nth(0).getByTestId("handover-respond-received").click();
    await lines.nth(1).locator("input.form-input").fill("Crack on lid");
    await lines.nth(1).getByTestId("handover-respond-condition_different").click();
    await staffPage.getByTestId("handover-sign").click();
    await expect(staffPage.getByText(/partially_accepted/i)).toBeVisible({ timeout: 20_000 });

    await staffContext.close();
  });
});
