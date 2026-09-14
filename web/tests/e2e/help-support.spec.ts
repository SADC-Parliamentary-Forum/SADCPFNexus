/**
 * Help & Support ticket CRUD via the row actions menu.
 */
import { test, expect } from "@playwright/test";
import { landedOnLogin, skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";

test.describe("Help & Support", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/profile/support");
    await waitForApp(page);
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /profile/support");
    }
    await skipIfAccessDenied(page, "/profile/support");
  });

  test("staff can create, view, edit, and delete a ticket from the three-dot menu", async ({ page }) => {
    const stamp = Date.now();
    const subject = `E2E support ${stamp}`;
    const updated = `E2E support updated ${stamp}`;

    await expect(page.getByRole("heading", { name: /help & support/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /new ticket/i }).click();
    await page.getByLabel(/subject/i).fill(subject);
    await page.getByLabel(/description/i).fill("Created by Playwright to exercise ticket actions.");
    await page.getByRole("button", { name: /submit ticket/i }).click();

    const card = page.getByTestId("support-ticket-card").filter({ hasText: subject });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByTestId("support-ticket-actions").click();
    await page.getByRole("menuitem", { name: /^view$/i }).click();
    await expect(page.getByTestId("support-ticket-detail")).toContainText(subject);

    await card.getByTestId("support-ticket-actions").click();
    await page.getByRole("menuitem", { name: /^edit$/i }).click();
    await expect(page.getByRole("heading", { name: /edit support ticket/i })).toBeVisible();
    await page.getByLabel(/subject/i).fill(updated);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByTestId("support-ticket-card").filter({ hasText: updated })).toBeVisible({ timeout: 15_000 });

    const updatedCard = page.getByTestId("support-ticket-card").filter({ hasText: updated });
    await updatedCard.getByTestId("support-ticket-actions").click();
    await page.getByRole("menuitem", { name: /^delete$/i }).click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await expect(page.getByTestId("support-ticket-card").filter({ hasText: updated })).toHaveCount(0, { timeout: 15_000 });
  });
});
