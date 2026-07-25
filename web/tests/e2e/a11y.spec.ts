/**
 * Accessibility smoke (@axe-core/playwright).
 *
 * Soft gate: set AXE_SOFT=1 to log serious/critical violations without failing CI
 * while baselines are fixed. Default is hard-fail on critical + serious.
 *
 * Run: npm run test:a11y
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const soft = process.env.AXE_SOFT === "1" || process.env.AXE_SOFT === "true";

async function assertNoCriticalOrSerious(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  if (soft && critical.length > 0) {
    console.warn(`[a11y soft] ${label}: ${critical.length} serious/critical\n`, JSON.stringify(critical, null, 2));
    return;
  }
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
}

test.describe("a11y scaffold", () => {
  test("login page has no critical axe violations", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await assertNoCriticalOrSerious(page, "login");
    await context.close();
  });

  test("dashboard has no critical axe violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await assertNoCriticalOrSerious(page, "dashboard");
  });
});
