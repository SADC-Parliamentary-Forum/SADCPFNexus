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
  assert.equal(canAccessRoute(ge, "/travel"), false);
  assert.equal(canAccessRoute(ge, "/procurement"), false);
  assert.equal(canAccessRoute(ge, "/finance"), false);
  assert.equal(canAccessRoute(ge, "/organogram"), false);
});

test("General Employee can open self-service create routes they are granted", () => {
  assert.equal(canAccessRoute(ge, "/travel/create"), true);
  assert.equal(canAccessRoute(ge, "/procurement/create"), true);
  assert.equal(canAccessRoute(ge, "/salary-advances/create"), true);
});
