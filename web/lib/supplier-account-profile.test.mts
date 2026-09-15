import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("header My Profile uses the role-aware account profile path", () => {
  const source = readPage("components/layout/Header.tsx");

  assert.match(source, /accountProfilePath/);
  assert.match(source, /header\.myProfile/);
  assert.doesNotMatch(source, /href=["']\/profile["']/);
});

test("staff profile page redirects suppliers to the supplier profile", () => {
  const source = readPage("app/(app)/profile/page.tsx");

  assert.match(source, /isSupplierUser/);
  assert.match(source, /\/supplier\/profile/);
  assert.match(source, /router\.replace/);
});

test("account chrome Profile tabs use the role-aware profile path", () => {
  const settings = readPage("app/(app)/profile/settings/page.tsx");
  const security = readPage("app/(app)/profile/security/page.tsx");
  const support = readPage("app/(app)/profile/support/page.tsx");
  const search = readPage("components/layout/GlobalSearch.tsx");

  assert.match(settings, /accountProfilePath/);
  assert.match(security, /accountProfilePath/);
  assert.match(support, /accountProfilePath/);
  assert.match(search, /accountProfilePath/);
});
