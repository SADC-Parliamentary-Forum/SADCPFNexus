import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("stocktake detail applies the browser offline queue from localStorage", () => {
  const source = readFileSync(join(webRoot, "app/(app)/stock/stocktakes/[id]/page.tsx"), "utf8");
  assert.match(source, /sadcpf\.stocktake\.offlineQueue/);
  assert.match(source, /Apply browser queue/);
  assert.match(source, /client_line_key/);
});

test("scan page points operators at apply-from-stocktake, not a paste-only path", () => {
  const source = readFileSync(join(webRoot, "app/(app)/stock/scan/page.tsx"), "utf8");
  assert.match(source, /Apply browser queue/);
});

test("recurring assignments page creates templates in-app", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/recurring/page.tsx"), "utf8");
  assert.match(source, /createTemplate/);
  assert.match(source, /recurrence_rule/);
  assert.doesNotMatch(source, /POST \/assignments\/templates/);
});

test("assignment detail wires the dependency graph API", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/[id]/page.tsx"), "utf8");
  assert.match(source, /assignmentsApi\.dependencies/);
  assert.match(source, /addDependency/);
  assert.match(source, /removeDependency/);
  assert.match(source, /blocked_by/);
});

test("cashflow forecast renders a period chart from live periods", () => {
  const source = readFileSync(join(webRoot, "app/(app)/budget/cashflow/page.tsx"), "utf8");
  assert.match(source, /data-testid="cashflow-period-chart"/);
  assert.match(source, /closing_balance/);
});

test("governance packs render structured tables instead of raw JSON", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/governance-packs/page.tsx"), "utf8");
  assert.match(source, /plan_progress/);
  assert.match(source, /critical_high_findings/);
  assert.doesNotMatch(source, /JSON\.stringify\(pack/);
});

test("mail merge uses labelled field inputs instead of a raw JSON textarea", () => {
  const source = readFileSync(join(webRoot, "app/(app)/correspondence/mail-merge/page.tsx"), "utf8");
  assert.match(source, /\{\{[a-z_]+\}/);
  assert.doesNotMatch(source, /Field values \(JSON\)/);
});

test("people skills page can create a catalog skill", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/skills/page.tsx"), "utf8");
  assert.match(source, /createSkill/);
  assert.doesNotMatch(source, /read-only table only/);
});

test("people succession page can create a plan", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/succession/page.tsx"), "utf8");
  assert.match(source, /createSuccession/);
});

test("people delegations page can create, approve, and revoke", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/delegations/page.tsx"), "utf8");
  assert.match(source, /createDelegation/);
  assert.match(source, /approveDelegation/);
  assert.match(source, /revokeDelegation/);
});

test("people acting page can create and approve", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/acting/page.tsx"), "utf8");
  assert.match(source, /createActing/);
  assert.match(source, /approveActing/);
});

test("people onboarding page uses createOnboarding instead of an API hint", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/onboarding/page.tsx"), "utf8");
  assert.match(source, /createOnboarding/);
  assert.doesNotMatch(source, /Use API POST/);
});

test("people offboarding page uses createOffboarding instead of an API hint", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/offboarding/page.tsx"), "utf8");
  assert.match(source, /createOffboarding/);
  assert.doesNotMatch(source, /Use API POST/);
});

test("people access reviews page uses createAccessReview instead of an API hint", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/access-reviews/page.tsx"), "utf8");
  assert.match(source, /createAccessReview/);
  assert.doesNotMatch(source, /Use API POST/);
});

test("people privilege alerts can detect and acknowledge without auto-revoke", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/privilege-alerts/page.tsx"), "utf8");
  assert.match(source, /detectPrivilegeAlerts/);
  assert.match(source, /acknowledgePrivilegeAlert/);
  assert.match(source, /never auto-revoke/i);
});

test("people recertification opens a campaign on demand, not on page load", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/recertification/page.tsx"), "utf8");
  assert.match(source, /openRecertification/);
  assert.doesNotMatch(source, /queryFn: async \(\) => \{\s*\r?\nreturn \(await peopleAuthorityApi\.openRecertification/);
});

test("people units page can create a unit", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/units/page.tsx"), "utf8");
  assert.match(source, /createUnit/);
  assert.match(source, /unit_type/);
});

test("people positions page can create a position", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/positions/page.tsx"), "utf8");
  assert.match(source, /createPosition/);
  assert.match(source, /organisational_unit_id/);
});

test("people assignments page assigns a person to a position", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/assignments/page.tsx"), "utf8");
  assert.match(source, /assignPosition/);
  assert.match(source, /assignment_type/);
  assert.doesNotMatch(source, /listPositions\(\)\)\.data/);
});

test("people job descriptions page can create a JD", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/job-descriptions/page.tsx"), "utf8");
  assert.match(source, /createJobDescription/);
  assert.match(source, /position_id/);
});

test("people authority page can create and assign authority", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/authority/page.tsx"), "utf8");
  assert.match(source, /createAuthority/);
  assert.match(source, /assignAuthority/);
});

test("people reporting page can create a reporting line", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/reporting/page.tsx"), "utf8");
  assert.match(source, /createReporting/);
  assert.match(source, /subordinate_position_id/);
});

test("people esign page can create and submit a request", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/esign/page.tsx"), "utf8");
  assert.match(source, /createEsign/);
  assert.match(source, /submitEsign/);
});

test("people scenarios page can create an org scenario", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/scenarios/page.tsx"), "utf8");
  assert.match(source, /createOrgScenario/);
});

test("people sod page can run analyseSod", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/sod/page.tsx"), "utf8");
  assert.match(source, /analyseSod/);
});

test("people m365 page can run directory sync", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/m365/page.tsx"), "utf8");
  assert.match(source, /runDirectorySync/);
});

test("people signatures page enrols and activates instead of listing me()", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/signatures/page.tsx"), "utf8");
  assert.match(source, /enrolSignature/);
  assert.match(source, /activateSignature/);
  assert.match(source, /\/saam/);
  assert.doesNotMatch(source, /peopleAuthorityApi\.me\(\)/);
});

test("people skills page can assign a skill to a person", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/skills/page.tsx"), "utf8");
  assert.match(source, /assignSkill/);
  assert.match(source, /person_id/);
});

test("document watermark stream paints bytes instead of passthrough", () => {
  const root = join(webRoot, "..");
  const service = readFileSync(
    join(root, "api/app/Modules/Documents/Services/DocumentPhase23Service.php"),
    "utf8",
  );
  const painter = readFileSync(
    join(root, "api/app/Modules/Documents/Services/DocumentWatermarkPainter.php"),
    "utf8",
  );
  assert.match(service, /DocumentWatermarkPainter/);
  assert.match(service, /X-Nexus-Watermark-Visual/);
  assert.doesNotMatch(service, /fpassthru\(\$stream\)/);
  assert.match(painter, /stampPdf/);
  assert.match(painter, /SADC-PF-NEXUS-WATERMARK|Td \(\{\$escaped\}\) Tj/);
});

test("people directory can create and update a person", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/directory/page.tsx"), "utf8");
  assert.match(source, /createPerson/);
  assert.match(source, /updatePerson/);
  assert.match(source, /first_name/);
  assert.match(source, /last_name/);
});

test("audit AI suggestion uses labelled fields instead of JSON dump", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/ai/page.tsx"), "utf8");
  assert.match(source, /LabelledRecord/);
  assert.doesNotMatch(source, /JSON\.stringify\(last\.suggestion/);
});

test("people AI nested values use labelled fields instead of JSON.stringify", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/ai/page.tsx"), "utf8");
  assert.match(source, /LabelledRecord/);
  assert.doesNotMatch(source, /JSON\.stringify\(v\)/);
});

test("travel amendment proposed_changes uses labelled diff not JSON dump", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/[id]/page.tsx"), "utf8");
  assert.match(source, /proposed_changes/);
  assert.match(source, /LabelledRecord/);
  assert.doesNotMatch(source, /JSON\.stringify\(a\.proposed_changes\)/);
});

test("risk audit trail old/new uses labelled change rows not JSON dump", () => {
  const source = readFileSync(join(webRoot, "app/(app)/risk/audit-trail/page.tsx"), "utf8");
  assert.match(source, /old_values/);
  assert.match(source, /new_values/);
  assert.match(source, /labelled-change-row|LabelledRecord/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{ old:/);
});

test("HR settings has no dead Coming Soon branch", () => {
  const source = readFileSync(join(webRoot, "app/(app)/settings/hr/page.tsx"), "utf8");
  assert.doesNotMatch(source, /Coming Soon/);
  assert.doesNotMatch(source, /item\.available/);
  assert.match(source, /href: "\/settings\/hr\/grade-bands"/);
});

test("mobile weekly summary has donor and template fields", () => {
  const source = readFileSync(
    join(webRoot, "..", "mobile/lib/features/weekly_summaries/presentation/screens/weekly_summary_detail_screen.dart"),
    "utf8",
  );
  assert.match(source, /donor_code/);
  assert.match(source, /donor_name/);
  assert.match(source, /template_key/);
});

test("mobile cashflow renders a period closing-balance chart", () => {
  const source = readFileSync(
    join(webRoot, "..", "mobile/lib/features/finance/presentation/screens/budget_cashflow_screen.dart"),
    "utf8",
  );
  assert.match(source, /closing_balance/);
  assert.match(source, /Key\('cashflow-period-chart'\)|cashflow-period-chart/);
});

test("mobile assignment detail wires dependencies", () => {
  const source = readFileSync(
    join(webRoot, "..", "mobile/lib/features/assignments/presentation/screens/assignment_detail_screen.dart"),
    "utf8",
  );
  assert.match(source, /\/assignments\/\$\{widget\.assignmentId\}\/dependencies/);
  assert.match(source, /depends_on_assignment_id/);
});

test("mobile assignment create can save a recurring template", () => {
  const source = readFileSync(
    join(webRoot, "..", "mobile/lib/features/assignments/presentation/screens/assignment_create_screen.dart"),
    "utf8",
  );
  assert.match(source, /\/assignments\/templates/);
  assert.match(source, /recurrence_rule/);
});

test("decisions dashboard can promote weekly assignments on demand", () => {
  const source = readFileSync(join(webRoot, "app/(app)/decisions/dashboard/page.tsx"), "utf8");
  assert.match(source, /promoteWeeklyAssignments/);
  assert.match(source, /promoted/);
});

test("audit templates apply uses labelled engagement and template selects", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/templates/page.tsx"), "utf8");
  assert.match(source, /listEngagements/);
  assert.match(source, /listTemplates/);
  assert.match(source, /applyTemplate/);
  assert.match(source, /<select/);
  assert.doesNotMatch(source, /Engagement ID/);
  assert.doesNotMatch(source, /Template ID/);
});

test("cashflow generates optimistic and pessimistic overlays from a selected scenario", () => {
  const source = readFileSync(join(webRoot, "app/(app)/budget/cashflow/page.tsx"), "utf8");
  assert.match(source, /data-testid="cashflow-generate-bands"/);
  assert.match(source, /kind: "optimistic"/);
  assert.match(source, /kind: "pessimistic"/);
  assert.match(source, /addCashflowAdjustment/);
});

test("weekly summary shows assignment feed and Word export", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/page.tsx"), "utf8");
  assert.match(source, /weeklySummaryFeed/);
  assert.match(source, /exportUrl\(report\.id, "word"\)/);
});

test("notifications inbox can run NL search without auto-send", () => {
  const source = readFileSync(join(webRoot, "app/(app)/notifications/page.tsx"), "utf8");
  assert.match(source, /notificationsPhase23Api\.nlSearch/);
  assert.doesNotMatch(source, /auto-send|autoSend/);
});

test("correspondence detail can refresh courier tracking", () => {
  const source = readFileSync(join(webRoot, "app/(app)/correspondence/[id]/page.tsx"), "utf8");
  assert.match(source, /refreshTracking/);
  assert.match(source, /dispatches/);
  assert.match(source, /tracking_status/);
});

test("assignment calendar surfaces calendar feed subscribe URL", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/calendar/page.tsx"), "utf8");
  assert.match(source, /calendarFeed/);
  assert.match(source, /subscribe_url/);
  assert.match(source, /google_credentials_present/);
});

test("people org search renders labelled object cells instead of JSON dumps", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/search/page.tsx"), "utf8");
  assert.match(source, /LabelledRecord/);
  assert.doesNotMatch(source, /JSON\.stringify\(v\)/);
});

test("HR settings audit uses labelled change rows", () => {
  const source = readFileSync(join(webRoot, "app/(app)/settings/hr/audit/page.tsx"), "utf8");
  assert.match(source, /LabelledChangeRows/);
  assert.doesNotMatch(source, /truncateJson/);
});
