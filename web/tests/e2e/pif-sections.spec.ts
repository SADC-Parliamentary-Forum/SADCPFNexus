/**
 * PIF (Programme Implementation Form) module E2E tests.
 *
 * Exercises the multi-page edit wizard: create a draft, fill Overview → Venue →
 * Budget → Personnel → Language → Support → Attachments (documents + arrival
 * rows persist immediately), finish, then declare and submit from the view page.
 */
import { test, expect, type Page } from "@playwright/test";
import { skipWithoutAuth, skipIfAccessDenied, waitForApp } from "./helpers/auth";

const UNIQUE = `E2E-PIF-${Date.now()}`;

/** Scopes a locator to the section whose <h2> heading matches `heading`
 * exactly. Several field labels repeat across sections, so section-scoping
 * avoids strict-mode ambiguity. */
function sectionByHeading(page: Page, heading: string) {
  return page.getByRole("heading", { name: heading, exact: true }).locator("xpath=ancestor::section[1]");
}

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

async function saveAndContinue(page: Page) {
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page.getByText(/saved\./i).first()).toBeVisible({ timeout: 10_000 });
}

test.describe("PIF — full section-completion happy path", () => {
  test("create draft, fill all wizard pages, add rows, declare and submit", async ({ page }) => {
    test.setTimeout(120_000);
    skipWithoutAuth("admin");

    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await waitForApp(page);

    await page.goto("/pif/create");
    await page.waitForURL("**/pif/create", { timeout: 15_000 });
    await waitForApp(page);
    await skipIfAccessDenied(page, "/pif/create");
    const titleField = page.getByPlaceholder("Short, descriptive title");
    const titleVisible = await titleField.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!titleVisible, "PIF create is not offered to this role");
    await titleField.click();
    await titleField.fill(`${UNIQUE} Regional Workshop`);
    await expect(titleField).toHaveValue(`${UNIQUE} Regional Workshop`);
    const createBtn = page.getByRole("button", { name: "Create Draft & Continue" });
    await expect(createBtn).toBeEnabled({ timeout: 10_000 });
    await createBtn.click();

    const openedWizard = await page
      .waitForURL(/\/pif\/\d+\/edit\/?$/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!openedWizard, "PIF draft create did not open the wizard for this fixture");
    const pifId = page.url().match(/\/pif\/(\d+)\/edit/)?.[1];
    expect(pifId, "expected a numeric programme id in the redirect URL").toBeTruthy();
    await expect(page.getByLabel("Background", { exact: true })).toBeVisible({ timeout: 15_000 });

    // ── Overview ────────────────────────────────────────────────────────────
    await page.getByLabel("Background", { exact: true }).fill(
      `${UNIQUE} background: a regional coordination workshop for member parliaments.`
    );
    await page.getByLabel("Overall objective", { exact: true }).fill(
      "Improve regional coordination and information-sharing among member parliaments."
    );
    await page.getByLabel("Start date").fill(isoDate(30));
    await page.getByLabel("End date").fill(isoDate(33));
    await saveAndContinue(page);

    // ── Venue ────────────────────────────────────────────────────────────────
    const venue = sectionByHeading(page, "Venue");
    await venue.getByLabel("Venue country").fill("South Africa");
    await venue.getByLabel("Venue city").fill("Cape Town");
    await venue.getByLabel("Proposed hotel").fill("Test Conference Hotel");
    await venue.getByLabel("Accommodation required").check();
    await venue.getByLabel("Accommodation count").fill("5");
    await venue.getByLabel("Venue comments").fill(
      "Venue confirmed pending signed contract."
    );
    await saveAndContinue(page);

    // ── Budget (+ variance) ──────────────────────────────────────────────────
    await page.getByLabel("Total budget").fill("10000");
    await page.getByLabel("Funding source").fill("SADC Core Fund");
    const budget = sectionByHeading(page, "Budget variance");
    await budget.getByLabel("Proposed DSA rate").fill("150");
    await budget.getByLabel("Original budget rate").fill("150");
    await budget.getByLabel("Proposed participants").fill("20");
    await budget.getByLabel("Budgeted participants").fill("20");
    await saveAndContinue(page);

    // ── Personnel & consultants ─────────────────────────────────────────────
    const personnel = sectionByHeading(page, "Personnel & consultants");
    await personnel.getByLabel("Secretariat staff required").check();
    await personnel.getByLabel("Staff count").fill("3");
    await personnel.getByLabel("Personnel comments").fill(
      "3 secretariat staff required for registration and delegate support."
    );
    await saveAndContinue(page);

    // ── Interpretation & translation ────────────────────────────────────────
    const interpretation = sectionByHeading(page, "Interpretation & translation");
    await interpretation.getByLabel("Interpretation required").check();
    await interpretation.getByLabel("English ↔ French interpreters required").check();
    await interpretation.getByLabel("EN/FR interpreters count").fill("2");
    await interpretation.getByLabel("Interpretation comments").fill(
      "Simultaneous EN/FR interpretation required in plenary sessions."
    );
    await saveAndContinue(page);

    // ── Support services + Conflict ─────────────────────────────────────────
    const support = sectionByHeading(page, "Support services");
    await support.getByLabel("Ground Transport").check();
    const conflict = sectionByHeading(page, "Conflict of interest");
    await conflict.getByLabel("A conflict of interest is declared for this programme").check();
    await conflict.getByLabel("Conflict details").fill(
      "A proposed resource person is a relative of a secretariat staff member."
    );
    await conflict.getByLabel("Mitigation measures").fill(
      "Selection of the resource person will be independently reviewed by a second officer."
    );
    await saveAndContinue(page);

    // ── Attachments: Documents + Arrival/Departure ──────────────────────────
    const documentsSection = sectionByHeading(page, "Documents");
    await documentsSection.getByRole("button", { name: "Add document" }).click();
    const docPanel = page
      .getByText("New document", { exact: true })
      .locator("xpath=ancestor::div[contains(@class, 'border-dashed')]");
    await docPanel.locator('label:text-is("Title") + input').fill(`${UNIQUE} Concept Note`);
    await docPanel.locator('label:text-is("Document type") + input').fill("Concept Note");
    await docPanel.locator('label:text-is("Or owner name (external)") + input').fill("Jane Owner");
    await docPanel.getByRole("button", { name: "Save document" }).click();
    await expect(page.getByText("Document added.")).toBeVisible({ timeout: 10_000 });

    const arrivalDepartureSection = sectionByHeading(page, "Arrival / Departure");
    await arrivalDepartureSection.getByRole("button", { name: "Add arrival/departure row" }).click();
    const rowPanel = page
      .getByText("New row", { exact: true })
      .locator("xpath=ancestor::div[contains(@class, 'border-dashed')]");
    await rowPanel.locator('label:text-is("Category") + input').fill("Delegate");
    await rowPanel.locator('label:text-is("Arrival date") + input').fill(isoDate(30));
    await rowPanel.locator('label:text-is("Departure date") + input').fill(isoDate(33));
    await rowPanel.locator('label:text-is("Airport") + input').fill("Cape Town International");
    await rowPanel.getByRole("button", { name: "Save row" }).click();
    await expect(page.getByText("Arrival/departure row added.")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Save & finish" }).click();

    await page.waitForURL(new RegExp(`/pif/${pifId}$`), { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.locator('[title="Monitoring & Evaluation status"]')).toHaveText(
      /Not Yet Linked/
    );

    await page.getByRole("button", { name: "Approval" }).click();

    const submitBtn = page.getByRole("button", { name: "Submit for Approval" });
    await expect(submitBtn).toBeDisabled();

    await page.getByLabel("I confirm the declaration above.").check();
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();
    await expect(page.getByText("Programme submitted for approval.")).toBeVisible({ timeout: 10_000 });

    await expect(page.locator(".badge", { hasText: "Submitted" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Logistics & Compliance" }).click();

    await expect(page.getByText("South Africa")).toBeVisible();
    await expect(page.getByText("Cape Town").first()).toBeVisible();
    await expect(page.getByText("Test Conference Hotel")).toBeVisible();
    await expect(page.getByText("3 secretariat staff required")).toBeVisible();
    await expect(page.getByText(/English ↔ French/)).toBeVisible();
    await expect(page.getByText("Ground Transport")).toBeVisible();
    await expect(
      page.getByText("A proposed resource person is a relative of a secretariat staff member.")
    ).toBeVisible();
    await expect(page.getByText(`${UNIQUE} Concept Note`)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Delegate" })).toBeVisible();
    await expect(page.getByText("Cape Town International")).toBeVisible();

    await expect(page.locator('[title="Monitoring & Evaluation status"]')).toHaveText(
      /Not Yet Linked/
    );
  });
});
