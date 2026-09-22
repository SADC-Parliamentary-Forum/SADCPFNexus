import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COLUMN_LABEL_KEYS,
  REPORT_TABS,
  badgeClass,
  columnLabelKey,
  contractHref,
  nextReportTab,
  reportColumns,
  rowMatchesQuery,
} from "./contract-reports.ts";
import { catalogFor, translate } from "./i18n/messages.ts";

const webRoot = join(process.cwd());

test("report tabs cover the five governed contract reports", () => {
  assert.deepEqual(REPORT_TABS.map((tab) => tab.id), [
    "register",
    "financial",
    "compliance",
    "operational",
    "exceptions",
  ]);
});

test("report columns hide the linking id and keep known labels", () => {
  const columns = reportColumns([
    { id: 9, reference: "CTR-001", original_value: 1200, health: "good" },
  ]);
  assert.deepEqual(columns, ["reference", "original_value", "health"]);
  assert.equal(columnLabelKey("reference"), "contracts.reports.col.reference");
  assert.equal(columnLabelKey("original_value"), COLUMN_LABEL_KEYS.original_value);
});

test("row search matches visible values and ignores id", () => {
  const row = { id: 44, reference: "CTR-009", title: "Harare venue hire" };
  assert.equal(rowMatchesQuery(row, "harare"), true);
  assert.equal(rowMatchesQuery(row, "44"), false);
  assert.equal(rowMatchesQuery(row, "missing"), false);
});

test("contract href and tab cycling stay bounded", () => {
  assert.equal(contractHref(12), "/contracts/12");
  assert.equal(contractHref("12"), "/contracts/12");
  assert.equal(contractHref("CTR-1"), null);
  assert.equal(nextReportTab("register", -1), "exceptions");
  assert.equal(nextReportTab("exceptions", 1), "register");
  assert.equal(badgeClass("severity", "critical"), "badge-danger");
  assert.equal(badgeClass("status", "active"), "badge-success");
});

test("reports page is a labelled tabbed desk with exports and overflow", () => {
  const page = readFileSync(join(webRoot, "app/(app)/contracts/reports/page.tsx"), "utf8");
  assert.match(page, /role="tablist"/);
  assert.match(page, /data-testid=["']contract-reports-tabs["']/);
  assert.match(page, /data-testid=["']contract-reports-table["']/);
  assert.match(page, /data-testid=\{`contract-reports-export-\$\{format\}`\}/);
  assert.match(page, /contracts\.reports\.exportCsv/);
  assert.match(page, /contracts\.reports\.exportXlsx/);
  assert.match(page, /contracts\.reports\.exportPdf/);
  assert.match(page, /data-testid=["']contract-reports-search["']/);
  assert.match(page, /w-full min-w-0/);
  assert.match(page, /max-h-\[32rem\]/);
  assert.match(page, /columnLabelKey/);
  assert.match(page, /useI18n/);
  assert.doesNotMatch(page, /c\.replace\(\/_\/g/);
  assert.doesNotMatch(page, /className=\{`filter-tab capitalize/);
});

test("contract reports catalogue covers EN, FR and PT", () => {
  const keys = [
    "contracts.reports.title",
    "contracts.reports.subtitle",
    "contracts.reports.tabRegister",
    "contracts.reports.tabExceptions",
    "contracts.reports.exportCsv",
    "contracts.reports.empty",
    "contracts.reports.col.reference",
    "contracts.reports.col.original_value",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
    assert.ok(key in catalogFor("en"));
  }
});
