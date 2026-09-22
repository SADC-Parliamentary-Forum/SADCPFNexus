import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REPORT_FAMILIES,
  filterCatalogue,
  presentFamilies,
  familyI18nKey,
  reportHref,
  reportRowKey,
  displayReportValue,
} from "./asset-report-catalogue.ts";
import { catalogFor } from "./i18n/messages.ts";

const webRoot = join(process.cwd());

const sample = [
  { id: "R01", family: "Custody", name: "Assigned", purpose: "", priority: "must", formats: ["pdf"], template_version: "2.0" },
  { id: "R11", family: "Inventory", name: "Register", purpose: "", priority: "must", formats: ["xlsx"], template_version: "2.0" },
  { id: "R21", family: "Financial", name: "Depreciation", purpose: "", priority: "must", formats: ["xlsx"], template_version: "2.0" },
  { id: "R52", family: "Audit", name: "Trail", purpose: "", priority: "must", formats: ["pdf"], template_version: "2.0" },
];

test("catalogue helpers group and filter the ten PRD families", () => {
  assert.equal(REPORT_FAMILIES.length, 10);
  assert.deepEqual(presentFamilies(sample), ["Custody", "Inventory", "Financial", "Audit"]);
  assert.deepEqual(filterCatalogue(sample, "all").map((row) => row.id), ["R01", "R11", "R21", "R52"]);
  assert.deepEqual(filterCatalogue(sample, "Custody").map((row) => row.id), ["R01"]);
  assert.equal(familyI18nKey("Custody"), "assets.reports.familyCustody");
  assert.equal(reportHref("R01"), "#asset-report-r01");
  assert.equal(reportHref("R09"), "#asset-report-r01");
  assert.equal(reportHref("R11"), "#asset-report-r01");
  assert.equal(reportHref("R21"), "#asset-report-r01");
  assert.equal(reportHref("R31"), "#asset-report-r01");
  assert.equal(reportHref("R40"), "#asset-report-r01");
  assert.equal(reportHref("R52"), "#asset-report-r01");
  assert.equal(reportHref("R51"), "#asset-report-r01");
  assert.equal(reportHref("R24"), null);
  assert.equal(reportRowKey({ asset_id: 11, asset_tag: "CAP-001" }, 0), "11-0");
  assert.equal(displayReportValue(null), "—");
});

test("reports page keeps register export testids and runs the R01 catalogue", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/reports/page.tsx"), "utf8");
  assert.match(page, /assetsApi\.reportCatalogue/);
  assert.match(page, /assetsApi\.runGovernedReport/);
  assert.match(page, /assetsApi\.exportGovernedReport/);
  assert.match(page, /data-testid=["']asset-reports-catalogue["']/);
  assert.match(page, /data-testid=["']asset-reports-r01-run["']/);
  assert.match(page, /data-testid=["']asset-reports-r01-pdf["']/);
  assert.match(page, /data-testid=["']asset-reports-r01-xlsx["']/);
  assert.match(page, /data-testid=["']asset-reports-download-csv["']/);
  assert.match(page, /data-testid=["']asset-reports-download-excel["']/);
  assert.match(page, /data-testid=["']asset-reports-status["']/);
  assert.match(page, /report\.columns/);
  assert.match(page, /displayReportValue/);
});

test("EN FR PT share the new report-centre keys", () => {
  const keys = [
    "assets.reports.catalogue",
    "assets.reports.assignedToUser",
    "assets.reports.modeCurrent",
    "assets.reports.familyCustody",
    "assets.reports.runMeta",
  ];
  for (const locale of ["en", "fr", "pt"] as const) {
    const table = catalogFor(locale);
    for (const key of keys) {
      assert.ok(table[key] && String(table[key]).trim() !== "", `${locale} missing ${key}`);
    }
  }
  assert.notEqual(catalogFor("fr")["assets.reports.catalogue"], catalogFor("en")["assets.reports.catalogue"]);
  assert.notEqual(catalogFor("pt")["assets.reports.catalogue"], catalogFor("en")["assets.reports.catalogue"]);
});
