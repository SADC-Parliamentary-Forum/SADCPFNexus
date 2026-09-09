import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("asset request list opens new request in a shared modal", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/requests/page.tsx"), "utf8");
  const modal = readFileSync(join(webRoot, "components/assets/NewAssetRequestModal.tsx"), "utf8");
  assert.match(page, /NewAssetRequestModal/);
  assert.doesNotMatch(page, /href=["']\/assets\/requests\/new["']/);
  assert.match(modal, /import \{ Modal \} from "@\/components\/ui\/Modal"/);
  assert.match(modal, /assetRequestsApi\.create/);
  assert.match(modal, /justification/);
  assert.match(modal, /<Modal/);
});

test("asset request detail page exists so /assets/requests/:id is not a 404", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/requests/[id]/page.tsx"), "utf8");
  assert.match(source, /assetRequestsApi[\s\S]*\.get\(/);
  assert.match(source, /justification/);
  assert.match(source, /ModulePageHeader|page-title/);
  assert.match(source, /href=["']\/assets\/requests["']/);
});

test("legacy new-request routes redirect onto the list popup", () => {
  const neu = readFileSync(join(webRoot, "app/(app)/assets/requests/new/page.tsx"), "utf8");
  const singular = readFileSync(join(webRoot, "app/(app)/assets/request/page.tsx"), "utf8");
  assert.match(neu, /redirect\(["']\/assets\/requests\?new=1["']\)/);
  assert.match(singular, /redirect\(["']\/assets\/requests\?new=1["']\)/);
});

test("assetRequestsApi can load and update a single request", () => {
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(api, /get:\s*\(id:\s*number\)\s*=>[\s\S]{0,80}\/asset-requests\/\$\{id\}/);
  assert.match(api, /update:\s*\(id:\s*number/);
});
