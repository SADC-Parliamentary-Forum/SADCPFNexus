/**
 * Timesheets template admin + Travel queue filter follow-ups.
 *
 * Runs under the Playwright `admin` project (see playwright.config.ts).
 * Skip policy matches helpers/auth.ts when the admin fixture is empty.
 *
 * Run:
 *   cd web && npx playwright test tests/e2e/timesheets-travel-followups.spec.ts --project=admin
 */
import { test, expect } from "@playwright/test";
import { landedOnLogin, skipWithoutAuth } from "./helpers/auth";

async function expectNoServerCrash(page: import("@playwright/test").Page) {
  await expect(page.locator("body")).not.toContainText(
    /(Internal Server Error|Unhandled Runtime Error|Exception)/i
  );
}

test.describe("Timesheet templates admin", () => {
  test.beforeEach(() => {
    skipWithoutAuth("admin");
  });

  test("list loads; create or deactivate smoke", async ({ page }) => {
    await page.goto("/hr/timesheets/templates");
    await page.waitForLoadState("networkidle");

    if (await landedOnLogin(page)) {
      test.skip(true, "Admin session invalid — re-run global.setup against seeded API");
    }

    // Password/MFA gate may park on /profile/security after login.
    if (page.url().includes("/profile/security")) {
      test.skip(true, "Admin must complete security/password gate before module smokes");
    }

    await expect(page).toHaveURL(/\/hr\/timesheets\/templates/, { timeout: 20_000 });
    await expect(
      page
        .getByTestId("timesheet-templates-title")
        .or(page.getByRole("heading", { name: /Timesheet templates/i }))
    ).toBeVisible({ timeout: 15_000 });
    await expectNoServerCrash(page);

    const list = page.getByTestId("timesheet-templates-list");
    await expect(list).toBeVisible({ timeout: 15_000 });

    const newBtn = page.getByTestId("timesheet-templates-new");
    const canManage = await newBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!canManage) {
      await expect(
        list.locator("table, [data-testid='timesheet-templates-empty']").first()
      ).toBeVisible();
      return;
    }

    const unique = `E2E-${Date.now().toString(36)}`;
    await newBtn.click();
    await expect(page.getByTestId("timesheet-templates-form")).toBeVisible();

    await page.getByTestId("timesheet-template-name").fill(`${unique} Donor week`);
    await page
      .getByTestId("timesheet-template-code")
      .fill(`E2E${unique.slice(-6).toUpperCase()}`);
    await page.getByTestId("timesheet-template-save").click();

    await expect(page.getByTestId("timesheet-templates-form")).toBeHidden({
      timeout: 15_000,
    });
    await expect(list.getByText(`${unique} Donor week`)).toBeVisible({
      timeout: 15_000,
    });

    const row = list.locator("tr", { hasText: `${unique} Donor week` }).first();
    await expect(row).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: /deactivate/i }).click();
    await expect(row.getByText(/inactive/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Travel approval queue filters", () => {
  test.beforeEach(() => {
    skipWithoutAuth("admin");
  });

  test("stage, requester, and date range controls work", async ({ page }) => {
    await page.goto("/travel/queues/approval");
    await page.waitForLoadState("networkidle");

    if (await landedOnLogin(page)) {
      test.skip(true, "Admin session invalid — re-run global.setup against seeded API");
    }
    if (page.url().includes("/profile/security")) {
      test.skip(true, "Admin must complete security/password gate before module smokes");
    }

    await expect(page).toHaveURL(/\/travel\/queues\/approval/, { timeout: 20_000 });
    await page.evaluate(() => {
      try {
        localStorage.removeItem("travel-queue-prefs:approval");
      } catch {
        /* ignore */
      }
    });
    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /Pending My Approval/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("travel-queue-filters")).toBeVisible({
      timeout: 15_000,
    });
    await expectNoServerCrash(page);

    const stage = page.getByTestId("travel-queue-stage-filter");
    const requester = page.getByTestId("travel-queue-requester-filter");
    const dateFrom = page.getByTestId("travel-queue-date-from");
    const dateTo = page.getByTestId("travel-queue-date-to");

    await expect(stage).toBeVisible();
    await expect(requester).toBeVisible();
    await expect(dateFrom).toBeVisible();
    await expect(dateTo).toBeVisible();

    // Options use computed stage labels (Submitted), not raw status keys.
    const stageValues = await stage.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value)
    );
    expect(stageValues).toContain("Submitted");
    expect(stageValues).not.toContain("submitted");

    await stage.selectOption("Submitted");
    await expect(stage).toHaveValue("Submitted");

    const from = new Date();
    from.setDate(from.getDate() + 1);
    const to = new Date();
    to.setDate(to.getDate() + 60);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    await dateFrom.fill(iso(from));
    await dateTo.fill(iso(to));
    await expect(dateFrom).toHaveValue(iso(from));
    await expect(dateTo).toHaveValue(iso(to));

    // Wait for list reload after filters (proxy may rewrite /api/v1 → relative).
    await page.waitForLoadState("networkidle");

    const requesterOptions = await requester.locator("option").count();
    if (requesterOptions > 1) {
      const value = await requester.locator("option").nth(1).getAttribute("value");
      if (value) {
        await requester.selectOption(value);
        await expect(requester).toHaveValue(value);
        await page.waitForLoadState("networkidle");
      }
    }

    await expectNoServerCrash(page);
    await expect(
      page
        .locator("table.data-table")
        .or(page.getByText("No matches for these filters"))
        .or(page.getByText("No items in this queue"))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
