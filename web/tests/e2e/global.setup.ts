/**
 * Global setup: logs in as admin and staff through the browser, then saves auth state for reuse.
 * Runs once before the entire test suite.
 */
import { test as setup, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const AUTH_DIR = path.join(process.cwd(), "playwright/.auth");

async function loginAndSave(
  page: Page,
  email: string,
  password: string,
  fileName: string
) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: path.join(AUTH_DIR, fileName) });
}

setup("authenticate as admin", async ({ page }) => {
  await loginAndSave(
    page,
    "admin@sadcpf.org",
    "Admin@2024!",
    "admin.json"
  );
});

setup("authenticate as staff", async ({ page }) => {
  await loginAndSave(
    page,
    "staff@sadcpf.org",
    "Staff@2024!",
    "staff.json"
  );
});
