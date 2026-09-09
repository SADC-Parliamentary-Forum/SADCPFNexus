import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canDisposeAssets, canRetireAssets, canAccessRoute } from "./authAccess.ts";

const webRoot = join(process.cwd());

const viewer = { roles: ["staff"], permissions: ["assets.view"] };
const creator = { roles: ["Administration Officer"], permissions: ["assets.view", "assets.create"] };
const disposer = { roles: ["Administration Officer"], permissions: ["assets.view", "assets.dispose"] };
const manager = { roles: ["Administration Officer"], permissions: ["assets.view", "assets.manage"] };
const admin = { roles: ["Administration Officer"], permissions: ["assets.view", "assets.admin"] };

test("retire and dispose stay off the general-employee and create-only roles", () => {
  assert.equal(canRetireAssets(viewer), false);
  assert.equal(canDisposeAssets(viewer), false);
  assert.equal(canRetireAssets(creator), false);
  assert.equal(canDisposeAssets(creator), false);
  assert.equal(canDisposeAssets(disposer), true);
  assert.equal(canRetireAssets(disposer), false);
  assert.equal(canRetireAssets(manager), true);
  assert.equal(canDisposeAssets(manager), true);
  assert.equal(canRetireAssets(admin), true);
  assert.equal(canDisposeAssets(admin), true);
});

test("disposal and depreciation routes are not open to register viewers", () => {
  assert.equal(canAccessRoute(viewer, "/assets"), true);
  assert.equal(canAccessRoute(viewer, "/assets/disposal"), false);
  assert.equal(canAccessRoute(viewer, "/assets/depreciation"), false);
  assert.equal(canAccessRoute(disposer, "/assets/disposal"), true);
  assert.equal(canAccessRoute(manager, "/assets/depreciation"), true);
});

test("asset register surfaces dispose, retire, live filter, and depreciation without a sidebar child", () => {
  const register = readFileSync(join(webRoot, "app/(app)/assets/page.tsx"), "utf8");
  const disposal = readFileSync(join(webRoot, "app/(app)/assets/disposal/page.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");

  assert.match(register, /canDisposeAssets/);
  assert.match(register, /canRetireAssets/);
  assert.match(register, /href=\{`\/assets\/disposal\?asset=/);
  assert.match(register, /assetsApi\.retire/);
  assert.match(register, /filterStatus === "live"/);
  assert.match(register, /\/assets\/depreciation/);
  assert.match(register, /pending_disposal/);
  assert.doesNotMatch(register, /assetsApi\.delete\(/);

  assert.match(disposal, /searchParams\.get\("asset"\)/);
  assert.match(disposal, /setShowCreate\(true\)/);

  assert.match(api, /retire:\s*\(id:\s*number\)/);
  assert.match(api, /api\.delete<\{ message: string \}>\(`\/assets\/\$\{id\}`\)/);

  const assetsBlock = sidebar.slice(sidebar.indexOf('label: "Fixed Assets"'), sidebar.indexOf('label: "Consumables'));
  assert.doesNotMatch(assetsBlock, /\/assets\/disposal/);
  assert.doesNotMatch(assetsBlock, /\/assets\/depreciation/);
});
