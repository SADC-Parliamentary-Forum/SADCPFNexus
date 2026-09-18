import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("asset register can optionally assign a live asset to a user", () => {
  const register = readFileSync(join(webRoot, "app/(app)/assets/page.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  const keys = readFileSync(join(webRoot, "lib/i18n/keys.ts"), "utf8");
  const picker = readFileSync(join(webRoot, "components/assets/AssetAssigneePicker.tsx"), "utf8");

  assert.match(register, /assetsApi\.assign/);
  assert.match(register, /assets\.assign/);
  assert.match(register, /assigned_user/);
  assert.match(register, /AssetAssigneePicker/);
  assert.match(register, /assets\.notAssigned/);
  assert.match(register, /department:/);

  assert.match(picker, /tenantUsersApi\.list\(\{ search:/);
  assert.match(picker, /u\.email/);
  assert.match(picker, /department/);
  assert.match(picker, /assets\.searchAssignee/);
  assert.match(picker, /onFocus/);
  assert.match(picker, /data-testid="asset-assignee-picker"/);

  assert.match(api, /assigned_user\?:/);
  assert.match(api, /department\?: string \| null/);
  assert.match(keys, /"assets\.assign":/);
  assert.match(keys, /"assets\.notAssigned":/);
  assert.match(keys, /"assets\.assignHint":/);
  assert.match(keys, /"assets\.searchAssignee":/);
});

test("add-asset form keeps assignment optional and searchable", () => {
  const add = readFileSync(join(webRoot, "app/(app)/assets/add/page.tsx"), "utf8");
  const picker = readFileSync(join(webRoot, "components/assets/AssetAssigneePicker.tsx"), "utf8");
  assert.match(add, /AssetAssigneePicker/);
  assert.match(add, /id="assigned_to"/);
  assert.match(add, /department:/);
  assert.match(picker, /assets\.notAssigned/);
});

test("edit-asset form uses the searchable assignee picker", () => {
  const edit = readFileSync(join(webRoot, "app/(app)/assets/[id]/edit/page.tsx"), "utf8");
  assert.match(edit, /AssetAssigneePicker/);
  assert.match(edit, /id="assigned_to"/);
});

test("asset view shows assignee name, email and department", () => {
  const view = readFileSync(join(webRoot, "app/(app)/assets/[id]/page.tsx"), "utf8");
  assert.match(view, /assets\.assignedTo/);
  assert.match(view, /assets\.assigneeEmail/);
  assert.match(view, /assets\.assigneeDepartment/);
  assert.match(view, /assigned_user\?\.email/);
});

test("import map-custodian sends optional user_id when type is person", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/import/page.tsx"), "utf8");
  assert.match(page, /custodianType === ["']user["']/);
  assert.match(page, /user_id:/);
  assert.match(page, /AssetAssigneePicker/);
});
