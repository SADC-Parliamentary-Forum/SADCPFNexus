import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("label printing loads every register page so Select all covers all assets", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/labels/page.tsx"), "utf8");
  // The API caps per_page at 100; a single request would truncate Select all.
  assert.match(page, /for \(let page = 1; ; page\+\+\)/);
  assert.match(page, /assetsApi\.list\(\{ per_page: 100, page, search: term \}\)/);
  assert.match(page, /last_page/);
  assert.match(page, /useRowSelection\(\{ rows: assets, getId \}\)/);
});
