import { test, expect } from "@playwright/test";
import { skipWithoutAuth } from "./helpers/auth";

test.describe("PO template designer", () => {
  test("admin opens designer, moves logo, saves draft and publish", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/procurement/settings/po-templates");
    await expect(page.getByRole("heading", { name: /purchase order templates/i })).toBeVisible({ timeout: 20_000 });
    const row = page.getByTestId("po-template-row").first();
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: /design/i }).click();
    await expect(page.getByTestId("po-designer-canvas")).toBeVisible({ timeout: 20_000 });
    const logo = page.getByTestId("po-el-logo").first();
    if (await logo.count()) {
      const box = await logo.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 8, box.y + 8);
        await page.mouse.down();
        await page.mouse.move(box.x + 40, box.y + 24);
        await page.mouse.up();
      }
    }
    await page.getByTestId("po-designer-save").click();
    await expect(page.getByText(/draft saved/i)).toBeVisible({ timeout: 15_000 });
    const publish = page.getByTestId("po-designer-publish");
    if (await publish.isEnabled()) {
      await publish.click();
      await expect(page.getByText(/published/i)).toBeVisible({ timeout: 15_000 });
    }
  });

  test("admin numbering page parses legacy reference", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/procurement/settings/numbering");
    await expect(page.getByRole("heading", { name: /purchase order numbering/i })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("numbering-legacy").fill("S04015");
    await page.getByRole("button", { name: /preview next/i }).click();
    await expect(page.getByTestId("numbering-parsed")).toContainText("S 04016", { timeout: 15_000 });
  });
});
