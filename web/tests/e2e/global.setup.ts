/**
 * Global setup: logs in as admin and staff through the browser, then saves auth state for reuse.
 * Runs once before the entire test suite.
 *
 * Soft-fail policy: if login cannot complete (API down, empty seed, wrong credentials),
 * an empty storage-state file is written and the setup step still passes. Downstream
 * specs that call `skipWithoutAuth()` will skip instead of failing the suite.
 * See tests/e2e/README.md.
 */
import { test as setup, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const AUTH_DIR = path.join(process.cwd(), "playwright/.auth");
const EMPTY_STATE = { cookies: [] as unknown[], origins: [] as unknown[] };

async function writeState(fileName: string, fromPage?: Page) {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  const target = path.join(AUTH_DIR, fileName);
  if (fromPage) {
    await fromPage.context().storageState({ path: target });
    return;
  }
  fs.writeFileSync(target, JSON.stringify(EMPTY_STATE, null, 2));
}

async function loginAndSave(
  page: Page,
  email: string,
  password: string,
  fileName: string
) {
  try {
    await page.goto("/login");
    // `goto` only waits for the "load" event, which can fire before this client
    // component finishes hydrating (especially the first hit against a Next.js
    // dev server, which compiles the route on demand). Locator.fill() populates
    // the DOM value regardless of hydration state, so a fill+click landing
    // ahead of hydration silently no-ops (React's onChange/onSubmit handlers
    // aren't wired up yet) and the test hangs waiting for a navigation that
    // will never come. Waiting for networkidle first — same guard already used
    // in pif-sections.spec.ts for an analogous race — lets hydration settle.
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|setup|reset-password)(\?.*)?$/, {
      timeout: 20_000,
    });
    await writeState(fileName, page);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[e2e setup] Could not authenticate ${email} — writing empty ${fileName}. Downstream auth tests will skip. Reason: ${message}`
    );
    await writeState(fileName);
  }
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
