import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COLUMN_LABEL_KEYS,
  REPORT_TABS,
  badgeClass,
  badgeLabelKey,
  columnLabelKey,
  contractHref,
  nextReportTab,
  nextSort,
  parseReportTab,
  reportCurrency,
  reportColumns,
  reportDownloadHref,
  reportKpis,
  rowMatchesQuery,
  sortReportRows,
  parseReportFlag,
  matchesReportFlag,
  kpiDrilldown,
  isKpiActive,
  columnPriority,
  columnVisibilityClass,
  exceptionTypeLabelKey,
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

test("tab parsing, filtered exports, sort and KPIs stay deterministic", () => {
  assert.equal(parseReportTab("financial"), "financial");
  assert.equal(parseReportTab("nope"), "register");
  assert.equal(
    reportDownloadHref("register", "csv", { status: "active" }),
    "/api/contracts/reports?type=register&format=csv&status=active",
  );
  assert.equal(
    reportDownloadHref("financial", "pdf"),
    "/api/contracts/reports?type=financial&format=pdf",
  );
  assert.equal(badgeLabelKey("status", "Active"), "contracts.reports.status.active");
  assert.equal(badgeLabelKey("health", "at_risk"), "contracts.reports.health.at_risk");

  const sorted = sortReportRows(
    [
      { reference: "B", current_value: 10 },
      { reference: "A", current_value: 40 },
      { reference: "C", current_value: 5 },
    ],
    { column: "current_value", direction: "desc" },
  );
  assert.deepEqual(sorted.map((row) => row.reference), ["A", "B", "C"]);
  assert.deepEqual(nextSort(null, "current_value"), { column: "current_value", direction: "desc" });
  assert.deepEqual(nextSort({ column: "title", direction: "asc" }, "title"), {
    column: "title",
    direction: "desc",
  });

  const kpis = reportKpis("operational", [
    { expiring_soon: true, expired: false, amendments: 2 },
    { expiring_soon: false, expired: true, amendments: 1 },
  ]);
  assert.equal(kpis.find((item) => item.id === "expiring")?.value, 1);
  assert.equal(kpis.find((item) => item.id === "expired")?.value, 1);
  assert.equal(kpis.find((item) => item.id === "amendments")?.value, 3);
  assert.equal(reportCurrency([{ currency: "NAD" }, { currency: "NAD" }]), "NAD");
  assert.equal(reportCurrency([{ currency: "NAD" }, { currency: "USD" }]), null);
});

test("KPI drill-downs, flags and column priority stay shareable", () => {
  assert.equal(parseReportFlag("unsigned"), "unsigned");
  assert.equal(parseReportFlag("at_risk"), "at_risk");
  assert.equal(parseReportFlag("nope"), null);
  assert.equal(matchesReportFlag({ unsigned: true }, "unsigned"), true);
  assert.equal(matchesReportFlag({ signature_status: "pending" }, "unsigned_signature"), true);
  assert.equal(matchesReportFlag({ signature_status: "signed" }, "unsigned_signature"), false);
  assert.equal(matchesReportFlag({ health: "at_risk" }, "at_risk"), true);
  assert.equal(matchesReportFlag({ health: "good" }, "at_risk"), false);
  assert.deepEqual(kpiDrilldown("register", "unsigned"), { flag: "unsigned_signature" });
  assert.deepEqual(kpiDrilldown("register", "risk"), { flag: "at_risk" });
  assert.deepEqual(kpiDrilldown("compliance", "legacy"), { flag: "legacy" });
  assert.deepEqual(kpiDrilldown("operational", "expiring"), { horizon: "expiring" });
  assert.deepEqual(kpiDrilldown("exceptions", "critical"), { severity: "critical" });
  assert.equal(kpiDrilldown("financial", "current"), null);
  assert.equal(isKpiActive("compliance", "unsigned", { flag: "unsigned", horizon: "all", severity: "all" }), true);
  assert.equal(isKpiActive("operational", "expired", { flag: null, horizon: "expired", severity: "all" }), true);
  assert.equal(columnPriority("register", "reference"), "always");
  assert.equal(columnPriority("register", "department"), "lg");
  assert.equal(columnVisibilityClass("lg"), "hidden lg:table-cell");
  assert.equal(exceptionTypeLabelKey("service_started_before_execution"), "contracts.reports.exceptionType.service_started_before_execution");
});

test("reports page is a labelled tabbed desk with exports and overflow", () => {
  const page = readFileSync(join(webRoot, "app/(app)/contracts/reports/page.tsx"), "utf8");
  assert.match(page, /role="tablist"/);
  assert.match(page, /data-testid=["']contract-reports-tabs["']/);
  assert.match(page, /data-testid=["']contract-reports-table["']/);
  assert.match(page, /data-testid=["']contract-reports-kpis["']/);
  assert.match(page, /data-testid=["']contract-reports-print["']/);
  assert.match(page, /data-testid=\{`contract-reports-export-\$\{format\}`\}/);
  assert.match(page, /contracts\.reports\.exportCsv/);
  assert.match(page, /contracts\.reports\.exportXlsx/);
  assert.match(page, /contracts\.reports\.exportPdf/);
  assert.match(page, /data-testid=["']contract-reports-search["']/);
  assert.match(page, /w-full min-w-0/);
  assert.match(page, /max-h-\[min\(/);
  assert.match(page, /columnLabelKey/);
  assert.match(page, /useI18n/);
  assert.match(page, /reportDownloadHref/);
  assert.match(page, /parseReportTab/);
  assert.match(page, /reportCurrency/);
  assert.match(page, /data-testid=["']contract-reports-chips["']/);
  assert.match(page, /data-testid=["']contract-reports-generated["']/);
  assert.match(page, /kpiDrilldown/);
  assert.match(page, /columnVisibilityClass/);
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
    "contracts.reports.emptyFiltered",
    "contracts.reports.print",
    "contracts.reports.kpi.currentValue",
    "contracts.reports.mixedCurrency",
    "contracts.reports.col.reference",
    "contracts.reports.col.original_value",
    "contracts.reports.clearFilters",
    "contracts.reports.generatedAt",
    "contracts.reports.kpiFilterHint",
    "contracts.reports.flag.at_risk",
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
