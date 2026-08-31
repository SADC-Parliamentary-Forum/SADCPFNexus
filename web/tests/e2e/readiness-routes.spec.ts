import { test, expect } from "@playwright/test";
import { expectNoServerCrash } from "./helpers/auth";

const STAFF_ROUTES = [
  "/dashboard",
  "/leave",
  "/salary-advances",
  "/imprest",
  "/hr/timesheets",
  "/notifications",
  "/approvals",
  "/profile",
];

const ADMIN_ROUTES = [
  "/admin",
  "/admin/users",
  "/admin/roles",
  "/admin/departments",
  "/admin/workflows",
  "/admin/audit",
  "/admin/settings",
  "/admin/weekly-summary",
];

function getRouteSet(projectName: string): string[] {
  if (projectName === "admin") return ADMIN_ROUTES;
  return STAFF_ROUTES;
}

function normalizeRoute(pathname: string): string {
  if (!pathname.startsWith("/")) return `/${pathname}`;
  return pathname;
}

async function collectInternalLinks(currentPage: import("@playwright/test").Page): Promise<string[]> {
  const hrefs = await currentPage.locator('a[href^="/"]').evaluateAll((els) =>
    els
      .map((el) => (el as HTMLAnchorElement).getAttribute("href") || "")
      .filter((href) => href && !href.startsWith("/api") && !href.startsWith("/_next"))
  );

  return [...new Set(hrefs.map((h) => normalizeRoute(h.split("#")[0].split("?")[0])))];
}

test.describe("readiness route smoke", () => {
  test("all critical routes avoid unexpected 404/500", async ({ page }, testInfo) => {
    const seedRoutes = getRouteSet(testInfo.project.name);
    const routes = new Set<string>(seedRoutes);

    for (const route of seedRoutes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response, `missing response for ${route}`).not.toBeNull();

      const status = response!.status();
      expect(status, `unexpected ${status} for ${route}`).toBeLessThan(500);
      expect(status, `unexpected ${status} for ${route}`).not.toBe(404);

      await expectNoServerCrash(page);

      const discovered = await collectInternalLinks(page);
      for (const href of discovered) routes.add(href);
    }

    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response, `missing response for discovered route ${route}`).not.toBeNull();

      const status = response!.status();
      expect(status, `unexpected ${status} for discovered route ${route}`).toBeLessThan(500);
      expect(status, `unexpected ${status} for discovered route ${route}`).not.toBe(404);

      await expectNoServerCrash(page);
    }
  });
});
