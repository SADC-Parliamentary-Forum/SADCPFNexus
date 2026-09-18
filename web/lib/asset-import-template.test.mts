import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("import page offers a downloadable Excel template for bulk upload", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/import/page.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");

  assert.match(page, /assetImportApi\.downloadTemplate/);
  assert.match(page, /assets\.import\.downloadTemplate/);
  assert.match(page, /useState<"legacy" \| "template">\("template"\)/);

  assert.match(api, /downloadTemplate:/);
  assert.match(api, /\/assets\/import\/template/);
  assert.match(api, /responseType:\s*["']blob["']/);
  assert.match(api, /sadcpf-asset-import-template\.xlsx/);
});

test("asset register links importers to bulk upload", () => {
  const register = readFileSync(join(webRoot, "app/(app)/assets/page.tsx"), "utf8");
  assert.match(register, /href=["']\/assets\/import["']/);
  assert.match(register, /ClearAssetRegisterButton/);
});

test("import and register pages offer a confirmed clear-register action", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/import/page.tsx"), "utf8");
  const button = readFileSync(join(webRoot, "components/assets/ClearAssetRegisterButton.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");

  assert.match(page, /ClearAssetRegisterButton/);
  assert.match(button, /assetsApi\.clearRegister/);
  assert.match(button, /CLEAR_ASSET_REGISTER_CONFIRMATION/);
  assert.match(button, /data-testid="asset-register-clear"/);
  assert.match(api, /\/assets\/register\/clear/);
});
