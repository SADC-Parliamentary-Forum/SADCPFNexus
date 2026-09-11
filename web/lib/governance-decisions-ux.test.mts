import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("decision register uses shared register chrome instead of a raw table", () => {
  const source = readPage("app/(app)/decisions/page.tsx");
  assert.match(source, /RegisterShell/);
  assert.match(source, /data-table/);
  assert.match(source, /EmptyState/);
  assert.match(source, /form-input/);
  assert.match(source, /href=["']\/decisions\/create["']/);
  assert.doesNotMatch(source, /className=["']input\b/);
});

test("new decision form uses module chrome, labelled fields, and styled inputs", () => {
  const source = readPage("app/(app)/decisions/create/page.tsx");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /FormSection/);
  assert.match(source, /FormField/);
  assert.match(source, /form-input/);
  assert.match(source, /htmlFor=/);
  assert.match(source, /apiErrorMessage/);
  assert.match(source, /decisionsApi\.create/);
  assert.doesNotMatch(source, /className=["']input\b/);
});

test("decision detail uses styled inputs and links through to minutes", () => {
  const source = readPage("app/(app)/decisions/[id]/page.tsx");
  assert.match(source, /form-input/);
  assert.match(source, /FormSection/);
  assert.match(source, /\/governance\/minutes\//);
  assert.doesNotMatch(source, /className=["']input\b/);
});

test("meetings and minutes register lists minutes records with a real view route", () => {
  const source = readPage("app/(app)/governance/page.tsx");
  assert.match(source, /RegisterShell/);
  assert.match(source, /minutesApi\.list/);
  assert.match(source, /href=\{`\/governance\/minutes\/\$\{/);
  assert.match(source, /\/governance\/minutes\/new/);
  assert.match(source, /EmptyState/);
  assert.match(source, /form-input/);
  assert.doesNotMatch(source, />View<\/button>/);
});

test("minutes detail and record pages exist as first-class routes", () => {
  const detail = "app/(app)/governance/minutes/[id]/page.tsx";
  const create = "app/(app)/governance/minutes/new/page.tsx";
  assert.equal(existsSync(join(webRoot, detail)), true, `${detail} must exist`);
  assert.equal(existsSync(join(webRoot, create)), true, `${create} must exist`);

  const detailSource = readPage(detail);
  assert.match(detailSource, /minutesApi\.get/);
  assert.match(detailSource, /ModulePageHeader/);
  assert.match(detailSource, /action_items/);

  const createSource = readPage(create);
  assert.match(createSource, /minutesApi\.create/);
  assert.match(createSource, /ModulePageHeader/);
  assert.match(createSource, /FormSection/);
  assert.match(createSource, /form-input/);
  assert.match(createSource, /htmlFor=/);
  assert.match(createSource, /apiErrorMessage/);
});

test("decisions dashboard keeps promote actions and uses module chrome", () => {
  const source = readPage("app/(app)/decisions/dashboard/page.tsx");
  assert.match(source, /promoteWeeklyAssignments/);
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /form-input/);
});
