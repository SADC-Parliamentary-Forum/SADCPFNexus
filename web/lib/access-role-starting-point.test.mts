import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractRolePermissions,
  suggestedCopyName,
} from "./access-role-starting-point.ts";

const webRoot = join(process.cwd());

test("extractRolePermissions reads snake_case versions and skips empty latest drafts", () => {
  const permissions = extractRolePermissions({
    latest_version: { version: 2, status: "draft", permissions: [] },
    current_version: { version: 1, status: "active", permissions: ["leave.view", "assets.create"] },
  });
  assert.deepEqual(permissions, ["leave.view", "assets.create"]);
});

test("extractRolePermissions accepts camelCase relation keys from JSON", () => {
  const permissions = extractRolePermissions({
    latestVersion: { permissions: ["dashboard.view"] },
  });
  assert.deepEqual(permissions, ["dashboard.view"]);
});

test("extractRolePermissions does not throw when permissions is a JSON string or object", () => {
  assert.deepEqual(
    extractRolePermissions({ current_version: { permissions: '["leave.view","assets.view"]' } }),
    ["leave.view", "assets.view"],
  );
  assert.deepEqual(
    extractRolePermissions({ current_version: { permissions: { 0: "leave.view", 1: "workplan.view" } } }),
    ["leave.view", "workplan.view"],
  );
  assert.deepEqual(extractRolePermissions({ current_version: { permissions: null } }), []);
});

test("suggestedCopyName keeps a typed name and otherwise appends copy", () => {
  assert.equal(suggestedCopyName("Unaro Role", "General Employee"), "Unaro Role");
  assert.equal(suggestedCopyName("  ", "General Employee"), "General Employee copy");
  assert.equal(suggestedCopyName("", "Unaro Role"), "Unaro Role copy");
});

test("role catalogue page copies a starting role into the draft builder and scrolls the app pane", () => {
  const page = readFileSync(join(webRoot, "app/(app)/admin/access/roles/page.tsx"), "utf8");

  assert.match(page, /extractRolePermissions/);
  assert.match(page, /suggestedCopyName/);
  assert.match(page, /scrollRoleBuilderIntoView/);
  assert.match(page, /id="role-draft"/);
  assert.match(page, /id="role-builder"/);
  assert.match(page, /Use as starting point/);
  assert.doesNotMatch(page, /window\.scrollTo/);
});
