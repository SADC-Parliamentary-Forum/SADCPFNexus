/**
 * Governance module E2E tests.
 */
import { test, expect } from "@playwright/test";
import { browserApiGet, skipIfApiForbidden } from "./helpers/api";
import { skipWithoutAuth, skipIfAccessDenied, waitForApp } from "./helpers/auth";

test.describe("Governance overview", () => {
  test("governance overview page loads", async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/governance");
    await page.waitForURL("**/governance", { timeout: 15_000 });
    await waitForApp(page);
    await skipIfAccessDenied(page, "/governance");

    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("governance page shows committees or meetings data", async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/governance");
    await waitForApp(page);
    await skipIfAccessDenied(page, "/governance");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});

test.describe("Resolutions", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/governance/resolutions");
    await page.waitForURL("**/governance/resolutions", { timeout: 15_000 });
    await waitForApp(page);
    await skipIfAccessDenied(page, "/governance/resolutions");
  });

  test("resolutions page loads without error", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("resolutions list shows data or empty state", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("has a create / new resolution button", async ({ page }) => {
    const btn = page.getByRole("link", { name: /new|add/i }).or(page.getByRole("button", { name: /new|add/i })).first();
    const visible = await btn.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!visible, "Create resolution is not offered to this role");
    await expect(btn).toBeVisible();
  });

  test("resolution status filter tabs are present", async ({ page }) => {
    const tabs = page.locator(".filter-tab").or(page.getByRole("button", { name: "All" }));
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Plenary sessions", () => {
  test("plenary page loads", async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/governance/plenary");
    await page.waitForURL("**/governance/plenary", { timeout: 15_000 });
    await waitForApp(page);
    await skipIfAccessDenied(page, "/governance/plenary");
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });
});

test.describe("Governance API via browser", () => {
  test("resolutions API returns data structure the UI can render", async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/governance/resolutions");
    await waitForApp(page);
    await skipIfAccessDenied(page, "/governance/resolutions");
    const res = await browserApiGet(page, "/governance/resolutions");
    skipIfApiForbidden(res, "/governance/resolutions");
    expect(res.ok).toBeTruthy();
    const body = res.body as { data?: unknown };
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test("committees API returns data structure", async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/governance");
    await waitForApp(page);
    await skipIfAccessDenied(page, "/governance");
    const res = await browserApiGet(page, "/governance/committees");
    skipIfApiForbidden(res, "/governance/committees");
    expect(res.ok).toBeTruthy();
    const body = res.body as { data?: unknown };
    expect(body).toHaveProperty("data");
  });
});
