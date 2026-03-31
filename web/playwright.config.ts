import { defineConfig, devices } from "@playwright/test";

/**
 * SADC-PF Nexus — Playwright E2E test configuration.
 *
 * Prerequisites before running:
 *   1. cd api && php artisan migrate:fresh --seed
 *   2. cd api && php artisan serve           (port 8000)
 *   3. cd web && npm run dev                 (port 3000)
 *   4. cd web && npx playwright test
 *
 * To install Playwright browsers first:  npx playwright install --with-deps
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,      // keep sequential — tests share seeded DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                // single worker to avoid DB race conditions
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // ── Auth setup (runs first, saves storage-state files) ────────────────
    {
      name: "setup",
      testMatch: "**/global.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },

    // ── Full browser tests (staff user) ───────────────────────────────────
    {
      name: "staff",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/staff.json",
      },
      dependencies: ["setup"],
      testIgnore: ["**/auth.spec.ts", "**/admin.spec.ts"],
    },

    // ── Admin-specific tests ──────────────────────────────────────────────
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/admin.json",
      },
      dependencies: ["setup"],
      testMatch: ["**/admin.spec.ts"],
    },

    // ── Auth tests (no stored state — tests the login flow itself) ────────
    {
      name: "auth",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: ["**/auth.spec.ts"],
    },
  ],
});
