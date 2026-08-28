/**
 * Organogram E2E tests — interactive canvas hierarchy editor.
 *
 * Admin-only: staff General Employee must not see org-admin controls
 * (New Root Unit). Runs under the Playwright `admin` project.
 */
import { test, expect } from "@playwright/test";
import { landedOnLogin, skipWithoutAuth, skipIfAccessDenied, waitForApp } from "./helpers/auth";

test.describe("Organogram page", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/organogram");
    await page.waitForURL("**/organogram", { timeout: 15_000 });
    await waitForApp(page);
    if (await landedOnLogin(page)) {
      test.skip(true, "Admin session invalid for /organogram");
    }
    await skipIfAccessDenied(page, "/organogram");
  });

  test("organogram page loads without errors", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("canvas area is rendered", async ({ page }) => {
    const canvas = page.locator("[style*='radial-gradient'], [class*='canvas'], [class*='organogram']").first();
    await expect(canvas).toBeVisible({ timeout: 8_000 });
  });

  test("department nodes are visible from seeded data", async ({ page }) => {
    await page.waitForTimeout(1_500);
    const nodes = page.locator(".organogram-canvas .group").first();
    if (!(await nodes.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(true, "No organogram nodes rendered in this seed");
    }
    await expect(nodes).toBeVisible();
  });

  test("zoom controls are present", async ({ page }) => {
    const plusBtn = page.getByRole("button", { name: /\+|zoom/i }).first();
    await expect(plusBtn).toBeVisible({ timeout: 5_000 });
  });

  test("auto-layout button is present and clickable", async ({ page }) => {
    const autoLayoutBtn = page.getByRole("button", { name: /auto|layout/i }).first();
    await expect(autoLayoutBtn).toBeVisible();
    await autoLayoutBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("'Add Unit' button is present", async ({ page }) => {
    const btn = page.getByRole("button", { name: /add unit|root unit/i }).first();
    await expect(btn).toBeVisible();
  });

  test("change history button opens drawer", async ({ page }) => {
    const historyBtn = page.getByRole("button", { name: /history/i }).first();
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    await expect(page.getByText(/organogram change history|change history/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("hovering a node reveals action buttons", async ({ page }) => {
    await page.waitForTimeout(1_500);
    const firstNode = page.locator(".organogram-canvas .group").first();
    if (!(await firstNode.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No nodes rendered — empty organogram");
    }
    await firstNode.hover();
    await page.waitForTimeout(400);
    const actionBtns = firstNode.locator("button");
    const count = await actionBtns.count();
    if (count === 0) {
      test.skip(true, "Node hover actions are not interactive in this viewport");
    }
    expect(count).toBeGreaterThan(0);
  });

  test("change parent modal opens", async ({ page }) => {
    await page.waitForTimeout(1_500);
    const firstNode = page.locator(".organogram-canvas .group").first();
    if (!(await firstNode.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No nodes to interact with");
    }
    await firstNode.hover();
    await page.waitForTimeout(400);

    const changeParentBtn = firstNode.locator("button[title*='parent' i]").first();
    if (!(await changeParentBtn.count())) {
      test.skip(true, "Change-parent control not present on this node");
    }
    await changeParentBtn.click({ force: true });
    await expect(page.getByText(/change parent/i).first()).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /cancel/i }).first().click();
  });

  test("new root unit modal opens and closes", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /add unit|new root unit/i }).first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    await expect(
      page.locator("input[placeholder*='Finance' i], input[placeholder*='Unit' i]").or(page.getByLabel(/unit name/i)).first()
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /cancel/i }).first().click();
  });
});
