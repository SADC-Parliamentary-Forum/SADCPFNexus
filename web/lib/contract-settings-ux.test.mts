import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "app/(app)/contracts/settings/page.tsx"), "utf8");

test("contract settings fills the content column and keeps tables inside a scroll wrap", () => {
  assert.match(source, /data-testid=["']contract-settings["']/);
  assert.match(source, /w-full min-w-0/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.doesNotMatch(source, /max-w-4xl/);
  assert.doesNotMatch(source, /className="[^"]*mx-auto max-w-(lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)/);
});

test("contract settings uses section tabs, empty states, and labelled add forms", () => {
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /EmptyState|TableEmpty/);
  assert.match(source, /FormSection/);
  assert.match(source, /htmlFor="cs-type-name"/);
  assert.match(source, /id="cs-type-name"/);
  assert.match(source, /htmlFor="cs-currency-code"/);
  assert.match(source, /id="cs-currency-code"/);
  assert.match(source, /htmlFor="cs-rule-name"/);
  assert.match(source, /id="cs-rule-name"/);
  assert.match(source, /htmlFor="cs-req-code"/);
  assert.match(source, /id="cs-req-code"/);
  assert.match(source, /disabled=\{!typeName\.trim/);
  assert.match(source, /useConfirm/);
  assert.match(source, /apiErrorMessage/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /ErrorBanner/);
  assert.match(source, /<Checkbox/);
  assert.doesNotMatch(source, /<label className=/);
  assert.doesNotMatch(source, /window\.(alert|confirm|prompt)/);
  assert.doesNotMatch(source, /PRD §/);
  assert.doesNotMatch(source, /text-primary text-xs underline/);
});
