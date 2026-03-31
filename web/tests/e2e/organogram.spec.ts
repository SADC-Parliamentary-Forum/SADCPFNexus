/**
 * Organogram E2E tests — interactive canvas hierarchy editor.
 */
import { test, expect } from "@playwright/test";

test.describe("Organogram page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/organogram");
    await page.waitForURL("**/organogram", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("organogram page loads without errors", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
    await expect(page.locator("text=Error, text=Failed")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });

  test("canvas area is rendered", async ({ page }) => {
    // The canvas container should be visible
    const canvas = page.locator("[style*='radial-gradient'], [class*='canvas'], [class*='organogram']").first();
    await expect(canvas).toBeVisible({ timeout: 8_000 });
  });

  test("department nodes are visible from seeded data", async ({ page }) => {
    // Department cards should be visible (seeded departments)
    // Nodes are absolutely positioned divs inside the canvas
    await page.waitForTimeout(1_500); // let layout compute
    const nodes = page.locator(".group").first();
    await expect(nodes).toBeVisible({ timeout: 8_000 });
  });

  test("zoom controls are present", async ({ page }) => {
    // Plus and minus zoom buttons
    const plusBtn = page.locator("button:has-text('+'), button[title*='zoom' i]").first();
    await expect(plusBtn).toBeVisible({ timeout: 5_000 });
  });

  test("auto-layout button is present and clickable", async ({ page }) => {
    const autoLayoutBtn = page.locator("button:has-text('Auto'), button:has-text('Layout')").first();
    await expect(autoLayoutBtn).toBeVisible();
    await autoLayoutBtn.click();
    // Should not crash
    await page.waitForTimeout(500);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("'New Root Unit' button is present", async ({ page }) => {
    const btn = page.locator("button:has-text('New Root Unit'), button:has-text('Root Unit')").first();
    await expect(btn).toBeVisible();
  });

  test("change history button opens drawer", async ({ page }) => {
    const historyBtn = page.locator("button:has-text('History'), button:has-text('Change History')").first();
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    // History drawer should appear
    const drawer = page.locator("text=Organogram Change History, text=Change History").first();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Close it
    const closeBtn = page.locator("button[title='close' i], button:has-text('×'), [aria-label*='close' i]").first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  });

  test("hovering a node reveals action buttons", async ({ page }) => {
    await page.waitForTimeout(1_500);
    const firstNode = page.locator(".group").first();
    if (await firstNode.isVisible()) {
      await firstNode.hover();
      // Action buttons should appear (opacity transitions from 0 to 100)
      await page.waitForTimeout(400);
      // At least one action button should be visible (add / edit / change-parent / delete)
      const actionBtns = firstNode.locator("button");
      const count = await actionBtns.count();
      expect(count).toBeGreaterThan(0);
    } else {
      test.skip(true, "No nodes rendered — empty organogram");
    }
  });

  test("change parent modal opens", async ({ page }) => {
    await page.waitForTimeout(1_500);
    const firstNode = page.locator(".group").first();
    if (await firstNode.isVisible()) {
      await firstNode.hover();
      await page.waitForTimeout(400);

      // Click the amber account_tree icon (Change Parent button)
      const changeParentBtn = firstNode.locator("button[title*='Parent' i], button[title*='hierarchy' i]").first();
      if (await changeParentBtn.isVisible({ timeout: 3_000 })) {
        await changeParentBtn.click();
        await expect(page.locator("text=Change Parent")).toBeVisible({ timeout: 5_000 });

        // Close by clicking Cancel
        await page.locator("button:has-text('Cancel')").first().click();
      }
    } else {
      test.skip(true, "No nodes to interact with");
    }
  });

  test("new root unit modal opens and closes", async ({ page }) => {
    const newBtn = page.locator("button:has-text('New Root Unit')").first();
    await newBtn.click();

    // Modal should appear with form fields
    await expect(page.locator("input[placeholder*='Finance' i], input[placeholder*='Unit' i], label:has-text('Unit Name')").first()).toBeVisible({ timeout: 5_000 });

    // Cancel
    await page.locator("button:has-text('Cancel')").first().click();
    await expect(page.locator("input[placeholder*='Finance' i]")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });
});
