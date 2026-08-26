import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  defaultPayPeriodValue,
  formatPayPeriod,
  isPayslipDocument,
  isPayslipZip,
  parsePeriodValue,
} from "./payslipPeriod.ts";

const webRoot = join(process.cwd());

test("default pay period is the previous calendar month", () => {
  assert.equal(defaultPayPeriodValue(new Date("2026-08-26T12:00:00Z")), "2026-07");
  assert.equal(defaultPayPeriodValue(new Date("2026-01-03T12:00:00Z")), "2025-12");
});

test("parsePeriodValue accepts YYYY-MM only", () => {
  assert.deepEqual(parsePeriodValue("2026-08"), { year: 2026, month: 8 });
  assert.equal(parsePeriodValue("2026-13"), null);
  assert.equal(parsePeriodValue("August 2026"), null);
});

test("formatPayPeriod and file type helpers", () => {
  assert.equal(formatPayPeriod(8, 2026), "August 2026");
  assert.equal(isPayslipZip("payroll.zip"), true);
  assert.equal(isPayslipDocument("EMP042.pdf"), true);
  assert.equal(isPayslipDocument("notes.txt"), false);
});

test("staff payslips use RegisterShell", () => {
  const source = readFileSync(join(webRoot, "app/(app)/finance/payslips/page.tsx"), "utf8");
  assert.match(source, /RegisterShell/);
  assert.match(source, /Latest payslip/);
  assert.doesNotMatch(source, /max-w-4xl space-y-6/);
});

test("HR and admin payslip pages share the distribution desk", () => {
  const hr = readFileSync(join(webRoot, "app/(app)/hr/payslips/page.tsx"), "utf8");
  const admin = readFileSync(join(webRoot, "app/(app)/admin/payslips/page.tsx"), "utf8");
  const desk = readFileSync(join(webRoot, "components/payslips/PayslipDistributionDesk.tsx"), "utf8");
  assert.match(hr, /PayslipDistributionDesk/);
  assert.match(admin, /PayslipDistributionDesk/);
  assert.match(desk, /Issue payslips/);
  assert.match(desk, /adminApi\.matchPayslips/);
  assert.match(desk, /adminApi\.matchPayslipUploads/);
  assert.match(desk, /adminApi\.distributePayslips/);
  assert.match(desk, /Assign to staff/);
  assert.match(desk, /assignPersonToNextFile/);
  assert.doesNotMatch(desk, /EMP\\\\d\+/);
});

test("finance and HR sidebars expose issue payslips for HR", () => {
  const finance = readFileSync(join(webRoot, "lib/hubs/finance.ts"), "utf8");
  const hr = readFileSync(join(webRoot, "lib/hubs/hr.ts"), "utf8");
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  assert.match(finance, /\/hr\/payslips/);
  assert.match(finance, /Issue payslips/);
  assert.match(finance, /My payslips/);
  assert.match(hr, /\/hr\/payslips/);
  assert.match(sidebar, /href: "\/hr\/payslips"/);
});
