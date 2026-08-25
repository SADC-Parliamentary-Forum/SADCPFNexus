/**
 * Organogram E2E tests — interactive canvas hierarchy editor.
 *
 * `/organogram` is an admin-only route. Staff fixtures assert the access-denied
 * gate; editor smokes skip when the role cannot open the chart.
 */
import { test, expect } from "@playwright/test";

async function organogramDenied(page: import("@playwright/test").Page): Promise<boolean> {
  return page.getByText(/Access denied/i).isVisible({ timeout: 2_000 }).catch(() => false);
}

test.describe("Organogram access", () => {
  test("page is reachable or access-denied for this role", async ({ page }) => {
    await page.goto("/organogram");
    await page.waitForLoadState("networkidle");
    const heading = page.locator("h1, [class*='page-title']").first();
    const denied = page.getByText(/Access denied/i);
    await expect(heading.or(denied).first()).toBeVisible();
  });
});

test.describe("Organogram editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/organogram");
    await page.waitForURL("**/organogram", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    if (await organogramDenied(page)) {
      test.skip(true, "Organogram is admin-only for this fixture");
    }
  });

  test("canvas area is rendered", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Organisation Chart/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Zoom in/i })).toBeVisible({ timeout: 8_000 });
  });

  test("department nodes are visible from seeded data", async ({ page }) => {
    await page.waitForTimeout(1_500);
    const nodes = page.locator(".group").first();
    await expect(nodes).toBeVisible({ timeout: 8_000 });
  });

  test("zoom controls are present", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Zoom in/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /Zoom out/i })).toBeVisible();
  });

  test("auto-layout button is present and clickable", async ({ page }) => {
    const autoLayoutBtn = page.getByRole("button", { name: /Auto-Layout/i });
    await expect(autoLayoutBtn).toBeVisible();
    await autoLayoutBtn.click();
    await expect(page.getByRole("heading", { name: /Organisation Chart/i })).toBeVisible();
  });

  test("'New Root Unit' button is present", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Add Unit/i });
    await expect(btn).toBeVisible();
  });

  test("change history button opens drawer", async ({ page }) => {
    const historyBtn = page.getByRole("button", { name: /^History$/i });
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    const drawer = page.getByText(/Organogram Change History|Change History/i).first();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    const closeBtn = page.getByRole("button", { name: /close/i }).first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  });

  test("hovering a node reveals action buttons", async ({ page }) => {
    await page.waitForTimeout(1_500);
    const firstNode = page.locator(".group").first();
    if (await firstNode.isVisible()) {
      await firstNode.hover();
      await page.waitForTimeout(400);
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

      const changeParentBtn = firstNode.locator("button[title*='Parent' i], button[title*='hierarchy' i]").first();
      if (await changeParentBtn.isVisible({ timeout: 3_000 })) {
        await changeParentBtn.click();
        await expect(page.getByText(/Change Parent/i)).toBeVisible({ timeout: 5_000 });
        await page.getByRole("button", { name: /Cancel/i }).first().click();
      }
    } else {
      test.skip(true, "No nodes to interact with");
    }
  });

  test("new root unit modal opens and closes", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /Add Unit/i });
    await newBtn.click();

    await expect(
      page.getByLabel(/unit name|name/i).or(page.locator("input").first())
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /Cancel/i }).first().click();
  });
});
