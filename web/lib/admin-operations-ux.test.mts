import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, catalogFor } from "./i18n/messages.ts";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("admin operations uses labelled chrome, i18n, and shows fetched queues and job runs", () => {
  const source = readPage("app/(app)/admin/operations/page.tsx");

  assert.match(source, /ModulePageHeader/);
  assert.match(source, /useI18n/);
  assert.match(source, /operations\./);
  assert.match(source, /href: "\/admin"/);
  assert.match(source, /id="ops-config-item"/);
  assert.match(source, /id="ops-config-value"/);
  assert.match(source, /id="ops-config-reason"/);
  assert.match(source, /id="ops-restore-type"/);
  assert.match(source, /id="ops-restore-env"/);
  assert.match(source, /id="ops-restore-reason"/);
  assert.match(source, /id="ops-support-ticket"/);
  assert.match(source, /id="ops-support-reason"/);
  assert.match(source, /id="ops-breakglass-incident"/);
  assert.match(source, /id="ops-breakglass-reason"/);
  assert.match(source, /<label htmlFor=\{id\}/);
  assert.match(source, /EmptyState/);
  assert.match(source, /useConfirm/);
  assert.match(source, /useToast/);
  assert.match(source, /apiErrorMessage/);
  assert.match(source, /data-testid=["']ops-queues["']/);
  assert.match(source, /data-testid=["']ops-job-runs["']/);
  assert.match(source, /data-testid=["']ops-alerts["']/);
  assert.match(source, /adminConsoleApi\.queues/);
  assert.match(source, /adminConsoleApi\.jobRuns/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /queue_depth/);
  assert.match(source, /critical_alerts/);

  assert.doesNotMatch(source, /window\.prompt/);
  assert.doesNotMatch(source, /FormField/);
  assert.doesNotMatch(source, /<label className=/);
  assert.doesNotMatch(source, /return JSON\.stringify\(value\)/);
  assert.doesNotMatch(source, /className="p-6 /);
  assert.doesNotMatch(source, /text-primary underline/);
  assert.doesNotMatch(source, /placeholder="Proposed value"/);
  assert.doesNotMatch(source, /placeholder="Ticket reference"/);
});

test("admin operations catalog covers EN, FR and PT", () => {
  const keys = [
    "operations.title",
    "operations.subtitle",
    "operations.tab.overview",
    "operations.tab.reliability",
    "operations.queues",
    "operations.jobRuns",
    "operations.breakGlass",
    "operations.empty",
  ];
  const enTitle = catalogFor("en")["operations.title"];
  for (const locale of LOCALES) {
    const table = catalogFor(locale);
    for (const key of keys) {
      assert.ok(String(table[key] ?? "").trim(), `${locale} missing ${key}`);
    }
    if (locale !== "en") {
      assert.notEqual(table["operations.title"], enTitle);
    }
  }
});
