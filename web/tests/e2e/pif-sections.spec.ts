/**
 * PIF (Programme Implementation Form) module E2E tests.
 *
 * Exercises the full section-completion happy path introduced across the
 * "PIF Module Completion" plan: create a draft, fill in the Venue, Budget
 * variance, Personnel, Interpretation, Support services and Conflict of
 * interest sections on /pif/[id]/edit, add one Document row and one
 * Arrival/Departure row (each persisted immediately via its own API call,
 * not held for the main form submit), save the main form, then declare and
 * submit for approval from the view page (/pif/[id]) — the declaration
 * checkbox and Submit button live there, not on the edit page.
 */
import { test, expect, type Page } from "@playwright/test";

const UNIQUE = `E2E-PIF-${Date.now()}`;

/** Scopes a locator to the section whose <h2> heading matches `heading`
 * exactly. Several field labels (e.g. "Accommodation required", "Title *")
 * repeat verbatim across sections, so section-scoping avoids strict-mode
 * ambiguity instead of relying on page-wide label lookups. */
function sectionByHeading(page: Page, heading: string) {
  return page.getByRole("heading", { name: heading, exact: true }).locator("xpath=..");
}

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

test.describe("PIF — full section-completion happy path", () => {
  test("create draft, fill all sections, add rows, declare and submit", async ({ page }) => {
    test.setTimeout(120_000);

    // ── Step 1: create a draft PIF ──────────────────────────────────────────
    // A cold `storageState`-restored context has cookies but no sessionStorage
    // (Playwright's storageState snapshot does not capture sessionStorage, and
    // this app caches the authenticated user there). Landing directly on a
    // permission-gated route before AuthProvider's /auth/me rehydration
    // resolves races AppShell's route guard into bouncing through /login (which
    // clears the session) to /dashboard. Warming up on /dashboard first — an
    // unrestricted route — lets that rehydration complete before we navigate
    // to a gated route.
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

    // Confirm redirect to /pif/{id}/edit
    await page.waitForURL(/\/pif\/\d+\/edit\/?$/, { timeout: 15_000 });
    const pifId = page.url().match(/\/pif\/(\d+)\/edit/)?.[1];
    expect(pifId, "expected a numeric programme id in the redirect URL").toBeTruthy();
    await page.waitForLoadState("networkidle");

    // ── Step 2: fill top-level fields ───────────────────────────────────────
    await page.locator('label:text-is("Background") + textarea').fill(
      `${UNIQUE} background: a regional coordination workshop for member parliaments.`
    );
    await page.locator('label:text-is("Overall objective") + textarea').fill(
      "Improve regional coordination and information-sharing among member parliaments."
    );
    await page.locator('label:text-is("Total budget") + input').fill("10000");
    await page.locator('label:text-is("Funding source") + input').fill("SADC Core Fund");
    await page.locator('label:text-is("Start date") + input').fill(isoDate(30));
    await page.locator('label:text-is("End date") + input').fill(isoDate(33));

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

    // ── Budget variance ─────────────────────────────────────────────────────
    const budget = sectionByHeading(page, "Budget variance");
    // Equal proposed/original values so the conditional "variance reason" field
    // (only required when the two differ) does not need to be filled.
    await budget.locator('label:text-is("Proposed DSA rate") + input').fill("150");
    await budget.locator('label:text-is("Original budget rate") + input').fill("150");
    await budget.locator('label:text-is("Proposed participants") + input').fill("20");
    await budget.locator('label:text-is("Budgeted participants") + input').fill("20");

    // ── Personnel & consultants ─────────────────────────────────────────────
    const personnel = sectionByHeading(page, "Personnel & consultants");
    await personnel.getByLabel("Secretariat staff required").check();
    await personnel.locator('label:text-is("Staff count") + input').fill("3");
    await personnel.locator('label:text-is("Personnel comments") + textarea').fill(
      "3 secretariat staff required for registration and delegate support."
    );

    // ── Interpretation & translation ────────────────────────────────────────
    const interpretation = sectionByHeading(page, "Interpretation & translation");
    await interpretation.getByLabel("Interpretation required").check();
    await interpretation.getByLabel("English ↔ French interpreters required").check();
    await interpretation.locator('label:text-is("EN/FR interpreters count") + input').fill("2");
    await interpretation.locator('label:text-is("Interpretation comments") + textarea').fill(
      "Simultaneous EN/FR interpretation required in plenary sessions."
    );

    // ── Support services ─────────────────────────────────────────────────────
    const support = sectionByHeading(page, "Support services");
    await support.getByLabel("Ground Transport").check();

    // ── Conflict of interest ─────────────────────────────────────────────────
    const conflict = sectionByHeading(page, "Conflict of interest");
    await conflict.getByLabel("A conflict of interest is declared for this programme").check();
    await conflict.locator('label:text-is("Conflict details") + textarea').fill(
      "A proposed resource person is a relative of a secretariat staff member."
    );
    await conflict.locator('label:text-is("Mitigation measures") + textarea').fill(
      "Selection of the resource person will be independently reviewed by a second officer."
    );

    // ── Documents: add one row (persisted immediately via its own API call) ─
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

    // ── Arrival / Departure: add one row (also persisted immediately) ───────
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

    // ── Step 3: save the main form ──────────────────────────────────────────
    await page.getByRole("button", { name: "Save changes" }).click();

    // Save redirects from /pif/{id}/edit to the view page /pif/{id}.
    await page.waitForURL(new RegExp(`/pif/${pifId}$`), { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // M&E status starts out "Not Yet Linked" — visible in the header regardless of tab.
    await expect(page.locator('[title="Monitoring & Evaluation status"]')).toHaveText(
      /Not Yet Linked/
    );

    // ── Step 4: declaration gates Submit, then submit for approval ─────────
    // The declaration checkbox and Submit button live on the VIEW page's
    // Approval tab (not the edit page) — confirmed during Task 20 review.
    await page.getByRole("button", { name: "Approval" }).click();

    const submitBtn = page.getByRole("button", { name: "Submit for Approval" });
    await expect(submitBtn).toBeDisabled();

    await page.getByLabel("I confirm the declaration above.").check();
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();
    await expect(page.getByText("Programme submitted for approval.")).toBeVisible({ timeout: 10_000 });

    // Status badge in the header updates to "Submitted".
    await expect(page.getByText("Submitted", { exact: true })).toBeVisible();

    // ── Step 5: verify entered values render on the Logistics & Compliance tab ─
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

    // M&E status remains "Not Yet Linked" after submission — it is only
    // updated once M&E links a record to this programme, which is out of
    // scope for the PIF submission flow itself.
    await expect(page.locator('[title="Monitoring & Evaluation status"]')).toHaveText(
      /Not Yet Linked/
    );
  });
});
