import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "app/(app)/hr/leave/page.tsx"), "utf8");

test("HR leave New Leave Request searches employees by name and email in a dropdown", () => {
  assert.match(source, /htmlFor="hr-leave-employee"/);
  assert.match(source, /id="hr-leave-employee"/);
  assert.match(source, /Search by full name or email/);
  assert.match(source, /u\.name/);
  assert.match(source, /u\.email/);
  assert.match(source, /tenantUsersApi\.list/);
  assert.match(source, /prepared_on_behalf_of:\s*newEmployee\.id/);
  assert.doesNotMatch(source, /Type name to search/);
  assert.doesNotMatch(source, /<label className=/);
});

test("HR leave register offers bulk CSV upload for HR officers", () => {
  assert.match(source, /leaveApi\.bulkImport/);
  assert.match(source, /htmlFor="hr-leave-bulk-file"/);
  assert.match(source, /id="hr-leave-bulk-file"/);
  assert.match(source, /bulk-import\/template/);
  assert.match(source, /Upload CSV/);
  assert.match(source, /employee_email/);
  assert.doesNotMatch(source, /FormField/);
});
