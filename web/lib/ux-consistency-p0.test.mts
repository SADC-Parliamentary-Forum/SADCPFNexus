import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsx(fullPath, acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".tsx")) acc.push(fullPath);
  }
  return acc;
}

test("native window.alert/confirm/prompt are not used in app pages or shared components", () => {
  const offenders: string[] = [];
  for (const fullPath of [...walkTsx(join(webRoot, "app")), ...walkTsx(join(webRoot, "components"))]) {
    const source = readFileSync(fullPath, "utf8");
    if (/window\.(alert|confirm|prompt)\s*\(/.test(source)) {
      offenders.push(fullPath.replace(webRoot, ""));
    }
  }
  assert.deepEqual(offenders, []);
});

test("confirm dialog exposes a labelled prompt for reason capture", () => {
  const source = readFileSync(join(webRoot, "components/ui/ConfirmDialog.tsx"), "utf8");
  assert.match(source, /prompt:\s*\(options: PromptOptions\) => Promise<string \| null>/);
  assert.match(source, /htmlFor=\{inputId\}/);
  assert.match(source, /id=\{inputId\}/);
  assert.match(source, /aria-required=\{options\.required \|\| undefined\}/);
});

test("travel TOIL queue uses shared chrome, empty state, and prompt dialog", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/toil/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /EmptyState/);
  assert.match(source, /useConfirm/);
  assert.match(source, /travel\.toil\.title/);
  assert.doesNotMatch(source, /window\.prompt/);
  assert.doesNotMatch(source, /text-2xl font-semibold/);
});

test("balance register update surfaces API errors without JSON dumps", () => {
  const source = readFileSync(join(webRoot, "app/(app)/finance/balance-register/[id]/update/page.tsx"), "utf8");
  assert.match(source, /apiErrorMessage/);
  assert.match(source, /htmlFor="bcre-txn-type"/);
  assert.match(source, /id="bcre-txn-type"/);
  assert.match(source, /htmlFor="bcre-amount"/);
  assert.match(source, /id="bcre-amount"/);
  assert.doesNotMatch(source, /JSON\.stringify\(msg\)/);
});

test("assignment calendar regenerates subscribe URLs through useConfirm", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/calendar/page.tsx"), "utf8");
  assert.match(source, /useConfirm/);
  assert.match(source, /assignments\.calendar\.regenerateTitle/);
  assert.doesNotMatch(source, /window\.confirm/);
});

test("travel queue tables use ModulePageHeader, EmptyState, and button actions", () => {
  const source = readFileSync(join(webRoot, "components/travel/TravelQueueTable.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /EmptyState/);
  assert.doesNotMatch(source, /hover:underline/);
  assert.doesNotMatch(source, /<h1 className="page-title">/);
});

test("HR settings master-data pages share HrSettingsHeader chrome and EmptyState", () => {
  const pages = [
    "grade-bands",
    "salary-scales",
    "job-families",
    "contract-types",
    "leave-profiles",
    "allowance-profiles",
    "appraisal-templates",
    "approval-matrix",
    "personnel-file-sections",
    "audit",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, `app/(app)/settings/hr/${rel}/page.tsx`), "utf8");
    assert.match(source, /HrSettingsHeader/, rel);
    assert.match(source, /EmptyState/, rel);
    assert.doesNotMatch(source, /<h1 className="page-title">/, rel);
  }
  const detail = readFileSync(join(webRoot, "app/(app)/settings/hr/grade-bands/[id]/page.tsx"), "utf8");
  assert.match(detail, /HrSettingsHeader/);
  assert.match(detail, /EmptyState/);
  assert.doesNotMatch(detail, /hover:underline/);
});

test("HR operational lists use ModulePageHeader, breadcrumbs, and EmptyState", () => {
  const pages = [
    "hr/files/page.tsx",
    "hr/conduct/page.tsx",
    "hr/incidents/page.tsx",
    "hr/performance/page.tsx",
    "hr/positions/page.tsx",
    "hr/profile-requests/page.tsx",
    "hr/timesheets/history/page.tsx",
    "hr/timesheets/templates/page.tsx",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, "app/(app)", rel), "utf8");
    assert.match(source, /ModulePageHeader/, rel);
    assert.match(source, /PageBreadcrumbs/, rel);
    assert.match(source, /EmptyState/, rel);
    assert.doesNotMatch(source, /<h1 className="page-title">/, rel);
  }
});

test("payslip desk and stock item modal do not use underline row actions", () => {
  const payslip = readFileSync(join(webRoot, "components/payslips/PayslipDistributionDesk.tsx"), "utf8");
  assert.doesNotMatch(payslip, /hover:underline/);
  const stock = readFileSync(join(webRoot, "components/stock/StockItemFormModal.tsx"), "utf8");
  assert.doesNotMatch(stock, /hover:underline/);
});

test("procurement operational lists share ProcurementPageHeader chrome and EmptyState", () => {
  const pages = ["rfq", "vendors", "intake", "invoices", "purchase-orders", "receipts"];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, `app/(app)/procurement/${rel}/page.tsx`), "utf8");
    assert.match(source, /ProcurementPageHeader/, rel);
    assert.match(source, /EmptyState/, rel);
    assert.doesNotMatch(source, /<h1 className="page-title">/, rel);
    assert.doesNotMatch(source, /hover:underline/, rel);
  }
});

test("salary-advance operational pages share SalaryAdvancePageHeader chrome", () => {
  const pages = [
    "salary-advances/finance/page.tsx",
    "salary-advances/reports/page.tsx",
    "salary-advances/reconciliation/page.tsx",
    "salary-advances/settings/page.tsx",
    "salary-advances/[id]/page.tsx",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, "app/(app)", rel), "utf8");
    assert.match(source, /SalaryAdvancePageHeader/, rel);
    assert.doesNotMatch(source, /<h1 className="page-title">/, rel);
  }
  const recon = readFileSync(join(webRoot, "app/(app)/salary-advances/reconciliation/page.tsx"), "utf8");
  assert.match(recon, /EmptyState/);
});

test("travel missions list uses ModulePageHeader, breadcrumbs, and EmptyState", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/missions/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /EmptyState/);
  assert.doesNotMatch(source, /<h1 className="page-title">/);
  assert.doesNotMatch(source, /hover:underline/);
});

test("remaining operational details use shared page chrome instead of adhoc h1", () => {
  const pages = [
    "assets/categories/page.tsx",
    "assets/depreciation/page.tsx",
    "assignments/capacity/page.tsx",
    "correspondence/mail-merge/page.tsx",
    "profile/support/page.tsx",
    "mande/import/page.tsx",
    "stock/[id]/page.tsx",
    "stock/stocktakes/[id]/page.tsx",
    "finance/budget/[id]/page.tsx",
    "finance/balance-register/[id]/page.tsx",
    "workplan/[id]/page.tsx",
    "srhr/reports/[id]/page.tsx",
    "srhr/parliaments/[id]/page.tsx",
    "srhr/deployments/[id]/page.tsx",
    "saam/verify/[type]/[id]/page.tsx",
    "procurement/invoices/[id]/page.tsx",
    "procurement/receipts/[id]/page.tsx",
    "procurement/purchase-orders/[id]/page.tsx",
    "procurement/contracts/[id]/page.tsx",
    "procurement/rfq/[id]/page.tsx",
    "procurement/[id]/page.tsx",
    "procurement/tenders/[id]/page.tsx",
    "procurement/vendors/[id]/page.tsx",
    "travel/[id]/page.tsx",
    "imprest/[id]/page.tsx",
    "imprest/[id]/liquidate/page.tsx",
    "assignments/[id]/page.tsx",
    "hr/assignments/[id]/page.tsx",
    "risk/[id]/page.tsx",
    "risk/policies/[id]/page.tsx",
    "travel/missions/[id]/page.tsx",
    "mande/strategic-plan/[id]/page.tsx",
    "mande/activity-reports/create/page.tsx",
    "mande/activity-reports/[id]/page.tsx",
    "decisions/create/page.tsx",
    "decisions/dashboard/page.tsx",
    "correspondence/[id]/page.tsx",
    "people/settings/page.tsx",
    "budget/cycles/[id]/page.tsx",
    "budget/submissions/[id]/page.tsx",
    "budget/changes/create/page.tsx",
    "budget/changes/[id]/page.tsx",
    "governance/plenary/page.tsx",
    "admin/data-scope/page.tsx",
    "admin/calendar/page.tsx",
    "admin/governance/page.tsx",
    "admin/ledger/[id]/page.tsx",
    "admin/workflows/designer/page.tsx",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, "app/(app)", rel), "utf8");
    const hasChrome =
      /ModulePageHeader|ProcurementPageHeader|SalaryAdvancePageHeader|RegisterShell|AuditPageShell|ContentCanvas|ModuleHubCards/.test(
        source,
      );
    assert.equal(hasChrome, true, rel);
    assert.doesNotMatch(source, /<h1 className="page-title/, rel);
    assert.doesNotMatch(source, /<h1 className="text-xl font-bold/, rel);
    assert.doesNotMatch(source, /<h1 className="text-lg font-semibold/, rel);
    assert.doesNotMatch(source, /<h1 className="text-2xl/, rel);
    assert.doesNotMatch(source, /<h1 className="text-3xl/, rel);
  }
});

test("workplan, correspondence, assignment, risk, and salary-advance actions are buttons not underlines", () => {
  const pages = [
    "workplan/[id]/page.tsx",
    "workplan/event-types/page.tsx",
    "workplan/meeting-types/page.tsx",
    "workplan/page.tsx",
    "correspondence/[id]/page.tsx",
    "assignments/[id]/page.tsx",
    "risk/[id]/page.tsx",
    "salary-advances/page.tsx",
    "stock/units/page.tsx",
    "stock/locations/page.tsx",
    "travel/page.tsx",
    "travel/register/page.tsx",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, "app/(app)", rel), "utf8");
    assert.doesNotMatch(source, /hover:underline/, rel);
  }
});

test("weekly-summaries, SRHR lists, SAAM, profile, M&E, and risk hubs drop underline actions", () => {
  const pages = [
    "weekly-summaries/page.tsx",
    "weekly-summaries/review/page.tsx",
    "weekly-summaries/institutional/page.tsx",
    "weekly-summaries/department/page.tsx",
    "weekly-summaries/compliance/page.tsx",
    "srhr/page.tsx",
    "srhr/parliaments/page.tsx",
    "srhr/reports/page.tsx",
    "srhr/deployments/page.tsx",
    "saam/page.tsx",
    "saam/delegations/page.tsx",
    "profile/page.tsx",
    "profile/signature/page.tsx",
    "profile/security/page.tsx",
    "mande/page.tsx",
    "mande/review-queue/page.tsx",
    "mande/activity-reports/page.tsx",
    "mande/indicators/page.tsx",
    "risk/page.tsx",
    "risk/create/page.tsx",
    "risk/audit-trail/page.tsx",
    "leave/queues/certify/page.tsx",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, "app/(app)", rel), "utf8");
    assert.doesNotMatch(source, /hover:underline/, rel);
  }
  const header = readFileSync(join(webRoot, "components/layout/Header.tsx"), "utf8");
  assert.doesNotMatch(header, /hover:underline/);
});

test("operational app pages keep hover:underline only on mailto and website links", () => {
  const offenders: string[] = [];
  for (const fullPath of walkTsx(join(webRoot, "app", "(app)"))) {
    const source = readFileSync(fullPath, "utf8");
    const lines = source.split("\n");
    for (const [i, line] of lines.entries()) {
      if (!line.includes("hover:underline")) continue;
      if (line.includes("mailto:") || line.includes("website") || line.includes("target=\"_blank\"")) continue;
      offenders.push(`${fullPath.replace(webRoot, "")}:${i + 1}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("operational mobile detail screens use StitchScreen chrome", () => {
  const mobileRoot = join(webRoot, "..", "mobile", "lib", "features");
  const screens = [
    "requests/presentation/screens/leave_request_detail_screen.dart",
    "requests/presentation/screens/travel_request_detail_screen.dart",
    "imprest/presentation/screens/imprest_detail_screen.dart",
    "risk/presentation/screens/risk_detail_screen.dart",
    "correspondence/presentation/screens/correspondence_detail_screen.dart",
    "assignments/presentation/screens/assignment_detail_screen.dart",
    "assignments/presentation/screens/assignments_calendar_screen.dart",
    "procurement/presentation/screens/procurement_detail_screen.dart",
    "procurement/presentation/screens/vendor_detail_screen.dart",
    "procurement/presentation/screens/procurement_tender_detail_screen.dart",
    "weekly_summaries/presentation/screens/weekly_summary_detail_screen.dart",
    "reports/presentation/screens/report_detail_screen.dart",
    "calendar/presentation/screens/calendar_holidays_screen.dart",
    "finance/presentation/screens/finance_command_center_screen.dart",
    "finance/presentation/screens/budget_cashflow_screen.dart",
    "finance/presentation/screens/budget_variance_screen.dart",
    "finance/presentation/screens/audit_compliance_screen.dart",
    "hr/presentation/screens/hr_file_summary_screen.dart",
    "hr/presentation/screens/hr_file_documents_screen.dart",
    "hr/presentation/screens/hr_performance_dashboard_screen.dart",
    "hr/presentation/screens/hr_governance_dashboard_screen.dart",
    "hr/presentation/screens/supervisor_team_detail_screen.dart",
    "hr/presentation/screens/performance_tracker_screen.dart",
    "governance/presentation/screens/resolutions_oversight_screen.dart",
    "governance/presentation/screens/plenary_resolution_dashboard_screen.dart",
    "governance/presentation/screens/regional_compliance_tracker_screen.dart",
    "governance/presentation/screens/delegation_meetings_screen.dart",
    "dashboard/presentation/screens/executive_cockpit_screen.dart",
    "analytics/presentation/screens/global_executive_summary_screen.dart",
    "pif/presentation/screens/pif_lifecycle_review_screen.dart",
    "pif/presentation/screens/pif_lifecycle_flow_screen.dart",
    "imprest/presentation/screens/expense_retirement_audit_screen.dart",
    "assets/presentation/screens/fleet_transport_screen.dart",
    "assets/presentation/screens/fleet_vehicle_detail_screen.dart",
    "procurement/presentation/screens/procurement_rfq_screen.dart",
    "support/presentation/screens/user_support_health_screen.dart",
    "timesheets/presentation/screens/timesheet_weekly_screen.dart",
    "pif/presentation/screens/pif_budget_screen.dart",
    "profile/presentation/screens/user_profile_security_screen.dart",
  ];
  for (const rel of screens) {
    const source = readFileSync(join(mobileRoot, rel), "utf8");
    assert.match(source, /StitchScreen/, rel);
    assert.match(source, /StitchLoadingState/, rel);
    assert.match(source, /StitchErrorState/, rel);
  }
});

test("operational detail and correspondence send forms bind labels with htmlFor before className", () => {
  const pages = [
    "travel/[id]/page.tsx",
    "imprest/[id]/page.tsx",
    "imprest/[id]/liquidate/page.tsx",
    "assignments/[id]/page.tsx",
    "hr/assignments/[id]/page.tsx",
    "risk/[id]/page.tsx",
    "correspondence/create/page.tsx",
    "correspondence/incoming/page.tsx",
    "correspondence/[id]/page.tsx",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, "app/(app)", rel), "utf8");
    const labels = source.match(/<label\b/g)?.length ?? 0;
    const bound = source.match(/<label\b[^>]*htmlFor=/g)?.length ?? 0;
    assert.equal(bound, labels, `${rel} unbound labels`);
    assert.doesNotMatch(source, /<label className=/, rel);
    for (const [, id] of source.matchAll(/<label\b[^>]*htmlFor="([^"]+)"/g)) {
      assert.match(source, new RegExp(`\\bid="${id}"`), `${rel} missing id ${id}`);
    }
  }

  const wrappers = [
    "components/ui/Input.tsx",
    "components/ui/Select.tsx",
    "components/ui/DocumentsPanel.tsx",
    "components/ui/GenericDocumentsPanel.tsx",
    "components/travel/DestinationPickers.tsx",
    "components/risk/ApplyMitigationFields.tsx",
    "components/stock/StockItemFormModal.tsx",
    "components/stock/StockMovementModal.tsx",
    "components/assignments/CreateAssignmentFromSourceModal.tsx",
    "components/budget/BudgetLinePicker.tsx",
    "components/budget/PifFinanceBudgetCertify.tsx",
  ];
  for (const rel of wrappers) {
    const source = readFileSync(join(webRoot, rel), "utf8");
    assert.doesNotMatch(source, /<label className=/, rel);
    const labels = source.match(/<label\b/g)?.length ?? 0;
    const bound = source.match(/<label\b[^>]*htmlFor=/g)?.length ?? 0;
    assert.equal(bound, labels, `${rel} unbound labels`);
  }
});

test("operational app pages and shared components do not use className-first labels", () => {
  const offenders: string[] = [];
  const skip = /\/(print|certificate)\//;
  for (const fullPath of [...walkTsx(join(webRoot, "app/(app)")), ...walkTsx(join(webRoot, "components"))]) {
    if (skip.test(fullPath) || fullPath.includes(".print.")) continue;
    const source = readFileSync(fullPath, "utf8");
    if (/<label className=/.test(source)) {
      offenders.push(fullPath.replace(webRoot, ""));
    }
  }
  assert.deepEqual(offenders, []);
});

test("operational non-redirect pages use gold chrome", () => {
  const chrome = [
    "ModulePageHeader",
    "RegisterShell",
    "AuditPageShell",
    "ContentCanvas",
    "ModuleHubCards",
    "HrSettingsHeader",
    "ProcurementPageHeader",
    "SalaryAdvancePageHeader",
    "TravelQueueTable",
    "AdvanceQueueTable",
    "AssignmentFilteredList",
    "PayslipDistributionDesk",
  ];
  const offenders: string[] = [];
  const skip = /\/(print|certificate)\//;
  for (const fullPath of walkTsx(join(webRoot, "app/(app)"))) {
    if (!fullPath.endsWith("page.tsx")) continue;
    if (skip.test(fullPath) || fullPath.includes(".print.")) continue;
    const source = readFileSync(fullPath, "utf8");
    if (source.includes("redirect(")) continue;
    if (!chrome.some((token) => source.includes(token))) {
      offenders.push(fullPath.replace(webRoot, ""));
    }
  }
  assert.deepEqual(offenders, []);
});

test("RegisterShell empty slots use EmptyState", () => {
  const offenders: string[] = [];
  for (const fullPath of walkTsx(join(webRoot, "app/(app)"))) {
    if (!fullPath.endsWith("page.tsx")) continue;
    const source = readFileSync(fullPath, "utf8");
    if (!source.includes("RegisterShell")) continue;
    if (!/\bempty=\{/.test(source)) continue;
    if (!source.includes("EmptyState")) {
      offenders.push(fullPath.replace(webRoot, ""));
    }
  }
  assert.deepEqual(offenders, []);
});

