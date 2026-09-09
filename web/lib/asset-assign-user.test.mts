import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("asset register can optionally assign a live asset to a user", () => {
  const register = readFileSync(join(webRoot, "app/(app)/assets/page.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  const keys = readFileSync(join(webRoot, "lib/i18n/keys.ts"), "utf8");

  assert.match(register, /assetsApi\.assign/);
  assert.match(register, /assets\.assign/);
  assert.match(register, /assigned_user/);
  assert.match(register, /tenantUsersApi\.list/);
  assert.match(register, /assets\.notAssigned/);

  assert.match(api, /assigned_user\?:/);
  assert.match(keys, /"assets\.assign":/);
  assert.match(keys, /"assets\.notAssigned":/);
  assert.match(keys, /"assets\.assignHint":/);
});

test("add-asset form keeps assignment optional", () => {
  const add = readFileSync(join(webRoot, "app/(app)/assets/add/page.tsx"), "utf8");
  assert.match(add, /id="assigned_to"/);
  assert.match(add, /option value=""/);
  assert.match(add, /Not assigned|assets\.notAssigned/);
});

test("import map-custodian sends optional user_id when type is person", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/import/page.tsx"), "utf8");
  assert.match(page, /custodianType === ["']user["']/);
  assert.match(page, /user_id:/);
  assert.match(page, /tenantUsersApi/);
});
