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
    const uploaded = page.waitForResponse((r) => r.url().includes("/assets/import") && r.request().method() === "POST" && !r.url().includes("/commit"), { timeout: 30_000 });
    await page.getByRole("button", { name: /Upload and stage|Téléverser et préparer|Carregar e preparar/i }).click();
    expect((await uploaded).ok()).toBeTruthy();
    await expect(page.getByText(/unique tags|étiquettes uniques|etiquetas únicas/i).first()).toBeVisible({ timeout: 30_000 });

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
    await row.locator('input[type="checkbox"]').check();
    const printResp = page.waitForResponse((r) => r.url().includes("/assets/labels/print") && r.request().method() === "POST", { timeout: 20_000 });
    await page.getByRole("button", { name: /Print selected|Imprimer la sélection|Imprimir seleccionados/i }).click();
    const resp = await printResp;
    expect(resp.status()).toBeLessThan(400);
    expect((resp.headers()["content-type"] ?? "")).toMatch(/pdf|octet-stream|json/i);
  });
});

test.describe("Public QR page", () => {
  test("unknown token does not leak serial or value", async ({ page }) => {
    await page.goto("/a/not-a-real-token");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/serial|book value|NAD|custodian/i)).toHaveCount(0);
  });
});
