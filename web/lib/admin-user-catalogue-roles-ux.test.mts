import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("user security tab assigns published catalogue roles with dual-control approve", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/users/[id]/page.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");

  assert.match(source, /Published catalogue roles/);
  assert.match(source, /assignRoleVersion/);
  assert.match(source, /approveRoleAssignment/);
  assert.match(source, /approveRoleSync/);
  assert.match(source, /listCatalogueRoles/);
  assert.match(source, /pending_role_sync_requests/);
  assert.match(source, /getStoredUser/);
  assert.match(source, /htmlFor="user-catalogue-role-reason"/);
  assert.match(source, /<label htmlFor="user-catalogue-role-reason"/);
  assert.match(source, /Assigned from user security tab/);
  assert.match(source, /Waiting for second administrator/);
  assert.doesNotMatch(source, /FormField/);
  assert.doesNotMatch(source, /text-primary underline/);

  assert.match(api, /assignRoleVersion:/);
  assert.match(api, /approveRoleAssignment:/);
  assert.match(api, /approveRoleSync:/);
  assert.match(api, /listCatalogueRoles:/);
  assert.match(api, /role-versions\/\$\{versionId\}/);
  assert.match(api, /role-assignments\/\$\{assignmentId\}\/approve/);
  assert.match(api, /role-sync-requests\/\$\{id\}\/approve/);
});
