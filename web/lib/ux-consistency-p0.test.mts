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
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, "app/(app)", rel), "utf8");
    const hasChrome =
      /ModulePageHeader|ProcurementPageHeader|SalaryAdvancePageHeader|RegisterShell|AuditPageShell|ContentCanvas|ModuleHubCards/.test(
        source,
      );
    assert.equal(hasChrome, true, rel);
    assert.doesNotMatch(source, /<h1 className="page-title">/, rel);
    assert.doesNotMatch(source, /<h1 className="text-xl font-bold/, rel);
    assert.doesNotMatch(source, /<h1 className="text-lg font-semibold/, rel);
  }
});

