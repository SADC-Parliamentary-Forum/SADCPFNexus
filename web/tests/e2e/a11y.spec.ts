/**
 * Accessibility smoke scaffold (@axe-core/playwright).
 *
 * Run: npx playwright test tests/e2e/a11y.spec.ts --project=staff
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("a11y scaffold", () => {
  test("login page has no critical axe violations", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
    await context.close();
  });

  test("dashboard has no critical axe violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});
