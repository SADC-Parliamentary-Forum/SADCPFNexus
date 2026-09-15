import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("supplier profile loads categories from the portal, not the staff catalogue", () => {
  const source = readPage("app/(app)/supplier/profile/page.tsx");

  assert.match(source, /supplierPortalApi\.categories/);
  assert.doesNotMatch(source, /supplierCategoriesApi\.list\s*\(/);
  assert.match(source, /apiErrorMessage/);
  assert.doesNotMatch(source, /profileQuery\.isError \|\| categoriesQuery\.isError/);
});

test("header unread-count polling does not retry forbidden responses", () => {
  const source = readPage("components/layout/Header.tsx");

  assert.match(source, /unreadCount/);
  assert.match(source, /status === 403/);
});
