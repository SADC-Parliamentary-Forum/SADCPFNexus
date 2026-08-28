/**
 * Auth fixture helpers for resilient E2E smokes.
 *
 * Fixtures are produced by `global.setup.ts` into `playwright/.auth/`.
 * When setup cannot log in (API down, wrong credentials, CI without seed),
 * authenticated specs should skip rather than fail the suite.
 */
import fs from "fs";
import path from "path";
import { test } from "@playwright/test";

const AUTH_DIR = path.join(process.cwd(), "playwright/.auth");

export type AuthRole = "staff" | "admin";

export function authStatePath(role: AuthRole): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

export function authFixtureExists(role: AuthRole): boolean {
  try {
    const p = authStatePath(role);
    if (!fs.existsSync(p)) return false;
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as { cookies?: unknown[] };
    return Array.isArray(parsed.cookies) && parsed.cookies.length > 0;
  } catch {
    return false;
  }
}

/** Skip the current test when the named role fixture is missing or empty. */
export function skipWithoutAuth(role: AuthRole): void {
  test.skip(
    !authFixtureExists(role),
    `Auth fixture playwright/.auth/${role}.json missing or empty — run global.setup (API + seeded users required). See web/tests/e2e/README.md.`
  );
}

/** True when the page shows a login form (session expired / unauthorized redirect). */
export async function landedOnLogin(
  page: import("@playwright/test").Page
): Promise<boolean> {
  if (page.url().includes("/login")) return true;
  const email = page.locator('input[type="email"]');
  return email.isVisible({ timeout: 1_500 }).catch(() => false);
}

/** Skip when the fixture user is not allowed to use this module. */
export async function skipIfAccessDenied(
  page: import("@playwright/test").Page,
  reason: string
): Promise<void> {
  if (await landedOnLogin(page)) {
    test.skip(true, `${reason}: redirected to login`);
  }
  const denied = page.getByText(
    /not authorised|not authorized|forbidden|you do not have permission|you need .*(view|permission)/i
  );
  if (await denied.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
    test.skip(true, `${reason}: access denied`);
  }
}

/**
 * Clear cookies + web storage from a same-origin document.
 * `sessionStorage` throws on about:blank (opaque origin).
 */
export async function clearBrowserAuth(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login");
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      /* ignore opaque origin */
    }
  });
  await page.context().clearCookies();
}

/** Prefer `load` over `networkidle` — header unread-count polling never goes idle. */
export async function waitForApp(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
}
