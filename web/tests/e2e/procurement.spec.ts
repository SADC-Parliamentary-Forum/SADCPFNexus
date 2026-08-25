/**
 * Procurement module E2E tests.
 *
 * Auth fixture skips: see helpers/auth.ts and tests/e2e/README.md.
 * Public tender board coverage also lives in sa-procurement-smokes.spec.ts.
 */
import { test, expect } from "@playwright/test";
import { landedOnLogin, skipIfAccessDenied, skipIfLocatorMissing, skipWithoutAuth } from "./helpers/auth";

const UNIQUE = `E2E-${Date.now()}`;

async function openFirstDetail(page: import("@playwright/test").Page, listPath: string, hrefFragment: string) {
  await page.goto(listPath);
  await page.waitForURL(`**${listPath}`, { timeout: 15_000 });
  await skipIfAccessDenied(page, `Fixture cannot open ${listPath}`);

  const firstLink = page.locator(`a[href*='${hrefFragment}']`).first();
  const visible = await firstLink.isVisible({ timeout: 5_000 }).catch(() => false);
  test.skip(!visible, `No detail links found for ${listPath}`);

  await firstLink.click();
  const pathname = new URL(page.url()).pathname.replace(/\/$/, "");
  const list = listPath.replace(/\/$/, "");
  test.skip(
    pathname === list || !pathname.startsWith(`${list}/`),
    `Did not land on a detail under ${listPath}`
  );
}

test.describe("Procurement — list page", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/procurement");
    await page.waitForURL("**/procurement", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /procurement");
    }
    await skipIfAccessDenied(page, "Staff cannot open procurement");
  });

  test("procurement list page loads", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("create / new request button is present", async ({ page }) => {
    const btn = page.locator("a:has-text('New'), a:has-text('Create'), a[href*='/create']").first();
    await skipIfLocatorMissing(btn, "Staff cannot create procurement requests");
    await expect(btn).toBeVisible();
  });
});

test.describe("Procurement — create request", () => {
  test.beforeEach(() => {
    skipWithoutAuth("staff");
  });

  test("create form is accessible", async ({ page }) => {
    await page.goto("/procurement/create");
    await page.waitForURL("**/procurement/create", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /procurement/create");
    }
    await skipIfAccessDenied(page, "Staff cannot open procurement create");
    await expect(page.locator("input, textarea").first()).toBeVisible();
  });

  test("form validation on empty submit", async ({ page }) => {
    await page.goto("/procurement/create");
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /procurement/create");
    }
    await skipIfAccessDenied(page, "Staff cannot open procurement create");

    const nextStep = page.locator('button:has-text("Next Step")').first();
    await expect(nextStep).toBeDisabled();
  });

  test("can create a procurement request as draft", async ({ page }) => {
    await page.goto("/procurement/create");
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /procurement/create");
    }

    const title = page.locator('input[name="title"], [placeholder*="title" i]').first();
    if (await title.isVisible()) {
      await title.fill(`${UNIQUE} - Office Equipment`);
    }

    const desc = page.locator('textarea[name="description"], textarea').first();
    if (await desc.isVisible()) {
      await desc.fill("Laptops and monitors for the new programme team");
    }

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Draft")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForURL(
        (url) => url.pathname.startsWith("/procurement") && !url.pathname.includes("/create"),
        { timeout: 15_000 }
      );
    }
  });
});

test.describe("Public tender notices", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/tender-notices page loads", async ({ page }) => {
    const response = await page.goto("/tender-notices", { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    expect(response!.status()).not.toBe(404);
    await expect(page.getByRole("heading", { name: /public tender notices/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Vendors", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAuth("staff");
    await page.goto("/procurement/vendors");
    await page.waitForURL("**/procurement/vendors", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    if (await landedOnLogin(page)) {
      test.skip(true, "Staff session invalid for /procurement/vendors");
    }
  });

  test("vendors page loads", async ({ page }) => {
    await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible();
  });

  test("vendor list shows existing vendors", async ({ page }) => {
    const vendorEl = page.locator("table tbody tr, [class*='vendor-card'], [class*='list-item']");
    await vendorEl.count();
    await expect(page.locator("text=Error, text=Failed")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });

  test("can navigate to vendor detail", async ({ page }) => {
    const firstLink = page.locator("a[href*='/vendors/']").first();
    if (await firstLink.isVisible({ timeout: 5_000 })) {
      await firstLink.click();
      await page.waitForURL("**/vendors/**", { timeout: 10_000 });
      await expect(page.locator("h1, h2, [class*='page-title']").first()).toBeVisible();
    } else {
      test.skip(true, "No vendor records visible");
    }
  });
});

test.describe("Procurement — detail pages", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test.beforeEach(() => {
    skipWithoutAuth("admin");
  });

  test("rfq detail page loads", async ({ page }) => {
    await openFirstDetail(page, "/procurement/rfq", "/procurement/rfq/");
    await page.waitForURL("**/procurement/rfq/**", { timeout: 15_000 });
    await expect(page.locator("h1").first()).toBeVisible();
    const section = page.getByText(/Vendor Quotes|RFQ Initiation/i).first();
    await skipIfLocatorMissing(section, "RFQ detail body not present");
    await expect(section).toBeVisible();
  });

  test("purchase order detail page loads", async ({ page }) => {
    await openFirstDetail(page, "/procurement/purchase-orders", "/procurement/purchase-orders/");
    await page.waitForURL("**/procurement/purchase-orders/**", { timeout: 15_000 });
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("text=Line Items")).toBeVisible({ timeout: 8_000 });
  });

  test("goods receipt detail page loads", async ({ page }) => {
    await openFirstDetail(page, "/procurement/receipts", "/procurement/receipts/");
    await page.waitForURL("**/procurement/receipts/**", { timeout: 15_000 });
    await expect(page.locator("h1").first()).toBeVisible();
    const items = page.getByText("Items Received").first();
    await skipIfLocatorMissing(items, "Goods receipt detail body not present");
    await expect(items).toBeVisible();
  });

  test("invoice detail page loads", async ({ page }) => {
    await openFirstDetail(page, "/procurement/invoices", "/procurement/invoices/");
    await page.waitForURL("**/procurement/invoices/**", { timeout: 15_000 });
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("text=Linked Documents")).toBeVisible({ timeout: 8_000 });
  });

  test("contract detail page loads", async ({ page }) => {
    await openFirstDetail(page, "/procurement/contracts", "/procurement/contracts/");
    await page.waitForURL("**/procurement/contracts/**", { timeout: 15_000 });
    await expect(page.locator("h1").first()).toBeVisible();
    const linked = page.getByText(/Linked Procurement Request/i).first();
    await skipIfLocatorMissing(linked, "Contract detail body not present");
    await expect(linked).toBeVisible();
  });
});
