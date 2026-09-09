import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("my assets page lets the custodian accept, decline, or request return", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/mine/page.tsx"), "utf8");
  assert.match(page, /useI18n/);
  assert.match(page, /assetsApi\.acknowledge/);
  assert.match(page, /assetsApi\.declineAssignment/);
  assert.match(page, /assetsApi\.requestReturn/);
  assert.match(page, /assets\.mine\.accept/);
  assert.match(page, /assets\.mine\.decline/);
  assert.match(page, /assets\.mine\.requestReturn/);
  assert.match(page, /declineReason/);
  assert.doesNotMatch(page, /Acknowledge custody for items assigned to you/);
});

test("asset API client exposes custody handshake fields and endpoints", () => {
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(api, /custody_state\?:/);
  assert.match(api, /declineAssignment:/);
  assert.match(api, /requestReturn:/);
  assert.match(api, /\/assets\/\$\{id\}\/decline/);
  assert.match(api, /\/assets\/\$\{id\}\/request-return/);
});

test("asset register lets an officer confirm a requested return", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/page.tsx"), "utf8");
  assert.match(page, /assetsApi\.returnAsset/);
  assert.match(page, /pending_return/);
  assert.match(page, /assets\.register\.confirmReturn/);
});
