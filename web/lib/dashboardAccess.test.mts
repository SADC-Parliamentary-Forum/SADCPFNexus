import assert from "node:assert/strict";
import test from "node:test";
import { canAccessRoute } from "./authAccess.ts";
import { DASHBOARD_MODULES, dashboardModulesForUser } from "./dashboardAccess.ts";

const ge = {
  roles: ["staff", "General Employee"],
  permissions: [
    "leave.view",
    "leave.create",
    "travel.create",
    "travel.module.view",
    "imprest.view",
    "imprest.create",
    "procurement.create",
    "governance.view",
    "correspondence.view",
    "correspondence.create",
    "risk.view",
    "risk.create",
    "workplan.view",
    "assignments.view",
    "stock.view",
    "people.view-directory",
    "salary_advance.view",
    "salary_advance.create",
    "timesheets.view",
    "timesheets.view-own",
    "approvals.inbox.view",
    "hr.create",
  ],
};

test("dashboard All Modules hides organisation hubs from General Employee", () => {
  const hrefs = dashboardModulesForUser(ge).map((m) => m.href);

  for (const hub of [
    "/travel",
    "/finance",
    "/procurement",
    "/assets",
    "/fleet",
    "/hr",
    "/reports",
    "/correspondence",
    "/governance",
    "/risk",
    "/audit",
    "/admin",
  ]) {
    assert.equal(hrefs.includes(hub), false, `GE must not see ${hub} on the dashboard`);
  }

  for (const selfService of ["/leave", "/imprest", "/assignments", "/workplan", "/stock", "/people"]) {
    assert.equal(hrefs.includes(selfService), true, `GE should still see ${selfService}`);
  }
});

test("dashboard All Modules still opens organisation hubs for officers who hold *.view", () => {
  const officer = {
    roles: ["HOD"],
    permissions: [
      "travel.view",
      "finance.view",
      "procurement.view",
      "assets.view",
      "hr.view",
      "reports.view",
      "correspondence.registry",
      "correspondence.view",
      "governance.approve",
      "governance.view",
      "risk.review",
      "risk.view",
    ],
  };
  const hrefs = dashboardModulesForUser(officer).map((m) => m.href);
  assert.equal(hrefs.includes("/travel"), true);
  assert.equal(hrefs.includes("/finance"), true);
  assert.equal(hrefs.includes("/assets"), true);
  assert.equal(hrefs.includes("/correspondence"), true);
  assert.equal(hrefs.includes("/governance"), true);
  assert.equal(hrefs.includes("/risk"), true);
});

test("dashboard module catalogue covers every tile currently rendered", () => {
  assert.ok(DASHBOARD_MODULES.length >= 12);
  assert.equal(canAccessRoute(ge, "/travel"), false);
  assert.equal(canAccessRoute(ge, "/leave"), true);
});
