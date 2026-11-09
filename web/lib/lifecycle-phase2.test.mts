import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readEnglishSource } from "./i18nSourceForTests.mts";
import { join } from "node:path";
import { readApiSource } from "./apiSourceForTests.mts";

const webRoot = join(process.cwd());

test("lifecycle reports page loads Phase 2 analytics, not a deferred subtitle", () => {
  const page = readFileSync(join(webRoot, "app/(app)/lifecycle/reports/page.tsx"), "utf8");
  assert.match(page, /lifecycleApi\.analytics/);
  assert.match(page, /avg_cycle_days/);
  assert.match(page, /bottlenecks/);
  assert.doesNotMatch(page, /deferred to Phase 2/i);
});

test("lifecycle API exposes analytics and internal journeys", () => {
  const api = readApiSource(webRoot);
  assert.match(api, /\/lifecycle\/analytics/);
  assert.match(api, /\/lifecycle\/journeys/);
  assert.match(api, /internal_open/);
});

test("internal journey create and queue pages exist", () => {
  const createPage = readEnglishSource(join(webRoot, "app/(app)/lifecycle/journeys/new/page.tsx"));
  const queuePage = readEnglishSource(join(webRoot, "app/(app)/lifecycle/journeys/page.tsx"));
  assert.match(createPage, /lifecycleApi\.initiateJourney/);
  assert.match(queuePage, /Internal journeys/);
});
