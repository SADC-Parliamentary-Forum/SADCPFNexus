import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("AccessDenied component exists and AppShell renders it instead of silent dashboard redirect", () => {
  const accessDenied = readFileSync(join(webRoot, "components/ui/AccessDenied.tsx"), "utf8");
  const appShell = readFileSync(join(webRoot, "components/layout/AppShell.tsx"), "utf8");

  assert.match(accessDenied, /Access denied/i);
  assert.match(accessDenied, /You cannot open this page/);
  assert.match(appShell, /AccessDenied/);
  assert.doesNotMatch(appShell, /router\.replace\("\/dashboard"\)/);
});

test("Approvals inbox redirects to unified /approvals", () => {
  const inbox = readFileSync(join(webRoot, "app/(app)/approvals/inbox/page.tsx"), "utf8");
  assert.match(inbox, /redirect\("\/approvals"\)/);
});

test("sidebar exposes one Approvals entry point", () => {
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const approvalHrefCount = sidebar.match(/href:\s*"\/approvals"/g)?.length ?? 0;

  assert.equal(approvalHrefCount, 1);
  assert.doesNotMatch(sidebar, /href:\s*"\/approvals\/inbox"/);
});

test("badge-info and alert-info are defined", () => {
  const css = readFileSync(join(webRoot, "app/globals.css"), "utf8");
  assert.match(css, /\.badge-info\s*\{/);
  assert.match(css, /\.alert-info\s*\{/);
});

test("native browser confirm is not used in app or shared components", () => {
  const roots = [join(webRoot, "app"), join(webRoot, "components")];
  const offenders: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;

      const source = readFileSync(fullPath, "utf8");
      const usesBareConfirm = /(^|[^\w.])confirm\s*\(/m.test(source);
      const isConfirmProvider = fullPath.endsWith(join("components", "ui", "ConfirmDialog.tsx"));
      if (usesBareConfirm && !source.includes("useConfirm") && !isConfirmProvider) {
        offenders.push(fullPath.replace(webRoot, ""));
      }
    }
  };

  roots.forEach(walk);
  assert.deepEqual(offenders, []);
});

test("assets verification campaign create handles failures and locks duplicate submits", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/verification/page.tsx"), "utf8");

  assert.match(source, /const \[creating,\s*setCreating\]/);
  assert.match(source, /if \(creating\) return/);
  assert.match(source, /try\s*\{/);
  assert.match(source, /catch \(error: any\)/);
  assert.match(source, /setErrorMsg/);
  assert.match(source, /disabled=\{creating\}/);
});

test("audit plans create draft locks duplicate submits while pending", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/plans/page.tsx"), "utf8");

  assert.match(source, /if \(!planTitle \|\| create\.isPending\) return/);
  assert.match(source, /create\.mutate\(planTitle\)/);
  assert.match(source, /disabled=\{create\.isPending\}/);
  assert.match(source, /disabled=\{create\.isPending \|\| !title\.trim\(\)\}/);
  assert.match(source, /Creating\.\.\./);
});

test("audit engagements create locks duplicate submits while pending", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/engagements/page.tsx"), "utf8");

  assert.match(source, /if \(!engagementTitle \|\| create\.isPending\) return/);
  assert.match(source, /create\.mutate\(engagementTitle\)/);
  assert.match(source, /disabled=\{create\.isPending\}/);
  assert.match(source, /disabled=\{create\.isPending \|\| !title\.trim\(\)\}/);
  assert.match(source, /Creating\.\.\./);
});

test("external audit create locks duplicate submits while pending", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/external/page.tsx"), "utf8");

  assert.match(source, /if \(!externalTitle \|\| create\.isPending\) return/);
  assert.match(source, /create\.mutate\(externalTitle\)/);
  assert.match(source, /disabled=\{create\.isPending\}/);
  assert.match(source, /disabled=\{create\.isPending \|\| !title\.trim\(\)\}/);
  assert.match(source, /Creating\.\.\./);
});

test("audit universe create locks duplicate submits while pending", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/universe/page.tsx"), "utf8");

  assert.match(source, /if \(!entityName \|\| create\.isPending\) return/);
  assert.match(source, /create\.mutate\(entityName\)/);
  assert.match(source, /disabled=\{create\.isPending\}/);
  assert.match(source, /disabled=\{create\.isPending \|\| !name\.trim\(\)\}/);
  assert.match(source, /Adding\.\.\./);
});

test("risk control create locks duplicate submits while pending", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/controls/page.tsx"), "utf8");

  assert.match(source, /const \[creating,\s*setCreating\]/);
  assert.match(source, /if \(!controlTitle \|\| creating\) return/);
  assert.match(source, /title: controlTitle/);
  assert.match(source, /disabled=\{creating\}/);
  assert.match(source, /disabled=\{creating \|\| !title\.trim\(\)\}/);
  assert.match(source, /Adding\.\.\./);
});

test("correspondence retention save locks duplicate submits while pending", () => {
  const source = readFileSync(join(webRoot, "app/(app)/correspondence/retention/page.tsx"), "utf8");

  assert.match(source, /const \[saving,\s*setSaving\]/);
  assert.match(source, /if \(!targetLetterId \|\| saving\) return/);
  assert.match(source, /\/correspondence\/letters\/\$\{targetLetterId\}\/retention/);
  assert.match(source, /disabled=\{saving\}/);
  assert.match(source, /disabled=\{saving \|\| !letterId\.trim\(\)\}/);
  assert.match(source, /Saving…/);
});

test("leave create blocks segments whose end date is before the start date", () => {
  const source = readFileSync(join(webRoot, "app/(app)/leave/create/page.tsx"), "utf8");

  assert.match(source, /function hasInvalidDateRange/);
  assert.match(source, /dateValidationError/);
  assert.match(source, /Segment \$\{invalidIndex \+ 1\} ends before it starts/);
  assert.match(source, /min=\{segment\.start_date \|\| undefined\}/);
  assert.match(source, /aria-invalid=\{hasInvalidDateRange\(segment\) \|\| undefined\}/);
  assert.match(source, /End date cannot be before start date\./);
  assert.match(source, /const canSubmit = completeForPreview && !dateValidationError/);
});

test("travel DSA rate fields are constrained to non-negative values", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/settings/page.tsx"), "utf8");

  assert.match(source, /const nonNegativeNumber = \(value: string\) => Math\.max\(0, Number\(value\)\)/);
  assert.match(source, /rate_per_day: nonNegativeNumber\(e\.target\.value\)/);
  assert.match(source, /accommodation_component: nonNegativeNumber\(e\.target\.value\)/);
  assert.match(source, /meal_component: nonNegativeNumber\(e\.target\.value\)/);
  assert.match(source, /incidentals_component: nonNegativeNumber\(e\.target\.value\)/);

  const dsaForm = source.slice(source.indexOf("<form onSubmit={onSubmit}"), source.indexOf("<div className=\"col-span-2 flex justify-end\">"));
  const minZeroCount = dsaForm.match(/type="number" min=\{0\}/g)?.length ?? 0;
  assert.equal(minZeroCount, 4);
});

test("asset insurance effective date inputs have visible labels", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/insurance/page.tsx"), "utf8");

  assert.match(source, /htmlFor="policy-effective-from"/);
  assert.match(source, /Effective from/);
  assert.match(source, /id="policy-effective-from"/);
  assert.match(source, /htmlFor="policy-effective-to"/);
  assert.match(source, /Effective to/);
  assert.match(source, /id="policy-effective-to"/);
});

test("timesheet week navigation chevrons have accessible names", () => {
  const source = readFileSync(join(webRoot, "app/(app)/hr/timesheets/page.tsx"), "utf8");

  assert.match(source, /aria-label="Previous week"/);
  assert.match(source, /title="Previous week"/);
  assert.match(source, /aria-label="Next week"/);
  assert.match(source, /title="Next week"/);
});

test("toast container exposes an assistive live region", () => {
  const source = readFileSync(join(webRoot, "components/ui/Toast.tsx"), "utf8");

  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-atomic="true"/);
});

test("toast item supports dark mode and has a named dismiss button", () => {
  const source = readFileSync(join(webRoot, "components/ui/Toast.tsx"), "utf8");

  assert.match(source, /aria-label="Dismiss notification"/);
  assert.match(source, /dark:bg-neutral-900/);
  assert.match(source, /dark:bg-neutral-800/);
  assert.match(source, /dark:text-neutral-100/);
  assert.match(source, /dark:text-neutral-400/);
  assert.match(source, /dark:hover:text-neutral-300/);
  assert.match(source, /dark:border-green-800/);
  assert.match(source, /dark:border-red-800/);
  assert.match(source, /dark:border-amber-800/);
  assert.match(source, /dark:border-blue-800/);
});

test("design-system Input and Select primitives support dark mode", () => {
  const input = readFileSync(join(webRoot, "components/ui/Input.tsx"), "utf8");
  const select = readFileSync(join(webRoot, "components/ui/Select.tsx"), "utf8");

  assert.match(input, /dark:text-neutral-400/);
  assert.match(input, /dark:text-neutral-500/);
  assert.match(input, /dark:border-neutral-700/);
  assert.match(input, /dark:bg-neutral-900/);
  assert.match(input, /dark:text-neutral-100/);
  assert.match(input, /dark:placeholder-neutral-500/);
  assert.match(input, /dark:border-red-500/);
  assert.match(input, /dark:text-red-400/);

  assert.match(select, /dark:text-neutral-400/);
  assert.match(select, /dark:text-neutral-500/);
  assert.match(select, /dark:border-neutral-700/);
  assert.match(select, /dark:bg-neutral-900/);
  assert.match(select, /dark:text-neutral-100/);
});

test("notifications panel supports dark mode", () => {
  const source = readFileSync(join(webRoot, "components/ui/NotificationsPanel.tsx"), "utf8");

  assert.match(source, /dark:bg-neutral-950/);
  assert.match(source, /dark:bg-black\/50/);
  assert.match(source, /dark:border-neutral-800/);
  assert.match(source, /dark:divide-neutral-800/);
  assert.match(source, /dark:hover:bg-neutral-900/);
  assert.match(source, /dark:text-neutral-100/);
  assert.match(source, /dark:text-neutral-300/);
  assert.match(source, /dark:text-neutral-400/);
  assert.match(source, /dark:text-neutral-500/);
  assert.match(source, /dark:bg-orange-950/);
  assert.match(source, /dark:bg-blue-950/);
  assert.match(source, /dark:bg-red-950/);
});

test("risk workflow action modal supports dark mode", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/[id]/page.tsx"), "utf8");
  const sharedModal = readFileSync(join(webRoot, "components/ui/Modal.tsx"), "utf8");
  const modalStart = source.indexOf("Workflow Modal");
  assert.notEqual(modalStart, -1);
  const modalBlock = source.slice(modalStart);

  assert.match(source, /import \{ Modal \} from "@\/components\/ui\/Modal"/);
  assert.match(modalBlock, /<Modal/);
  assert.match(sharedModal, /dark:border-neutral-700/);
  assert.match(sharedModal, /dark:bg-neutral-900/);
  assert.match(modalBlock, /dark:shadow-black\/40/);
  assert.match(modalBlock, /dark:bg-primary\/20/);
  assert.match(modalBlock, /dark:text-primary-300/);
  assert.match(sharedModal, /dark:text-neutral-100/);
  assert.match(sharedModal, /dark:text-neutral-400/);
  assert.match(modalBlock, /dark:border-red-800/);
  assert.match(modalBlock, /dark:bg-red-950\/50/);
  assert.match(modalBlock, /dark:text-red-200/);
  assert.match(modalBlock, /dark:text-neutral-200/);
  assert.match(modalBlock, /dark:text-neutral-300/);
});

test("risk workflow action modal uses shared accessible modal behavior", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/[id]/page.tsx"), "utf8");
  const sharedModal = readFileSync(join(webRoot, "components/ui/Modal.tsx"), "utf8");
  const modalStart = source.indexOf("Workflow Modal");
  assert.notEqual(modalStart, -1);
  const modalBlock = source.slice(modalStart);

  assert.match(source, /import \{ Modal \} from "@\/components\/ui\/Modal"/);
  assert.match(modalBlock, /<Modal/);
  assert.match(modalBlock, /onClose=\{closeWorkflowModal\}/);
  assert.doesNotMatch(modalBlock, /fixed inset-0 z-50 flex items-center justify-center/);
  assert.match(sharedModal, /role="dialog"/);
  assert.match(sharedModal, /aria-modal="true"/);
  assert.match(sharedModal, /aria-labelledby=\{titleId\}/);
  assert.match(sharedModal, /event\.key === "Escape"/);
  assert.match(sharedModal, /event\.key !== "Tab"/);
  assert.match(sharedModal, /getFocusableElements/);
  assert.match(sharedModal, /previousFocusRef/);
});

test("organogram unit modal uses shared accessible modal and bound labels", () => {
  const source = readFileSync(join(webRoot, "app/(app)/organogram/page.tsx"), "utf8");
  const sharedModal = readFileSync(join(webRoot, "components/ui/Modal.tsx"), "utf8");
  const modalStart = source.indexOf("CRUD Modal");
  assert.notEqual(modalStart, -1);
  const modalBlock = source.slice(modalStart);

  assert.match(source, /import \{ Modal \} from "@\/components\/ui\/Modal"/);
  assert.match(modalBlock, /<Modal/);
  assert.match(modalBlock, /onClose=\{closeCrudModal\}/);
  assert.doesNotMatch(modalBlock, /fixed inset-0 bg-black\/40/);
  assert.match(modalBlock, /htmlFor="organogram-unit-name"/);
  assert.match(modalBlock, /id="organogram-unit-name"/);
  assert.match(modalBlock, /htmlFor="organogram-unit-code"/);
  assert.match(modalBlock, /id="organogram-unit-code"/);
  assert.match(modalBlock, /htmlFor="organogram-unit-supervisor"/);
  assert.match(modalBlock, /id="organogram-unit-supervisor"/);
  assert.match(modalBlock, /htmlFor="organogram-parent-unit"/);
  assert.match(modalBlock, /id="organogram-parent-unit"/);
  assert.match(sharedModal, /role="dialog"/);
  assert.match(sharedModal, /aria-modal="true"/);
  assert.match(sharedModal, /event\.key === "Escape"/);
  assert.match(sharedModal, /event\.key !== "Tab"/);
  assert.match(sharedModal, /getFocusableElements/);
  assert.match(sharedModal, /previousFocusRef/);
});

test("organogram icon controls have accessible names", () => {
  const source = readFileSync(join(webRoot, "app/(app)/organogram/page.tsx"), "utf8");

  assert.match(source, /aria-label="Zoom in"/);
  assert.match(source, /title="Zoom in"/);
  assert.match(source, /aria-label="Zoom out"/);
  assert.match(source, /title="Zoom out"/);
  assert.match(source, /aria-label="Reset organogram view"/);
  assert.match(source, /title="Reset organogram view"/);
  assert.match(source, /aria-label="Dismiss organogram error"/);
  assert.match(source, /title="Dismiss organogram error"/);
  assert.match(source, /aria-label="Refresh organogram history"/);
  assert.match(source, /title="Refresh organogram history"/);
  assert.match(source, /aria-label="Close organogram history"/);
  assert.match(source, /title="Close organogram history"/);
});

test("global search exposes combobox and active result semantics", () => {
  const source = readFileSync(join(webRoot, "components/layout/GlobalSearch.tsx"), "utf8");

  assert.match(source, /const searchListboxId = "global-search-results"/);
  assert.match(source, /const activeResultId = activeResult \? `global-search-option-\$\{activeResult\.id\}` : undefined/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-controls=\{flatResults\.length > 0 \? searchListboxId : undefined\}/);
  assert.match(source, /aria-haspopup="listbox"/);
  assert.match(source, /aria-autocomplete="list"/);
  assert.match(source, /aria-activedescendant=\{activeResultId\}/);
  assert.match(source, /id=\{searchListboxId\} role="listbox"/);
  assert.match(source, /id=\{`global-search-option-\$\{r\.id\}`\}/);
  assert.match(source, /role="option"/);
  assert.match(source, /aria-selected=\{isActive\}/);
});

test("sidebar expandable nav sections expose expanded state", () => {
  const source = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");

  assert.match(source, /const childGroupId = `sidebar-section-\$\{item\.href/);
  assert.match(source, /aria-expanded=\{isExpanded\}/);
  assert.match(source, /aria-controls=\{childGroupId\}/);
  assert.match(source, /aria-label=\{`\$\{navLabel\(item\)\} navigation section`\}/);
  assert.match(source, /id=\{childGroupId\} role="group"/);
  assert.match(source, /aria-label=\{`\$\{navLabel\(item\)\} links`\}/);
});

test("budget cycle detail content surfaces support dark mode", () => {
  const source = readFileSync(join(webRoot, "app/(app)/budget/cycles/[id]/page.tsx"), "utf8");

  const bgWhiteCount = source.match(/bg-white/g)?.length ?? 0;
  const darkSurfaceCount = source.match(/dark:bg-neutral-900/g)?.length ?? 0;
  assert.equal(darkSurfaceCount, bgWhiteCount);

  assert.match(source, /dark:border-neutral-700/);
  assert.match(source, /dark:bg-neutral-950/);
  assert.match(source, /dark:bg-neutral-950\/60/);
  assert.match(source, /dark:text-neutral-100/);
  assert.match(source, /dark:text-neutral-200/);
  assert.match(source, /dark:text-neutral-300/);
  assert.match(source, /dark:text-neutral-400/);
  assert.match(source, /dark:placeholder-neutral-500/);
  assert.match(source, /dark:border-emerald-800/);
  assert.match(source, /dark:bg-emerald-950\/50/);
  assert.match(source, /dark:border-red-800/);
  assert.match(source, /dark:bg-red-950\/50/);
  assert.match(source, /dark:border-neutral-800/);
});

test("risk create form binds visible labels to controls and labels choice groups", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/create/page.tsx"), "utf8");
  const labels = source.match(/<label\b/g)?.length ?? 0;
  const boundLabels = [...source.matchAll(/<label\b[^>]*htmlFor="([^"]+)"/g)];

  assert.equal(boundLabels.length, labels);
  assert.doesNotMatch(source, /<label className=/);

  for (const [, id] of boundLabels) {
    assert.match(source, new RegExp(`\\bid="${id}"`));
  }

  for (const id of ["risk-category-label", "risk-likelihood-label", "risk-impact-label"]) {
    assert.match(source, new RegExp(`<legend id="${id}"`));
    assert.match(source, new RegExp(`role="radiogroup" aria-labelledby="${id}"`));
  }

  assert.match(source, /role="radio"\s+aria-checked=\{form\.category === c\.value\}/);
  assert.match(source, /role="radio"\s+aria-checked=\{form\.likelihood === l\.value\}/);
  assert.match(source, /role="radio"\s+aria-checked=\{form\.impact === im\.value\}/);
});

test("travel create date inputs expose field-level bounds", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/create/page.tsx"), "utf8");

  assert.match(source, /const todayIso = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(source, /min=\{todayIso\}/);
  assert.match(source, /min=\{form\.departure_date \|\| todayIso\}/);
});

test("asset insurance policy and claim forms have bound labels and non-negative money fields", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/insurance/page.tsx"), "utf8");

  for (const id of [
    "policy-number",
    "policy-insurer",
    "policy-coverage-type",
    "policy-effective-from",
    "policy-effective-to",
    "policy-sum-insured",
    "claim-policy",
    "claim-number",
    "claim-incident-date",
    "claim-amount",
    "claim-description",
  ]) {
    assert.match(source, new RegExp(`htmlFor="${id}"`));
    assert.match(source, new RegExp(`id="${id}"`));
  }

  assert.match(source, /id="policy-sum-insured"[^>]*type="number"[^>]*min=\{0\}/);
  assert.match(source, /id="claim-amount"[^>]*type="number"[^>]*min=\{0\}/);
});

test("RFQ quote entry fields have labels and quote amounts cannot be non-positive", () => {
  const source = readFileSync(join(webRoot, "app/(app)/procurement/rfq/[id]/page.tsx"), "utf8");

  for (const id of ["quote-supplier-name", "quote-amount", "quote-currency", "quote-date"]) {
    assert.match(source, new RegExp(`htmlFor="${id}"`));
    assert.match(source, new RegExp(`id="${id}"`));
  }

  assert.match(source, /id="quote-amount"[^>]*type="number"[^>]*min="0\.01"[^>]*step="0\.01"/);
});

test("salary advance exception employee field uses a selectable employee list", () => {
  const source = readFileSync(join(webRoot, "app/(app)/salary-advances/settings/page.tsx"), "utf8");

  assert.match(source, /hrFilesApi/);
  assert.match(source, /employeeOptions/);
  assert.match(source, /list="salary-advance-employee-options"/);
  assert.match(source, /<datalist id="salary-advance-employee-options">/);
  assert.doesNotMatch(source, /Employee user ID/);
  assert.doesNotMatch(source, /type="number" className="mt-1 input w-full" value=\{exceptionForm\.employee_id\}/);
});

test("audit quick-create forms have labels and explicit empty states", () => {
  const cases = [
    ["app/(app)/audit/plans/page.tsx", "audit-plan-title", "No audit plans yet."],
    ["app/(app)/audit/engagements/page.tsx", "audit-engagement-title", "No audit engagements yet."],
    ["app/(app)/audit/external/page.tsx", "audit-external-title", "No external audit engagements yet."],
    ["app/(app)/audit/universe/page.tsx", "audit-universe-name", "No audit universe entities yet."],
  ] as const;

  for (const [path, id, emptyText] of cases) {
    const source = readFileSync(join(webRoot, path), "utf8");
    assert.match(source, new RegExp(`htmlFor="${id}"`));
    assert.match(source, new RegExp(`id="${id}"`));
    assert.match(source, new RegExp(emptyText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("monthly timesheet chevrons and global search clear control have accessible names", () => {
  const monthly = readFileSync(join(webRoot, "app/(app)/hr/timesheets/monthly/page.tsx"), "utf8");
  const search = readFileSync(join(webRoot, "components/layout/GlobalSearch.tsx"), "utf8");

  assert.match(monthly, /aria-label="Previous month"/);
  assert.match(monthly, /aria-label="Next month"/);
  assert.match(search, /aria-label="Clear search query"/);
  assert.match(search, /focus-visible:ring-2/);
  assert.match(search, /focus-visible:ring-primary\/40/);
});

test("risk detail tabs expose tablist and selected tab semantics", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/[id]/page.tsx"), "utf8");

  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-label="Risk detail sections"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=\{activeTab === tab\}/);
  assert.match(source, /aria-controls=\{tab === "details" \? undefined : `risk-panel-\$\{tab\}`\}/);
  assert.match(source, /id="risk-panel-documents" role="tabpanel"/);
  assert.match(source, /id="risk-panel-policies" role="tabpanel"/);
});

test("BCP, capacity, and team timesheet cited white surfaces have dark-mode counterparts", () => {
  for (const path of [
    "app/(app)/risk/bcp/page.tsx",
    "app/(app)/assignments/capacity/page.tsx",
    "app/(app)/hr/timesheets/team/page.tsx",
  ]) {
    const source = readFileSync(join(webRoot, path), "utf8");
    const uncovered = source
      .split("\n")
      .filter((line) => line.includes("bg-white") && !line.includes("dark:"));
    assert.deepEqual(uncovered, []);
  }
});

test("cited close and delete icon buttons expose accessible names", () => {
  const expectations = [
    ["app/(app)/governance/resolutions/page.tsx", [
      "Close resolution form",
      "Remove queued document",
      "Delete resolution",
      "Close resolution details",
      "Close committee manager",
      "Close meeting type manager",
      "Close meeting form",
      "Close meeting details",
      "Close assignment dialog",
      "Delete action item",
    ]],
    ["app/(app)/settings/hr/approval-matrix/page.tsx", ["Close approval matrix dialog"]],
    ["app/(app)/settings/hr/allowance-profiles/page.tsx", ["Close allowance profile editor"]],
    ["app/(app)/settings/hr/appraisal-templates/page.tsx", ["Close appraisal template editor"]],
    ["app/(app)/settings/hr/contract-types/page.tsx", ["Close contract type editor"]],
    ["app/(app)/settings/hr/grade-bands/GradeBandSlideOver.tsx", ["Close grade band editor"]],
    ["app/(app)/settings/hr/job-families/page.tsx", ["Close job family editor"]],
    ["app/(app)/settings/hr/leave-profiles/page.tsx", ["Close leave profile editor"]],
    ["app/(app)/settings/hr/personnel-file-sections/page.tsx", ["Close file section editor"]],
    ["app/(app)/settings/hr/salary-scales/SalaryScaleSlideOver.tsx", ["Close salary scale editor"]],
    ["app/(app)/procurement/vendors/[id]/page.tsx", ["Close vendor edit dialog"]],
    ["app/(app)/hr/timesheets/team/page.tsx", ["Dismiss notification"]],
    ["app/(app)/hr/timesheets/monthly/page.tsx", ["Previous month", "Next month"]],
  ] as const;

  for (const [path, labels] of expectations) {
    const source = readFileSync(join(webRoot, path), "utf8");
    for (const label of labels) {
      assert.match(source, new RegExp(`aria-label="${label}"`));
    }
  }
});

test("vendor register uses server pagination params", () => {
  const source = readFileSync(join(webRoot, "app/(app)/procurement/vendors/page.tsx"), "utf8");
  assert.match(source, /per_page:\s*DEFAULT_PAGE_SIZE/);
  assert.match(source, /getLastPage\(payload\)/);
  assert.doesNotMatch(source, /slicePage\(/);
});

test("session timeout preference is wired to the profile API", () => {
  const source = readFileSync(join(webRoot, "app/(app)/profile/security/page.tsx"), "utf8");
  assert.match(source, /updateIdleTimeout/);
  assert.doesNotMatch(source, /Coming soon/);
});

test("AppShell mounts IdleTimeoutGuard", () => {
  const source = readFileSync(join(webRoot, "components/layout/AppShell.tsx"), "utf8");
  assert.match(source, /IdleTimeoutGuard/);
});

test("UX-196 asset transfers CTA uses Next Link", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/transfers/page.tsx"), "utf8");
  assert.match(source, /<Link href="\/assets\/movement\/new"/);
  assert.doesNotMatch(source, /<a href="\/assets\/movement\/new"/);
});

test("UX-208 stock register title does not use slash style", () => {
  const source = readFileSync(join(webRoot, "app/(app)/stock/page.tsx"), "utf8");
  assert.doesNotMatch(source, /Consumables \/ Stock/);
  assert.match(source, /title="Stock"/);
});

test("UX-212 and UX-344 login demo tiles use brand tokens and dark variants", () => {
  const source = readFileSync(join(webRoot, "app/(auth)/login/page.tsx"), "utf8");
  assert.doesNotMatch(source, /text-purple-600 bg-purple-50/);
  assert.match(source, /dark:bg-/);
  assert.match(source, /text-primary/);
});

test("UX-282 balance-register verify uses Next Link for supporting documents", () => {
  const source = readFileSync(join(webRoot, "app/(app)/finance/balance-register/[id]/verify/page.tsx"), "utf8");
  assert.match(source, /<Link href=\{txn\.supporting_document_path\}/);
  assert.doesNotMatch(source, /<a href=\{txn\.supporting_document_path\}/);
});

test("UX-313 GlobalSearch Admin category is not purple", () => {
  const source = readFileSync(join(webRoot, "components/layout/GlobalSearch.tsx"), "utf8");
  assert.doesNotMatch(source, /Admin:\s*"text-purple-600"/);
  assert.match(source, /Admin:\s*"text-primary"/);
});

test("UX-323 and UX-325 organogram connectors are labelled and theme-aware", () => {
  const source = readFileSync(join(webRoot, "app/(app)/organogram/page.tsx"), "utf8");
  assert.match(source, /aria-hidden="true"|<title>/);
  assert.doesNotMatch(source, /fill="#cbd5e1"/);
  assert.doesNotMatch(source, /stroke="#cbd5e1"/);
  assert.match(source, /currentColor|var\(--/);
});

test("UX-326 workplan milestone palette is not hardcoded purple hex", () => {
  const source = readFileSync(join(webRoot, "app/(app)/workplan/page.tsx"), "utf8");
  assert.doesNotMatch(source, /bar: "#8b5cf6"/);
  const detail = readFileSync(join(webRoot, "app/(app)/workplan/[id]/page.tsx"), "utf8");
  assert.doesNotMatch(detail, /bg-purple-100 text-purple-700/);
});

test("UX-337 fleet tables use data-table", () => {
  const fleet = readFileSync(join(webRoot, "app/(app)/fleet/page.tsx"), "utf8");
  const utilisation = readFileSync(join(webRoot, "app/(app)/fleet/utilisation/page.tsx"), "utf8");
  assert.match(fleet, /className="data-table"/);
  assert.match(utilisation, /className="data-table"/);
});

test("UX-349 access review create shows required-name error text", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/access/reviews/page.tsx"), "utf8");
  assert.match(source, /error=\{/);
  assert.match(source, /Campaign name is required/);
});

test("UX-355 fleet driver create uses a user picker not a raw id input", () => {
  const source = readFileSync(join(webRoot, "app/(app)/fleet/page.tsx"), "utf8");
  assert.match(source, /adminApi\.listUsers|listUsers\(/);
  assert.match(source, /<select/);
  assert.doesNotMatch(source, /<span className="text-sm font-medium">User ID<\/span>/);
});

test("UX-356 Header procurement icon is not purple", () => {
  const source = readFileSync(join(webRoot, "components/layout/Header.tsx"), "utf8");
  assert.doesNotMatch(source, /procurement:[\s\S]{0,80}text-purple-600/);
});

test("UX-362 risk compliance category is not purple", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/page.tsx"), "utf8");
  assert.doesNotMatch(source, /compliance:[\s\S]{0,80}text-purple-600/);
});

test("UX-077 leave LIL block is not purple", () => {
  const source = readFileSync(join(webRoot, "app/(app)/leave/[id]/page.tsx"), "utf8");
  assert.doesNotMatch(source, /LIL Accrual[\s\S]{0,400}text-purple-600/);
});

test("UX-109 dashboard open requisitions KPI is not purple", () => {
  const source = readFileSync(join(webRoot, "app/dashboard/page.tsx"), "utf8");
  assert.doesNotMatch(source, /open_requisitions[\s\S]{0,120}text-purple-600/);
});

test("UX-333 risk history icon is not purple", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/[id]/page.tsx"), "utf8");
  assert.doesNotMatch(source, /SectionIcon icon="history" color="text-purple-600"/);
});

test("UX-351 assets keep institutional EN-GB Capitalise", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/page.tsx"), "utf8");
  assert.match(source, /Capitalise/);
  assert.doesNotMatch(source, /Capitalize/);
});

test("UX-061 stacked btn btn-primary alias is unused", () => {
  const css = readFileSync(join(webRoot, "app/globals.css"), "utf8");
  assert.doesNotMatch(css, /\.btn\.btn-primary/);
  assert.doesNotMatch(css, /\.btn\.btn-secondary/);
});

test("UX-231 procurement services category is not purple", () => {
  const register = readFileSync(join(webRoot, "app/(app)/procurement/page.tsx"), "utf8");
  const detail = readFileSync(join(webRoot, "app/(app)/procurement/[id]/page.tsx"), "utf8");
  const vendor = readFileSync(join(webRoot, "app/(app)/procurement/vendors/[id]/page.tsx"), "utf8");
  assert.doesNotMatch(register, /services:[\s\S]{0,120}text-purple/);
  assert.doesNotMatch(detail, /services:[\s\S]{0,80}text-purple/);
  assert.doesNotMatch(vendor, /services:[\s\S]{0,80}text-purple/);
});

test("UX-316 risk analytics category map is not purple or pink", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/analytics/page.tsx"), "utf8");
  assert.doesNotMatch(source, /compliance:\s*"text-purple/);
  assert.doesNotMatch(source, /reputational:\s*"text-pink/);
});

test("UX-076 cited widget accents are not purple", () => {
  const assignments = readFileSync(join(webRoot, "app/(app)/assignments/page.tsx"), "utf8");
  const dashboard = readFileSync(join(webRoot, "app/dashboard/page.tsx"), "utf8");
  const finance = readFileSync(join(webRoot, "app/(app)/finance/page.tsx"), "utf8");
  const riskDash = readFileSync(join(webRoot, "app/(app)/risk/dashboard/page.tsx"), "utf8");
  assert.doesNotMatch(assignments, /Awaiting Acceptance[\s\S]{0,80}text-purple/);
  assert.doesNotMatch(dashboard, /label="Awaiting"[\s\S]{0,80}text-purple/);
  assert.doesNotMatch(finance, /Imprest Requests[\s\S]{0,200}text-purple/);
  assert.doesNotMatch(riskDash, /sg:[\s\S]{0,80}text-purple/);
});

test("UX-292 audit hub shortcuts use icon tiles not underlined links", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/page.tsx"), "utf8");
  const hubCards = readFileSync(join(webRoot, "components/ui/ModuleHubCards.tsx"), "utf8");
  assert.match(source, /ModuleHubCards/);
  assert.match(hubCards, /material-symbols-outlined/);
  assert.doesNotMatch(source, /<Link className="underline"/);
});

test("UX-108 dashboard module grid covers core sidebar modules", () => {
  const source = readFileSync(join(webRoot, "app/dashboard/page.tsx"), "utf8");
  for (const href of ["/stock", "/assets", "/fleet", "/people", "/audit", "/risk", "/workplan", "/assignments", "/correspondence", "/governance", "/reports"]) {
    assert.match(source, new RegExp(`href: "${href}"`));
  }
});

test("UX-102 HR leave uses shared date preference formatter", () => {
  const source = readFileSync(join(webRoot, "app/(app)/hr/leave/page.tsx"), "utf8");
  assert.match(source, /useFormatDate/);
  assert.doesNotMatch(source, /toLocaleDateString\("en-GB"/);
});

test("UX-262 fleet utilisation exports CSV", () => {
  const source = readFileSync(join(webRoot, "app/(app)/fleet/utilisation/page.tsx"), "utf8");
  assert.match(source, /exportToCsv/);
});

test("UX-353 correspondence retention exports CSV", () => {
  const source = readFileSync(join(webRoot, "app/(app)/correspondence/retention/page.tsx"), "utf8");
  assert.match(source, /exportToCsv/);
  assert.match(source, /Saving…/);
  assert.doesNotMatch(source, /Saving\.\.\./);
});

test("UX-354 stock register syncs filters to the URL", () => {
  const source = readFileSync(join(webRoot, "app/(app)/stock/page.tsx"), "utf8");
  assert.match(source, /useSearchParams/);
  assert.match(source, /params\.set\("q"/);
});

test("UX-203 asset disposal create uses FormSection", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/disposal/page.tsx"), "utf8");
  assert.match(source, /FormSection/);
  assert.match(source, /FormField/);
});

test("UX-211 sidebar scrollbar is visible", () => {
  const css = readFileSync(join(webRoot, "app/globals.css"), "utf8");
  const start = css.indexOf(".sidebar-nav,");
  assert.notEqual(start, -1);
  const block = css.slice(start, start + 450);
  assert.match(block, /scrollbar-width:\s*thin/);
  assert.doesNotMatch(block, /scrollbar-width:\s*none/);
});

test("UX-276 stock submodules use ModulePageHeader", () => {
  for (const rel of ["categories", "low-stock", "movements", "reports", "scan"]) {
    const source = readFileSync(join(webRoot, `app/(app)/stock/${rel}/page.tsx`), "utf8");
    assert.match(source, /ModulePageHeader/, `missing header on stock/${rel}`);
  }
});

test("UX-074 LIL chrome uses Leave in Lieu wording", () => {
  const leave = readFileSync(join(webRoot, "app/(app)/leave/page.tsx"), "utf8");
  const detail = readFileSync(join(webRoot, "app/(app)/leave/[id]/page.tsx"), "utf8");
  const balances = readFileSync(join(webRoot, "app/(app)/hr/leave/balances/page.tsx"), "utf8");
  assert.match(leave, /Leave in Lieu/);
  assert.doesNotMatch(leave, /LIL linkings/);
  assert.match(detail, /Leave in Lieu Accrual Linkings/);
  assert.match(balances, /Leave in Lieu Used \/ Avail/);
});

test("UX-317 access requests register shows business reason", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/access/requests/page.tsx"), "utf8");
  assert.match(source, /<th>Reason<\/th>/);
  assert.match(source, /r\.business_reason/);
});
