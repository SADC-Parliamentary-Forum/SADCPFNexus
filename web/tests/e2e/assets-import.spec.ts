/**
 * Asset register import / public QR / label print smokes.
 */
import path from "path";
import { test, expect } from "@playwright/test";
import { skipIfAccessDenied, skipWithoutAuth, waitForApp } from "./helpers/auth";

const templateXlsx = path.join(
  process.cwd(),
  "..",
  "api",
  "tests",
  "Fixtures",
  "asset-register",
  "nexus-e2e-template.xlsx",
);

test.describe("Assets import (admin)", () => {
  test("import page loads for an authorised admin", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/assets/import");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets import");
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="file"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Download Excel template|Télécharger le modèle Excel|Descarregar modelo Excel/i }).first()).toBeVisible();
  });

  test("labels page is authorised", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/assets/labels");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets labels");
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
  });

  test("template import, commit, public QR, and label PDF", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/assets/import");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets import flow");

    await page.getByRole("radio", { name: /Standard template|Modèle standard|Modelo padrão/i }).check();
    await page.locator('input[name="template"]').setInputFiles(templateXlsx);
    const uploaded = page.waitForResponse((r) => r.url().includes("/assets/import") && r.request().method() === "POST" && !r.url().includes("/commit") && !r.url().includes("/approve"), { timeout: 30_000 });
    await page.getByRole("button", { name: /Upload and stage|Téléverser et préparer|Carregar e preparar/i }).click();
    expect((await uploaded).ok()).toBeTruthy();
    await expect(page.getByText(/unique tags|étiquettes uniques|etiquetas únicas/i).first()).toBeVisible({ timeout: 30_000 });

    const approved = page.waitForResponse((r) => r.url().includes("/approve") && r.request().method() === "POST", { timeout: 20_000 });
    await page.getByRole("button", { name: /Approve non-blocking|Approuver les lignes non bloquantes|Aprovar linhas não bloqueantes/i }).click();
    expect((await approved).ok()).toBeTruthy();
    await page.getByRole("button", { name: /Commit to register|Valider dans le registre|Confirmar no registo/i }).click();
    await expect(page.getByText(/Import committed|committed with incomplete/i)).toBeVisible({ timeout: 30_000 });

    const listed = await page.evaluate(async () => {
      const res = await fetch("/api/assets?search=CE-8811", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return res.json();
    }) as { data?: { qr_token?: string; qr_url?: string; id?: number }[] };
    const asset = listed.data?.[0];
    expect(asset?.id).toBeTruthy();
    const token = asset?.qr_token || String(asset?.qr_url ?? "").split("/a/")[1];
    expect(token).toBeTruthy();

    await page.goto(`/a/${token}`);
    await expect(page.getByText("CE-8811")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/SN-E2E-HIDDEN|book value|custodian/i)).toHaveCount(0);

    await page.goto("/assets/labels");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets labels print");
    await page.locator('input[name="asset-search"]').fill("CE-8811");
    const row = page.locator("tr", { hasText: "CE-8811" }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    // Styled checkboxes keep the native input sr-only; click the visible Select all control.
    await page.getByRole("button", { name: /^(Select all|Tout sélectionner|Seleccionar tudo)$/ }).click();
    await expect(row.getByRole("checkbox", { name: "CE-8811" })).toBeChecked();
    const printResp = page.waitForResponse((r) => r.url().includes("/assets/labels/print") && r.request().method() === "POST", { timeout: 20_000 });
    await page.getByRole("button", { name: /^(Print selected|Imprimer la sélection|Imprimir seleccionados)$/ }).click();
    const resp = await printResp;
    expect(resp.status()).toBeLessThan(400);
    expect((resp.headers()["content-type"] ?? "")).toMatch(/pdf|octet-stream|json/i);
  });
});

test.describe("Asset register print, export, and view (admin)", () => {
  test("register opens a view page and Excel export", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/assets");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets register");

    await expect(page.getByTestId("asset-register-print")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("asset-register-export-excel")).toBeVisible();
    await expect(page.getByTestId("asset-register-print")).toHaveAttribute("href", /\/assets\/print/);

    const viewLink = page.getByTestId("asset-register-view").first();
    if (!(await viewLink.isVisible().catch(() => false))) {
      test.skip(true, "no register rows in this environment");
    }
    await viewLink.click();
    await expect(page).toHaveURL(/\/assets\/\d+/, { timeout: 15_000 });
    await expect(page.getByTestId("asset-view-title")).toBeVisible({ timeout: 10_000 });

    await page.goto("/assets");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets register reload");
    await expect(page.getByTestId("asset-register-view").first()).toBeVisible({ timeout: 15_000 });
    const excel = page.waitForResponse(
      (r) => r.url().includes("/assets/register-export") && r.request().method() === "GET",
      { timeout: 30_000 },
    );
    await page.getByTestId("asset-register-export-excel").click();
    const resp = await excel;
    expect(resp.ok()).toBeTruthy();
    expect((resp.headers()["content-type"] ?? "")).toMatch(/spreadsheetml|octet-stream|excel/i);
  });

  test("print page loads QR images with one batch request", async ({ page }) => {
    skipWithoutAuth("admin");
    let batchStatus: number | null = null;
    page.on("response", (r) => {
      if (r.url().includes("/assets/qr-batch") && r.request().method() === "POST") {
        batchStatus = r.status();
      }
    });
    await page.goto("/assets/print");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets print");
    await expect(page.getByRole("heading", { name: /Asset Register/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    const rows = page.locator(".register-print-table tbody tr");
    if ((await rows.count()) === 0) {
      test.skip(true, "no register rows in this environment");
    }
    expect(batchStatus).toBe(200);
    await expect(rows.first().locator("img")).toBeVisible({ timeout: 10_000 });
  });

  test("reports page downloads server CSV", async ({ page }) => {
    skipWithoutAuth("admin");
    await page.goto("/assets/reports");
    await waitForApp(page);
    await skipIfAccessDenied(page, "assets reports");
    const csv = page.waitForResponse(
      (r) =>
        r.url().includes("/assets/register-export") &&
        r.url().includes("format=csv") &&
        r.request().method() === "GET",
      { timeout: 30_000 },
    );
    await page.getByTestId("asset-reports-download-csv").click();
    const resp = await csv;
    expect(resp.ok()).toBeTruthy();
    expect((resp.headers()["content-type"] ?? "")).toMatch(/csv|octet-stream|text\/plain/i);
  });
});

test.describe("Public QR page", () => {
  test("unknown token does not leak serial or value", async ({ page }) => {
    await page.goto("/a/not-a-real-token");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/serial|book value|NAD|custodian/i)).toHaveCount(0);
  });
});
