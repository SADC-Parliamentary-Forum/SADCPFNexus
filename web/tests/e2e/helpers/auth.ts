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

/** Skip when the role is gated away from this screen. */
export async function skipIfAccessDenied(
  page: import("@playwright/test").Page,
  reason = "Current fixture cannot open this route"
): Promise<void> {
  const denied = page.getByText(/Access denied/i);
  if (await denied.isVisible({ timeout: 1_500 }).catch(() => false)) {
    test.skip(true, reason);
  }
}
