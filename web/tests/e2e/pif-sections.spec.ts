/**
 * PIF (Programme Implementation Form) module E2E tests.
 *
 * Exercises the multi-page edit wizard: create a draft, fill Overview → Venue →
 * Budget → Personnel → Language → Support → Attachments (documents + arrival
 * rows persist immediately), finish, then declare and submit from the view page.
 */
import { test, expect, type Page } from "@playwright/test";

const UNIQUE = `E2E-PIF-${Date.now()}`;

/** Scopes a locator to the section whose <h2> heading matches `heading`
 * exactly. Several field labels repeat across sections, so section-scoping
 * avoids strict-mode ambiguity. */
function sectionByHeading(page: Page, heading: string) {
  return page.getByRole("heading", { name: heading, exact: true }).locator("xpath=..");
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

    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await page.goto("/pif/create");
    await page.waitForURL("**/pif/create", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    const titleField = page.getByPlaceholder("Short, descriptive title");
    await titleField.click();
    await titleField.fill(`${UNIQUE} Regional Workshop`);
    await expect(titleField).toHaveValue(`${UNIQUE} Regional Workshop`);
    const createBtn = page.getByRole("button", { name: "Create Draft & Continue" });
    await expect(createBtn).toBeEnabled({ timeout: 10_000 });
    await createBtn.click();

    await page.waitForURL(/\/pif\/\d+\/edit\/?$/, { timeout: 15_000 });
    const pifId = page.url().match(/\/pif\/(\d+)\/edit/)?.[1];
    expect(pifId, "expected a numeric programme id in the redirect URL").toBeTruthy();
    await page.waitForLoadState("networkidle");

    // ── Overview ────────────────────────────────────────────────────────────
    await page.locator('label:text-is("Background") + textarea').fill(
      `${UNIQUE} background: a regional coordination workshop for member parliaments.`
    );
    await page.locator('label:text-is("Overall objective") + textarea').fill(
      "Improve regional coordination and information-sharing among member parliaments."
    );
    await page.locator('label:text-is("Start date") + input').fill(isoDate(30));
    await page.locator('label:text-is("End date") + input').fill(isoDate(33));
    await saveAndContinue(page);

    // ── Venue ────────────────────────────────────────────────────────────────
    const venue = sectionByHeading(page, "Venue");
    await venue.locator('label:text-is("Venue country") + input').fill("South Africa");
    await venue.locator('label:text-is("Venue city") + input').fill("Cape Town");
    await venue.locator('label:text-is("Proposed hotel") + input').fill("Test Conference Hotel");
    await venue.getByLabel("Accommodation required").check();
    await venue.locator('label:text-is("Accommodation count") + input').fill("5");
    await venue.locator('label:text-is("Venue comments") + textarea').fill(
      "Venue confirmed pending signed contract."
    );
    await saveAndContinue(page);

    // ── Budget (+ variance) ──────────────────────────────────────────────────
    await page.locator('label:text-is("Total budget") + input').fill("10000");
    await page.locator('label:text-is("Funding source") + input').fill("SADC Core Fund");
    const budget = sectionByHeading(page, "Budget variance");
    await budget.locator('label:text-is("Proposed DSA rate") + input').fill("150");
    await budget.locator('label:text-is("Original budget rate") + input').fill("150");
    await budget.locator('label:text-is("Proposed participants") + input').fill("20");
    await budget.locator('label:text-is("Budgeted participants") + input').fill("20");
    await saveAndContinue(page);

    // ── Personnel & consultants ─────────────────────────────────────────────
    const personnel = sectionByHeading(page, "Personnel & consultants");
    await personnel.getByLabel("Secretariat staff required").check();
    await personnel.locator('label:text-is("Staff count") + input').fill("3");
    await personnel.locator('label:text-is("Personnel comments") + textarea').fill(
      "3 secretariat staff required for registration and delegate support."
    );
    await saveAndContinue(page);

    // ── Interpretation & translation ────────────────────────────────────────
    const interpretation = sectionByHeading(page, "Interpretation & translation");
    await interpretation.getByLabel("Interpretation required").check();
    await interpretation.getByLabel("English ↔ French interpreters required").check();
    await interpretation.locator('label:text-is("EN/FR interpreters count") + input').fill("2");
    await interpretation.locator('label:text-is("Interpretation comments") + textarea').fill(
      "Simultaneous EN/FR interpretation required in plenary sessions."
    );
    await saveAndContinue(page);

    // ── Support services + Conflict ─────────────────────────────────────────
    const support = sectionByHeading(page, "Support services");
    await support.getByLabel("Ground Transport").check();
    const conflict = sectionByHeading(page, "Conflict of interest");
    await conflict.getByLabel("A conflict of interest is declared for this programme").check();
    await conflict.locator('label:text-is("Conflict details") + textarea').fill(
      "A proposed resource person is a relative of a secretariat staff member."
    );
    await conflict.locator('label:text-is("Mitigation measures") + textarea').fill(
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

    await expect(page.getByText("Submitted", { exact: true })).toBeVisible();

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
