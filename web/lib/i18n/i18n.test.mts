import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOCALES,
  catalogKeys,
  catalogFor,
  interpolate,
  localeBcp47,
  translate,
} from "./messages.ts";

const webRoot = join(process.cwd());

test("EN, FR and PT catalogs expose the same keys", () => {
  const keys = catalogKeys();
  assert.ok(keys.length > 80, `expected a full UI catalog, got ${keys.length} keys`);
  for (const locale of LOCALES) {
    const table = catalogFor(locale);
    const missing = keys.filter((key) => !(key in table) || String(table[key]).trim() === "");
    assert.deepEqual(missing, [], `${locale} is missing translations`);
  }
});

test("interpolate replaces named placeholders", () => {
  assert.equal(interpolate("Page {page} of {total}", { page: 2, total: 5 }), "Page 2 of 5");
  assert.equal(
    translate("fr", "common.pageOf", { page: 2, total: 5 }),
    catalogFor("fr")["common.pageOf"]?.replace("{page}", "2").replace("{total}", "5"),
  );
  assert.match(translate("fr", "common.pageOf", { page: 2, total: 5 }), /2/);
  assert.match(translate("pt", "common.pageOf", { page: 2, total: 5 }), /2/);
});

test("core chrome strings differ in French and Portuguese", () => {
  const samples = [
    "nav.dashboard",
    "nav.signOut",
    "common.save",
    "common.cancel",
    "common.search",
    "Dashboard",
    "Approvals",
    "My Work",
    "Access denied",
  ];
  for (const key of samples) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
    assert.notEqual(fr, key === "Dashboard" ? "Dashboard" : en);
  }
});

test("locale BCP 47 tags use SADC-relevant regional formats", () => {
  assert.equal(localeBcp47("en"), "en-GB");
  assert.equal(localeBcp47("fr"), "fr-FR");
  assert.equal(localeBcp47("pt"), "pt-PT");
});

test("every sidebar label and section is in the catalog", () => {
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const labels = [...sidebar.matchAll(/\b(?:label|section):\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(labels.length > 40, "expected sidebar labels");
  const keys = new Set(catalogKeys());
  const missing = [...new Set(labels)].filter((label) => !keys.has(label));
  assert.deepEqual(missing, [], "sidebar labels missing from i18n catalog");
});

test("shared chrome components translate user-facing copy", () => {
  const files = [
    "components/ui/ModulePageHeader.tsx",
    "components/registers/RegisterShell.tsx",
    "components/ui/FormSection.tsx",
    "components/ui/EmptyState.tsx",
    "components/ui/AccessDenied.tsx",
    "components/ui/ModuleHubCards.tsx",
    "components/ui/ListPagination.tsx",
    "components/ui/AppShellLoading.tsx",
    "components/layout/Header.tsx",
    "components/layout/Sidebar.tsx",
    "components/layout/GlobalSearch.tsx",
    "app/dashboard/page.tsx",
    "app/(app)/assets/import/page.tsx",
    "components/assets/ClearAssetRegisterButton.tsx",
    "app/(app)/assets/page.tsx",
    "app/(app)/assets/labels/page.tsx",
    "app/(app)/assets/labels/templates/page.tsx",
    "components/assets/LabelTemplateVisualEditor.tsx",
    "app/(app)/assets/verification/page.tsx",
    "app/(app)/assets/mine/page.tsx",
    "app/(app)/assets/batches/page.tsx",
    "app/(app)/assets/handovers/page.tsx",
    "app/(app)/assets/handovers/[id]/page.tsx",
    "app/(app)/assets/handovers/new/page.tsx",
    "app/(app)/assets/dashboard/page.tsx",
    "app/(app)/assets/scan/page.tsx",
    "app/(app)/assets/kits/page.tsx",
    "app/(app)/assets/operations/page.tsx",
    "app/(app)/assets/[id]/page.tsx",
    "app/(app)/audit/engagements/page.tsx",
    "components/audit/AuditChrome.tsx",
    "app/(app)/risk/create/page.tsx",
    "app/(app)/hr/page.tsx",
    "app/(app)/hr/leave/page.tsx",
    "app/(app)/hr/leave/balances/page.tsx",
    "app/(app)/hr/leave/import/page.tsx",
    "app/(app)/risk/dashboard/page.tsx",
    "app/(app)/supplier/page.tsx",
    "app/(app)/supplier/documents/page.tsx",
    "app/(app)/supplier/profile/page.tsx",
    "app/(app)/admin/documents/page.tsx",
    "app/(app)/admin/documents/retention/page.tsx",
    "app/(app)/admin/documents/governance/page.tsx",
    "app/(app)/admin/workflows/simulate/page.tsx",
    "app/(app)/admin/operations/page.tsx",
    "app/a/[token]/page.tsx",
  ];
  for (const rel of files) {
    const source = readFileSync(join(webRoot, rel), "utf8");
    assert.match(source, /useI18n/, `${rel} should call useI18n`);
  }
});

test("label template editor is a live drag canvas", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/labels/templates/page.tsx"), "utf8");
  const editor = readFileSync(join(webRoot, "components/assets/LabelTemplateVisualEditor.tsx"), "utf8");
  assert.match(page, /LabelTemplateVisualEditor/);
  assert.match(page, /PAGE_PRESETS/);
  assert.match(editor, /onPointerDown/);
  assert.match(editor, /assets\.labels\.pagePreview/);
  assert.match(editor, /assets\.labels\.dragHint/);
});

test("asset labels print table can select all visible rows", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/labels/page.tsx"), "utf8");
  assert.match(page, /SelectAllCheckbox/);
  assert.match(page, /useRowSelection/);
  assert.match(page, /assets\.labels\.selectAll/);
  assert.match(page, /toggleAllSelectable/);
});

test("label template save stays visible and reports validation errors", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/labels/templates/page.tsx"), "utf8");
  assert.match(page, /toTemplateSavePayload/);
  assert.match(page, /assets\.labels\.nameRequired/);
  assert.match(page, /sticky/);
  assert.doesNotMatch(page, /if \(!form\.name\.trim\(\) \|\| !form\.code\.trim\(\)\) return;/);
});

test("API client sends Accept-Language from the stored locale", () => {
  const source = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(source, /Accept-Language/);
  assert.match(source, /readStoredLocale/);
});

test("asset register clear catalog covers EN, FR and PT", () => {
  const keys = [
    "assets.register.clear",
    "assets.register.clearConfirmTitle",
    "assets.register.clearConfirmMessage",
    "assets.register.clearConfirmLabel",
    "assets.register.clearWrongPhrase",
    "assets.register.clearSuccess",
    "assets.register.clearFailed",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("asset import review table uses translated column headers", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/import/page.tsx"), "utf8");
  assert.match(source, /assets\.import\.colTag/);
  assert.doesNotMatch(source, /<th>Tag<\/th>/);
  assert.match(source, /assets\.import\.mapLocation/);
  assert.match(source, /assets\.import\.mapCustodian/);
  assert.match(source, /filterAll/);
});

test("audit module catalog covers register chrome in EN, FR and PT", () => {
  const keys = [
    "audit.hub",
    "audit.engagements.title",
    "audit.engagements.empty",
    "audit.findings.title",
    "audit.settings.title",
    "audit.ai.neverCloses",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("risk create catalog covers form copy in EN, FR and PT", () => {
  const keys = [
    "risk.hub",
    "risk.create.title",
    "risk.create.subtitle",
    "risk.create.submit",
    "risk.create.saveDraft",
    "risk.create.objective",
    "risk.create.owner",
    "risk.create.category.strategic",
    "risk.create.likelihood.1",
    "risk.create.impact.5",
    "risk.create.objectiveRequired",
    "risk.create.ownerRequired",
    "risk.create.ownerEmpty",
    "risk.create.section.mitigation",
    "risk.mitigation.apply",
    "risk.mitigation.applySelected",
    "risk.dashboard.title",
    "risk.incidents.title",
    "risk.controls.title",
    "hr.hub",
    "hr.subtitle",
    "hr.timesheets.recent",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("asset phase 2 operations catalog covers kits planner and attestation copy in EN, FR and PT", () => {
  const keys = [
    "assets.kits.title",
    "assets.kits.create",
    "assets.ops.title",
    "assets.ops.plannerHint",
    "assets.ops.attestHint",
    "assets.handover.delegate",
    "assets.handover.paperSign",
    "assets.scan.basket",
    "assets.parent.none",
    "assets.ops.roomToken",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("remaining labelled pickers catalog covers simulator designer and leftover id fields in EN, FR and PT", () => {
  const keys = [
    "pickers.none",
    "admin.simulator.user",
    "admin.designer.role",
    "admin.designer.user",
    "travel.proc.select",
    "budget.journal.line",
    "correspondence.retention.letter",
    "salary.exception.employee",
    "audit.forensics.event",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("remaining labelled pickers replace raw numeric ids", () => {
  const simulator = readFileSync(join(webRoot, "app/(app)/admin/access/simulator/page.tsx"), "utf8");
  const designer = readFileSync(join(webRoot, "app/(app)/admin/workflows/designer/page.tsx"), "utf8");
  const travel = readFileSync(join(webRoot, "app/(app)/travel/[id]/page.tsx"), "utf8");
  const budget = readFileSync(join(webRoot, "app/(app)/budget/page.tsx"), "utf8");
  const retention = readFileSync(join(webRoot, "app/(app)/correspondence/retention/page.tsx"), "utf8");
  const salary = readFileSync(join(webRoot, "app/(app)/salary-advances/settings/page.tsx"), "utf8");
  const forensics = readFileSync(join(webRoot, "app/(app)/admin/audit-trail/forensics/page.tsx"), "utf8");
  assert.match(simulator, /data-testid="sim-user-select"/);
  assert.doesNotMatch(simulator, /label="User ID"/);
  assert.match(designer, /data-testid=\{`wf-stage-role-\$\{index\}`\}/);
  assert.match(designer, /data-testid=\{`wf-stage-user-\$\{index\}`\}/);
  assert.doesNotMatch(designer, /placeholder="Role ID"/);
  assert.doesNotMatch(designer, /placeholder="User ID"/);
  assert.match(travel, /data-testid="travel-proc-id"/);
  assert.doesNotMatch(travel, /placeholder="e\.g\. 42"/);
  assert.match(budget, /data-testid="budget-journal-line"/);
  assert.doesNotMatch(budget, /placeholder="Budget line ID"/);
  assert.match(retention, /data-testid="retention-letter-select"/);
  assert.doesNotMatch(retention, /placeholder="Correspondence id"/);
  assert.match(salary, /data-testid="sa-exception-employee"/);
  assert.doesNotMatch(salary, /inputMode="numeric"/);
  assert.match(forensics, /data-testid="forensics-event-select"/);
  assert.doesNotMatch(forensics, /placeholder="Audit event ID"/);
});

test("risk KRI BCP and control-testing catalog covers labelled pickers in EN, FR and PT", () => {
  const keys = [
    "risk.kri.none",
    "risk.kri.linkRisk",
    "risk.kri.linkObjective",
    "risk.bcp.risk",
    "risk.bcp.policy",
    "risk.bcp.riskA",
    "risk.bcp.riskB",
    "risk.testing.controls",
    "risk.testing.none",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("risk KRI BCP and control-testing use labelled pickers instead of raw ids", () => {
  const kri = readFileSync(join(webRoot, "app/(app)/risk/kri/page.tsx"), "utf8");
  const bcp = readFileSync(join(webRoot, "app/(app)/risk/bcp/page.tsx"), "utf8");
  const testing = readFileSync(join(webRoot, "app/(app)/risk/control-testing/page.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.doesNotMatch(kri, /placeholder="Risk ID"/);
  assert.doesNotMatch(kri, /placeholder="Objective ID"/);
  assert.match(kri, /data-testid=\{`kri-risk-select-\$\{kri\.id\}`\}/);
  assert.match(kri, /data-testid=\{`kri-objective-select-\$\{kri\.id\}`\}/);
  assert.match(kri, /riskApi\.list\(/);
  assert.match(kri, /listObjectives/);
  assert.doesNotMatch(bcp, /Asset insurance policy ID/);
  assert.doesNotMatch(bcp, />Risk ID</);
  assert.match(bcp, /data-testid="bcp-risk-select"/);
  assert.match(bcp, /data-testid="bcp-policy-select"/);
  assert.match(bcp, /data-testid="bcp-risk-a-select"/);
  assert.match(bcp, /data-testid="bcp-risk-b-select"/);
  assert.doesNotMatch(testing, /placeholder="12,15"/);
  assert.doesNotMatch(testing, /Control IDs \(comma\)/);
  assert.match(testing, /data-testid="testing-controls"/);
  assert.match(testing, /listControls/);
  assert.match(api, /listControls:/);
});

test("asset operations attest and parent link use labelled pickers", () => {
  const operations = readFileSync(join(webRoot, "app/(app)/assets/operations/page.tsx"), "utf8");
  const profile = readFileSync(join(webRoot, "app/(app)/assets/[id]/page.tsx"), "utf8");
  const scan = readFileSync(join(webRoot, "app/(app)/assets/scan/page.tsx"), "utf8");
  const kits = readFileSync(join(webRoot, "app/(app)/assets/kits/page.tsx"), "utf8");
  assert.doesNotMatch(operations, /placeholder="asset ids"/);
  assert.match(operations, /data-testid="ops-attest-assets"/);
  assert.match(operations, /data-testid="ops-planner-asset"/);
  assert.match(profile, /data-testid="asset-parent-select"/);
  assert.doesNotMatch(profile, /inputMode="numeric"/);
  assert.match(scan, /data-testid="scan-basket"/);
  assert.match(kits, /data-testid="kit-name"/);
});

test("asset issuance handover catalog covers owner and lot copy in EN, FR and PT", () => {
  const keys = [
    "assets.handover.title",
    "assets.handover.owner",
    "assets.handover.ownerValue",
    "assets.handover.custodyHistory",
    "assets.handover.inCustodyOf",
    "assets.handover.partialHint",
    "assets.batches.title",
    "assets.dash.pendingHandovers",
    "assets.dash.unlabeled",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("asset custody handshake catalog covers mine and register copy in EN, FR and PT", () => {
  const keys = [
    "assets.mine.title",
    "assets.mine.subtitle",
    "assets.mine.accept",
    "assets.mine.decline",
    "assets.mine.requestReturn",
    "assets.mine.pendingAcceptance",
    "assets.register.confirmReturn",
    "assets.register.pendingReturn",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("supplier documents catalog covers register copy in EN, FR and PT", () => {
  const keys = [
    "supplier.documents.title",
    "supplier.documents.subtitle",
    "supplier.documents.needed",
    "supplier.documents.pending",
    "supplier.documents.approved",
    "supplier.documents.manage",
    "supplier.documents.remarks",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("supplier dashboard catalog covers status copy in EN, FR and PT", () => {
  const keys = [
    "supplier.dashboard.subtitle",
    "supplier.dashboard.registration",
    "supplier.dashboard.completeness",
    "supplier.dashboard.compliance",
    "supplier.dashboard.actions",
    "supplier.dashboard.totalCount",
    "supplier.compliance.non_compliant",
    "supplier.compliance.valid",
    "supplier.compliance.expiring",
    "supplier.status.under_review",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("timesheet historical import catalog covers wizard copy in EN, FR and PT", () => {
  const keys = [
    "timesheet.import.title",
    "timesheet.import.subtitle",
    "timesheet.import.template",
    "timesheet.import.confirm",
    "timesheet.import.origin.verified",
    "timesheet.import.origin.approved",
    "timesheet.import.adminTitle",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});

test("language switcher remains available without logout", () => {
  const header = readFileSync(join(webRoot, "components/layout/Header.tsx"), "utf8");
  const login = readFileSync(join(webRoot, "app/(auth)/login/page.tsx"), "utf8");
  const provider = readFileSync(join(webRoot, "lib/i18n/LocaleProvider.tsx"), "utf8");
  const messages = readFileSync(join(webRoot, "lib/i18n/messages.ts"), "utf8");
  assert.match(header, /LocaleIconSwitcher/);
  assert.match(login, /LocaleSwitcher/);
  assert.match(messages, /sadcpf_locale/);
  assert.match(provider, /setLocale/);
  assert.doesNotMatch(provider, /\blogout\b/);
});
