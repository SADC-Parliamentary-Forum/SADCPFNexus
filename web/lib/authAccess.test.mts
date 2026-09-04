import assert from "node:assert/strict";
import test from "node:test";
import { canAccessRoute } from "./authAccess.ts";

const ge = {
  roles: ["staff", "General Employee"],
  permissions: [
    "leave.view",
    "salary_advance.view",
    "salary_advance.create",
    "timesheets.view",
    "timesheets.view-own",
    "timesheet.module.view",
    "approvals.inbox.view",
    "notifications.view-own",
    "notifications.view.own",
    "travel.create",
    "procurement.create",
    "governance.view",
  ],
};

test("General Employee can open self-service inboxes and timesheets", () => {
  assert.equal(canAccessRoute(ge, "/approvals"), true);
  assert.equal(canAccessRoute(ge, "/notifications"), true);
  assert.equal(canAccessRoute(ge, "/notifications?tab=inbox"), true);
  assert.equal(canAccessRoute(ge, "/hr/timesheets"), true);
  assert.equal(canAccessRoute(ge, "/hr/timesheets/history"), true);
  assert.equal(canAccessRoute(ge, "/salary-advances"), true);
  assert.equal(canAccessRoute(ge, "/finance/advances"), true);
  assert.equal(canAccessRoute(ge, "/leave"), true);
});

test("General Employee still cannot open org-HR or module-admin prefixes", () => {
  assert.equal(canAccessRoute(ge, "/hr"), false);
  assert.equal(canAccessRoute(ge, "/hr/leave/balances"), false);
  assert.equal(canAccessRoute(ge, "/hr/files"), false);
  assert.equal(canAccessRoute(ge, "/travel"), false);
  assert.equal(canAccessRoute(ge, "/travel/register"), false);
  assert.equal(canAccessRoute(ge, "/travel/missions"), false);
  assert.equal(canAccessRoute(ge, "/travel/calendar"), false);
  assert.equal(canAccessRoute(ge, "/travel/toil"), false);
  assert.equal(canAccessRoute(ge, "/procurement"), false);
  assert.equal(canAccessRoute(ge, "/procurement/vendors"), false);
  assert.equal(canAccessRoute(ge, "/finance"), false);
  assert.equal(canAccessRoute(ge, "/finance/budgets"), false);
  assert.equal(canAccessRoute(ge, "/finance/balance-register"), false);
  assert.equal(canAccessRoute(ge, "/assets"), false);
  assert.equal(canAccessRoute(ge, "/assets/import"), false);
  assert.equal(canAccessRoute(ge, "/assets/labels"), false);
  assert.equal(canAccessRoute(ge, "/fleet"), false);
  assert.equal(canAccessRoute(ge, "/admin"), false);
  assert.equal(canAccessRoute(ge, "/organogram"), false);
  assert.equal(canAccessRoute(ge, "/alerts"), false);
  assert.equal(canAccessRoute(ge, "/workplan"), false);
  assert.equal(canAccessRoute(ge, "/srhr"), false);
  assert.equal(canAccessRoute(ge, "/saam"), false);
  assert.equal(canAccessRoute(ge, "/leave/settings"), false);
  assert.equal(canAccessRoute(ge, "/pif/create"), false);
});

test("General Employee can open own travel or procurement records but not the module hub", () => {
  assert.equal(canAccessRoute(ge, "/travel/42"), true);
  assert.equal(canAccessRoute(ge, "/procurement/9"), true);
  assert.equal(canAccessRoute(ge, "/travel/missions"), false);
  assert.equal(canAccessRoute(ge, "/procurement/register"), false);
});

test("General Employee can open self-service create routes they are granted", () => {
  assert.equal(canAccessRoute(ge, "/travel/create"), true);
  assert.equal(canAccessRoute(ge, "/procurement/create"), true);
  assert.equal(canAccessRoute(ge, "/salary-advances/create"), true);
});

test("travel.view unlocks the travel hub that create-only staff cannot open", () => {
  const officer = {
    roles: ["HOD"],
    permissions: ["travel.view", "travel.create"],
  };
  assert.equal(canAccessRoute(officer, "/travel"), true);
  assert.equal(canAccessRoute(officer, "/travel/missions"), true);
  assert.equal(canAccessRoute(officer, "/travel/register"), true);
  assert.equal(canAccessRoute(ge, "/travel/missions"), false);
});

test("asset import and labels stay gated to import/print permissions", () => {
  const viewer = { roles: ["staff"], permissions: ["assets.view"] };
  const importer = { roles: ["Administration Officer"], permissions: ["assets.import", "assets.admin"] };
  const printer = { roles: ["Administration Officer"], permissions: ["assets.print", "assets.manage"] };
  assert.equal(canAccessRoute(viewer, "/assets"), true);
  assert.equal(canAccessRoute(viewer, "/assets/import"), false);
  assert.equal(canAccessRoute(viewer, "/assets/labels"), false);
  assert.equal(canAccessRoute(importer, "/assets/import"), true);
  assert.equal(canAccessRoute(printer, "/assets/labels"), true);
});
