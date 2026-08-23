import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("lifecycle reports page loads Phase 2 analytics, not a deferred subtitle", () => {
  const page = readFileSync(join(webRoot, "app/(app)/lifecycle/reports/page.tsx"), "utf8");
  assert.match(page, /lifecycleApi\.analytics/);
  assert.match(page, /avg_cycle_days/);
  assert.match(page, /bottlenecks/);
  assert.doesNotMatch(page, /deferred to Phase 2/i);
});

test("lifecycle API exposes analytics and internal journeys", () => {
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(api, /\/lifecycle\/analytics/);
  assert.match(api, /\/lifecycle\/journeys/);
  assert.match(api, /internal_open/);
});

test("internal journey create and queue pages exist", () => {
  const createPage = readFileSync(join(webRoot, "app/(app)/lifecycle/journeys/new/page.tsx"), "utf8");
  const queuePage = readFileSync(join(webRoot, "app/(app)/lifecycle/journeys/page.tsx"), "utf8");
  assert.match(createPage, /lifecycleApi\.initiateJourney/);
  assert.match(queuePage, /Internal journeys/);
});
