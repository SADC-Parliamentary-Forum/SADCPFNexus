import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("leave import page fills the content column and previews before commit", () => {
  const source = readFileSync(join(webRoot, "app/(app)/hr/leave/import/page.tsx"), "utf8");
  assert.match(source, /ContentCanvas/);
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /FormSection/);
  assert.match(source, /useI18n/);
  assert.match(source, /leaveApi\.import/);
  assert.match(source, /leaveApi\.importTemplate/);
  assert.match(source, /leave\.import\.preview/);
  assert.match(source, /leave\.import\.commit/);
  assert.doesNotMatch(source, /mx-auto max-w-/);
  assert.match(source, /htmlFor="leave-import-file"/);
  assert.match(source, /id="leave-import-file"/);
});

test("staff leave register and balances link to bulk import", () => {
  const register = readFileSync(join(webRoot, "app/(app)/hr/leave/page.tsx"), "utf8");
  const balances = readFileSync(join(webRoot, "app/(app)/hr/leave/balances/page.tsx"), "utf8");
  assert.match(register, /href="\/hr\/leave\/import"/);
  assert.match(balances, /href="\/hr\/leave\/import"/);
  assert.match(register, /canAccessRoute/);
  assert.match(balances, /canAccessRoute/);
  assert.match(register, /leave\.import\.cta/);
  assert.match(balances, /leave\.import\.cta/);
});

test("leave API client exposes import preview and template download", () => {
  const source = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(source, /importTemplate:/);
  assert.match(source, /\/leave\/import\/template/);
  assert.match(source, /\/leave\/import/);
  assert.match(source, /fd\.append\("commit"/);
});
