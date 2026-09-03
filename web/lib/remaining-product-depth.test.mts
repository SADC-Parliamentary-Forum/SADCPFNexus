import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDateShort } from "./utils.ts";

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

test("people onboarding page redirects to lifecycle onboarding create", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/onboarding/page.tsx"), "utf8");
  assert.match(source, /router\.replace\(["']\/lifecycle\/onboarding\/create["']\)/);
  assert.doesNotMatch(source, /createOnboarding/);
});

test("people offboarding page redirects to lifecycle separation create", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/offboarding/page.tsx"), "utf8");
  assert.match(source, /router\.replace\(["']\/lifecycle\/separation\/create["']\)/);
  assert.doesNotMatch(source, /createOffboarding/);
});

test("lifecycle hub uses ModulePageHeader, FormSection, and formatDateShort", () => {
  const page = readFileSync(join(webRoot, "app/(app)/lifecycle/page.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/hubs/lifecycle.ts"), "utf8");
  assert.match(page, /ModulePageHeader/);
  assert.match(page, /FormSection/);
  assert.match(page, /formatDateShort/);
  assert.match(page, /ModuleHubCards/);
  assert.match(page, /LIFECYCLE_HUB_CARDS/);
  assert.match(hub, /href:\s*["']\/lifecycle\/onboarding["']/);
  assert.match(hub, /href:\s*["']\/lifecycle\/separation["']/);
  assert.match(hub, /href:\s*["']\/lifecycle\/admin\/templates["']/);
});

test("lifecycle sidebar is a short primary set with hub cards for specialist destinations", () => {
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/hubs/lifecycle.ts"), "utf8");
  const auth = readFileSync(join(webRoot, "lib/authAccess.ts"), "utf8");
  const start = sidebar.indexOf('label: "Employee Lifecycle"');
  const next = sidebar.indexOf('label: "M&E / Results Monitoring"', start + 1);
  assert.ok(start >= 0 && next > start);
  const block = sidebar.slice(start, next);
  const hrefs = [...block.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 1 && hrefs.length <= 5, `expected <=5 lifecycle sidebar children, got ${hrefs.length}`);
  assert.ok(hrefs.includes("/lifecycle"));
  assert.ok(hrefs.includes("/lifecycle/my-tasks"));
  assert.ok(!hrefs.includes("/lifecycle/admin/templates"));
  assert.match(auth, /\/lifecycle\/admin\/templates/);
  assert.match(auth, /\/lifecycle\/onboarding\/create/);
  assert.match(hub, /permission:/);
  assert.match(hub, /href:\s*["']\/lifecycle\/reports["']/);
});

test("lifecycle API client exposes onboarding and separation endpoints", () => {
  const source = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  const lifecycle = source.slice(source.indexOf("export const lifecycleApi"), source.indexOf("export interface LifecycleCaseSummary") > 0 ? source.length : source.indexOf("export interface LifecycleCaseSummary"));
  assert.match(source, /export const lifecycleApi/);
  assert.match(source, /initiateOnboarding/);
  assert.match(source, /\/lifecycle\/onboarding/);
  assert.match(source, /initiateSeparation/);
  assert.match(source, /\/lifecycle\/separation/);
  assert.match(source, /\/lifecycle\/my-tasks/);
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
  assert.match(source, /htmlFor="weekly-item-title"/);
  assert.match(source, /htmlFor="weekly-item-section"/);
  assert.match(source, /excludeSuggestion/);
  assert.match(source, /additional_notes/);
  assert.match(source, /I confirm that this weekly summary/);
  assert.match(source, /data-testid="weekly-assignment-feed"/);
  assert.match(source, /data-testid="weekly-submit"/);
  assert.match(source, /labelledObjectCell/);
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
  assert.match(source, /rotateCalendarFeed/);
  assert.match(source, /EmptyState/);
  assert.match(source, /\/assignments\/\$\{item\.id\}/);
  assert.match(source, /Today/);
  assert.doesNotMatch(source, /subscribe_url: feed\.subscribe_url/);
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

test("assignment calendar can import ICS on demand", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/calendar/page.tsx"), "utf8");
  assert.match(source, /importIcs/);
  assert.match(source, /data-testid="assignment-ics-import"/);
});

test("profile settings loads and saves server notification preferences", () => {
  const source = readFileSync(join(webRoot, "app/(app)/profile/settings/page.tsx"), "utf8");
  assert.match(source, /userNotificationsApi\.preferences/);
  assert.match(source, /updatePreferences/);
  assert.match(source, /preferenceSuggestions/);
});

test("assignment detail can change due date and claim unassigned work", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/[id]/page.tsx"), "utf8");
  assert.match(source, /changeDueDate/);
  assert.match(source, /assignmentsApi\.claim/);
});

test("notifications inbox can archive and acknowledge", () => {
  const source = readFileSync(join(webRoot, "app/(app)/notifications/page.tsx"), "utf8");
  assert.match(source, /userNotificationsApi\.archive/);
  assert.match(source, /userNotificationsApi\.acknowledge/);
});

test("admin notifications can create a draft broadcast without sending it from the form", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/notifications/page.tsx"), "utf8");
  assert.match(source, /createBroadcast/);
  assert.match(source, /submitBroadcast/);
  assert.match(source, /approveBroadcast/);
  assert.match(source, /scheduleMaintenance/);
  assert.doesNotMatch(source, /createBroadcast\([^)]+\).*\.then\(\(\) => notificationsPhase23Api\.submitBroadcast/);
});

test("people units register uses labelled object cells instead of JSON dumps", () => {
  const source = readFileSync(join(webRoot, "app/(app)/people/units/page.tsx"), "utf8");
  assert.match(source, /labelledObjectCell/);
  assert.doesNotMatch(source, /JSON\.stringify\(v\)/);
});

test("people acting and delegations tables use labelledObjectCell instead of a local cell helper", () => {
  for (const page of ["acting", "delegations"]) {
    const source = readFileSync(join(webRoot, `app/(app)/people/${page}/page.tsx`), "utf8");
    assert.match(source, /labelledObjectCell/);
    assert.doesNotMatch(source, /\{cell\(/);
  }
});

test("admin operations renders labelled objects instead of JSON dumps", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/operations/page.tsx"), "utf8");
  assert.match(source, /LabelledRecord/);
  assert.doesNotMatch(source, /return JSON\.stringify\(value\)/);
});

test("correspondence detail can add notes and acknowledge routing", () => {
  const source = readFileSync(join(webRoot, "app/(app)/correspondence/[id]/page.tsx"), "utf8");
  assert.match(source, /listNotes/);
  assert.match(source, /addNote/);
  assert.match(source, /correspondenceApi\.acknowledge/);
});

test("notifications inbox can mark a read item unread", () => {
  const source = readFileSync(join(webRoot, "app/(app)/notifications/page.tsx"), "utf8");
  assert.match(source, /userNotificationsApi\.markUnread/);
});

test("admin notifications can create a draft ack campaign without activating it from the form", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/notifications/page.tsx"), "utf8");
  assert.match(source, /createAckCampaign/);
  assert.match(source, /activateAckCampaign/);
  assert.doesNotMatch(source, /createAckCampaign\([^)]+\).*\.then\(\(\) => notificationsPhase23Api\.activateAckCampaign/);
});

test("admin documents register can set retention and show backup status", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/documents/page.tsx"), "utf8");
  assert.match(source, /setRetention/);
  assert.match(source, /backupStatus/);
});

test("weekly summaries review page uses labelled chrome instead of a stub list", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/review/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /href: "\/weekly-summaries"/);
  assert.match(source, /FormSection/);
  assert.match(source, /LabelledRecord|labelledObjectCell/);
  assert.doesNotMatch(source, /JSON\.stringify\(/);
  assert.doesNotMatch(source, /window\.prompt/);
});

test("weekly summaries review page shows pending and missing reports as labelled UI", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/review/page.tsx"), "utf8");
  assert.match(source, /team_pending_review/);
  assert.match(source, /team_pending_reports/);
  assert.match(source, /missing_reports/);
  assert.match(source, /LabelledRecord|labelledObjectCell/);
  assert.doesNotMatch(source, /Pending review: \{pending\}/);
  assert.doesNotMatch(source, /String\(m\.name\)/);
});

test("weekly summaries review page links queue items to report detail", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/review/page.tsx"), "utf8");
  assert.match(source, /\/weekly-summaries\/\$\{/);
  assert.doesNotMatch(source, /weeklyReportsApi\.accept/);
  assert.doesNotMatch(source, /weeklyReportsApi\.returnReport/);
});

test("weekly summaries review page has empty, error, and loading copy", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/review/page.tsx"), "utf8");
  assert.match(source, /EmptyState/);
  assert.match(source, /Loading/);
  assert.match(source, /Failed to load/);
});

test("weekly summaries review page uses human-readable dates, not ISO as primary UI", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/review/page.tsx"), "utf8");
  assert.match(source, /formatDateShort|formatDateRange/);
  assert.doesNotMatch(source, /\$\{start\} → \$\{end\}/);
  assert.doesNotMatch(source, /toIso8601String/);
});

test("weekly summaries review page shows department names, never department IDs as cell text", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/review/page.tsx"), "utf8");
  assert.match(source, /department_name|department\?\.name|row\.department/);
  assert.doesNotMatch(source, /row\.department_id/);
  assert.doesNotMatch(source, />Department ID</);
  assert.doesNotMatch(source, /placeholder=["'][^"']*ID/);
});

test("weekly summaries review page is a labelled supervisor queue with filters and overdue counts", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/review/page.tsx"), "utf8");
  assert.match(source, /FormField/);
  assert.match(source, /<select|role=["']combobox["']/);
  assert.match(source, /submitted_at|Submitted/);
  assert.match(source, /days_late|Days late/);
  assert.match(source, /overdue/i);
  assert.match(source, /canReviewWeeklySummaries/);
  assert.doesNotMatch(source, /weeklyReportsApi\.accept/);
  assert.doesNotMatch(source, /weeklyReportsApi\.returnReport/);
});

test("weekly summaries review nav is hidden from staff who cannot review", () => {
  const auth = readFileSync(join(webRoot, "lib/authAccess.ts"), "utf8");
  const reviewRule = auth.slice(0, auth.indexOf('{ path: "/weekly-summaries" }'));
  assert.match(reviewRule, /\/weekly-summaries\/review/);
  assert.match(auth, /weekly-reports\.review-team|weekly-reports\.accept/);
  assert.match(auth, /canReviewWeeklySummaries/);
});

test("canReviewWeeklySummaries allows supervisors and SG, not plain staff", async () => {
  const { canReviewWeeklySummaries, canAccessRoute } = await import("./authAccess.ts");
  const staff = {
    id: 1,
    name: "Staff",
    email: "staff@example.org",
    tenant_id: 1,
    classification: "UNCLASSIFIED",
    roles: ["staff"],
    permissions: ["weekly-reports.view-own", "weekly-reports.submit"],
  };
  const hod = {
    ...staff,
    id: 2,
    name: "HOD",
    email: "hod@example.org",
    roles: ["HOD"],
    permissions: ["weekly-reports.review-team", "weekly-reports.accept"],
  };
  const sg = {
    ...staff,
    id: 3,
    name: "SG",
    email: "sg@example.org",
    roles: ["Secretary General"],
    permissions: [],
  };
  assert.equal(canReviewWeeklySummaries(staff), false);
  assert.equal(canAccessRoute(staff, "/weekly-summaries/review"), false);
  assert.equal(canAccessRoute(staff, "/weekly-summaries/department"), false);
  assert.equal(canAccessRoute(staff, "/weekly-summaries/institutional"), false);
  assert.equal(canAccessRoute(staff, "/weekly-summaries/compliance"), false);
  assert.equal(canAccessRoute(staff, "/weekly-summaries"), true);
  assert.equal(canReviewWeeklySummaries(hod), true);
  assert.equal(canAccessRoute(hod, "/weekly-summaries/review"), true);
  assert.equal(canAccessRoute(hod, "/weekly-summaries/department"), true);
  assert.equal(canAccessRoute(hod, "/weekly-summaries/institutional"), false);
  assert.equal(canReviewWeeklySummaries(sg), true);
  assert.equal(canAccessRoute(sg, "/weekly-summaries/review"), true);
  assert.equal(canAccessRoute(sg, "/weekly-summaries/institutional"), true);
});

test("weekly reports API exposes a gated review-queue endpoint", () => {
  const source = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  const weekly = source.slice(source.indexOf("export const weeklyReportsApi"), source.indexOf("// ── M&E"));
  assert.match(weekly, /reviewQueue/);
  assert.match(weekly, /\/weekly-summaries\/review-queue/);
});

test("weekly report dashboard exposes pending reports for the supervisor queue", () => {
  const source = readFileSync(
    join(webRoot, "..", "api/app/Modules/WeeklyReports/Services/WeeklyReportService.php"),
    "utf8",
  );
  assert.match(source, /team_pending_review/);
  assert.match(source, /team_pending_reports/);
  assert.match(source, /employee_name|employee\?->name/);
  assert.match(source, /department_name|departmentSummary/);
  assert.match(source, /assertCanAccessReviewQueue|canAccessReviewQueue/);
  assert.match(source, /isSecretaryGeneral/);
});

test("weekly summaries compliance page uses module chrome and labelled records", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/compliance/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /href: "\/weekly-summaries"/);
  assert.match(source, /FormSection/);
  assert.match(source, /LabelledRecord|labelledObjectCell/);
});

test("weekly summaries compliance page has no raw ID number field as primary UX", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/compliance/page.tsx"), "utf8");
  assert.doesNotMatch(source, /Period ID/);
  assert.doesNotMatch(source, /placeholder=["'][^"']*ID/);
  assert.doesNotMatch(source, /type=["']number["']/);
  assert.doesNotMatch(source, /window\.prompt/);
});

test("weekly summaries compliance page does not dump JSON", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/compliance/page.tsx"), "utf8");
  assert.doesNotMatch(source, /JSON\.stringify/);
});

test("weekly summaries compliance page has empty, error, and loading copy", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/compliance/page.tsx"), "utf8");
  assert.match(source, /EmptyState/);
  assert.match(source, /Loading/);
  assert.match(source, /Failed to load/);
});

test("weekly summaries compliance page links listed reports to weekly summary detail", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/compliance/page.tsx"), "utf8");
  assert.match(source, /\/weekly-summaries\/\$\{/);
  assert.match(source, /team_pending_reports/);
  assert.match(source, /missing_reports/);
  assert.doesNotMatch(source, /weeklyReportsApi\.accept/);
  assert.doesNotMatch(source, /weeklyReportsApi\.submit/);
});

test("weekly summaries compliance page formats period dates with formatDateShort", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/compliance/page.tsx"), "utf8");
  assert.match(source, /formatDateShort/);
  assert.doesNotMatch(source, /T00:00:00/);
  assert.doesNotMatch(source, /placeholder=["']Period ID["']/);
});

test("weekly summaries compliance page shows staff and department names, not department_id cells", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/compliance/page.tsx"), "utf8");
  assert.match(source, /personLabel|ownerLabel/);
  assert.match(source, /employee_name/);
  assert.match(source, /department_name|departmentLabel/);
  assert.match(source, /Late reports/);
  assert.match(source, /Missing reports/);
  assert.match(source, /Unaccepted reports/);
  assert.doesNotMatch(source, /labelledObjectCell\([^)]*department_id/);
  assert.doesNotMatch(source, /\{row\.department_id\}/);
  assert.doesNotMatch(source, /String\(row\.department_id\)/);
});

test("weekly summaries compliance page has labelled counts, department name combobox, and days late", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/compliance/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /EmptyState/);
  assert.match(source, /\/weekly-summaries\/\$\{/);
  assert.match(source, /role=["']combobox["']/);
  assert.match(source, /label:\s*["']Late["']/);
  assert.match(source, /label:\s*["']Missing["']/);
  assert.match(source, /label:\s*["']Unaccepted["']/);
  assert.match(source, /daysLate|Days late/);
});

test("weekly report dashboard missing and pending rows include department names", () => {
  const source = readFileSync(
    join(webRoot, "..", "api/app/Modules/WeeklyReports/Services/WeeklyReportService.php"),
    "utf8",
  );
  assert.match(source, /department_name/);
  assert.match(source, /department\?->name/);
});

test("weekly summaries department page uses a labelled department picker instead of a raw id field", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/department/page.tsx"), "utf8");
  assert.match(source, /listDepartments/);
  assert.match(source, /Department/);
  assert.match(source, /role=["']combobox["']/);
  assert.match(source, /\.name/);
  assert.doesNotMatch(source, /placeholder=["']Period ID["']/);
  assert.doesNotMatch(source, /placeholder=["']Department ID["']/);
  assert.doesNotMatch(source, /htmlFor=["']weekly-period-id["']/);
  assert.doesNotMatch(source, />Department ID</);
  assert.doesNotMatch(source, /window\.prompt/);
});

test("weekly summaries department page uses ModulePageHeader, FormSection, and labelled records", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/department/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /href: "\/weekly-summaries"/);
  assert.match(source, /FormSection/);
  assert.match(source, /FormField/);
  assert.match(source, /LabelledRecord|labelledObjectCell/);
  assert.doesNotMatch(source, /JSON\.stringify\(/);
});

test("weekly summaries department page links reports to weekly-summaries detail", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/department/page.tsx"), "utf8");
  assert.match(source, /weeklyReportsApi\.department/);
  assert.match(source, /\/weekly-summaries\/\$\{/);
  assert.doesNotMatch(source, /weeklyReportsApi\.submit/);
  assert.doesNotMatch(source, /weeklyReportsApi\.accept/);
});

test("weekly summaries department page has empty, error, and loading copy", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/department/page.tsx"), "utf8");
  assert.match(source, /EmptyState/);
  assert.match(source, /Loading/);
  assert.match(source, /Failed to load|Unable to load/);
});

test("weekly summaries department page formats dates with formatDateShort", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/department/page.tsx"), "utf8");
  assert.match(source, /formatDateShort/);
  assert.match(source, /from ["']@\/lib\/utils["']/);
  assert.doesNotMatch(source, /\$\{period\.start_date\} → \$\{period\.end_date\}/);
  assert.doesNotMatch(source, /report\.period\.start_date\} → \$\{report\.period\.end_date\}/);
});

test("weekly summaries department page period labels include formatted dates, not period id fields", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/department/page.tsx"), "utf8");
  assert.match(source, /formatDateShort\(/);
  assert.match(source, /periodLabel/);
  assert.doesNotMatch(source, /placeholder=["']Period ID["']/);
  assert.doesNotMatch(source, />Period ID</);
  assert.doesNotMatch(source, /htmlFor=["']weekly-period-id["']/);
});

test("weekly summaries department page does not show department_id as visible cell text", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/department/page.tsx"), "utf8");
  assert.match(source, /departmentLabel|dept\.name|department\.name/);
  assert.doesNotMatch(source, /\{row\.department_id\}/);
  assert.doesNotMatch(source, /\{selectedDept\.id\}/);
  assert.doesNotMatch(source, />Department ID</);
  assert.doesNotMatch(source, /placeholder=["']Department ID["']/);
});

test("weekly summaries department page shows submitted, missing, and late staff with names and counts", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/department/page.tsx"), "utf8");
  assert.match(source, /submitted_staff|Submitted staff/);
  assert.match(source, /missing_staff|Missing staff/);
  assert.match(source, /late_staff|Late staff/);
  assert.match(source, /counts\.submitted|submitted:/);
  assert.match(source, /counts\.missing|missing:/);
  assert.match(source, /counts\.late|late:/);
  assert.match(source, /htmlFor=["']department-staff-search["']/);
  assert.match(source, /\/weekly-summaries\/\$\{/);
  assert.doesNotMatch(source, /JSON\.stringify\(/);
  assert.doesNotMatch(source, /weeklyReportsApi\.accept/);
  assert.doesNotMatch(source, /weeklyReportsApi\.submit/);
});

test("department weekly rollup API includes department name and submitted missing late staff", () => {
  const service = readFileSync(
    join(webRoot, "..", "api/app/Modules/WeeklyReports/Services/WeeklyReportService.php"),
    "utf8",
  );
  const controller = readFileSync(
    join(webRoot, "..", "api/app/Http/Controllers/Api/V1/WeeklyReports/WeeklyReportController.php"),
    "utf8",
  );
  assert.match(service, /function departmentStaffRollup/);
  assert.match(service, /submitted_staff/);
  assert.match(service, /missing_staff/);
  assert.match(service, /late_staff/);
  assert.match(service, /\$department->name/);
  assert.match(controller, /departmentStaffRollup/);
  assert.match(controller, /array_merge\(\$report->toArray\(\), \$extra\)/);
});


test("institutional weekly summary has no raw ID number field as primary UX", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/institutional/page.tsx"), "utf8");
  assert.doesNotMatch(source, /placeholder=["']Period ID["']/);
  assert.doesNotMatch(source, /Period ID/);
  assert.doesNotMatch(source, /<input[^>]*(type=["']number["']|placeholder=["'][^"']*ID)/i);
  assert.doesNotMatch(source, /window\.prompt/);
  assert.doesNotMatch(source, /JSON\.stringify\(/);
});

test("institutional weekly summary uses a labelled period picker or auto-loads the current tenant", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/institutional/page.tsx"), "utf8");
  assert.match(source, /weeklyReportsApi\.periods/);
  assert.match(source, /weeklyReportsApi\.institutional/);
  assert.match(source, /weeklyReportsApi\.dashboard/);
  assert.match(source, /useEffect/);
  assert.match(source, /<select/);
  assert.match(source, /FormField/);
  assert.doesNotMatch(source, /weeklyReportsApi\.submit/);
  assert.doesNotMatch(source, /weeklyReportsApi\.accept/);
});

test("institutional weekly summary uses ModulePageHeader, FormSection, and labelled records", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/institutional/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /href: "\/weekly-summaries"/);
  assert.match(source, /FormSection/);
  assert.match(source, /LabelledRecord/);
  assert.match(source, /\/weekly-summaries\/\$\{/);
  assert.match(source, /\/weekly-summaries\/department/);
});

test("institutional weekly summary has empty, error, and loading copy", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/institutional/page.tsx"), "utf8");
  assert.match(source, /EmptyState/);
  assert.match(source, /Loading|animate-pulse/);
  assert.match(source, /Failed to load|Could not load/);
});

test("weekly summary detail uses labelled chrome instead of a stub header", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/[id]/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /href: "\/weekly-summaries"/);
  assert.match(source, /FormSection/);
  assert.match(source, /FormField/);
  assert.match(source, /LabelledRecord|labelledObjectCell/);
  assert.doesNotMatch(source, /JSON\.stringify\(/);
  assert.doesNotMatch(source, /window\.prompt/);
});

test("weekly summary detail return reason is a labelled field, not sr-only", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/[id]/page.tsx"), "utf8");
  assert.match(source, /htmlFor=["']weekly-return-reason["']/);
  assert.match(source, /weeklyReportsApi\.returnReport/);
  assert.match(source, /weeklyReportsApi\.accept/);
  assert.doesNotMatch(source, /className=["']sr-only["']/);
  assert.match(source, /EmptyState/);
  assert.match(source, /Loading/);
  assert.match(source, /Failed to load/);
});

test("weekly summaries trends page uses labelled chrome and the trends API", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/trends/page.tsx"), "utf8");
  assert.match(source, /weeklyReportsApi\.trends/);
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /href: "\/weekly-summaries"/);
  assert.match(source, /FormSection/);
  assert.match(source, /LabelledRecord|labelledObjectCell/);
  assert.match(source, /EmptyState/);
  assert.doesNotMatch(source, /JSON\.stringify\(/);
  assert.doesNotMatch(source, /api\.get\("\/weekly-summaries\/trends"\)/);
});

test("travel API exposes destination catalog list and create endpoints", () => {
  const source = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(source, /listDestinations:\s*\(\)\s*=>/);
  assert.match(source, /\/travel\/destinations/);
  assert.match(source, /createCountry:/);
  assert.match(source, /\/travel\/destinations\/countries/);
  assert.match(source, /createCity:/);
  assert.match(source, /\/travel\/destinations\/cities/);
});

test("travel create country picker loads the catalog and can add a missing country", () => {
  const page = readFileSync(join(webRoot, "app/(app)/travel/create/page.tsx"), "utf8");
  const pickers = readFileSync(join(webRoot, "components/travel/DestinationPickers.tsx"), "utf8");
  const source = page + pickers;
  assert.match(source, /travelApi\.listDestinations/);
  assert.match(source, /travelApi\.createCountry/);
  assert.match(source, /as a country/);
  assert.doesNotMatch(page, /const SADC_COUNTRIES/);
});

test("travel create city picker is a catalog dropdown that can add a missing city", () => {
  const page = readFileSync(join(webRoot, "app/(app)/travel/create/page.tsx"), "utf8");
  const pickers = readFileSync(join(webRoot, "components/travel/DestinationPickers.tsx"), "utf8");
  const source = page + pickers;
  assert.match(source, /travelApi\.createCity/);
  assert.match(source, /as a city/);
  assert.match(page, /destination_city/);
  assert.doesNotMatch(page, /placeholder=["']e\.g\. Harare["']/);
});

test("travel create addLeg uses the previous leg destination and date", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/create/page.tsx"), "utf8");
  const addLeg = source.slice(source.indexOf("const addLeg"), source.indexOf("const removeLeg"));
  assert.match(source, /nextTravelLeg/);
  assert.match(addLeg, /nextTravelLeg/);
  assert.doesNotMatch(addLeg, /from_location:\s*""/);
  assert.doesNotMatch(addLeg, /travel_date:\s*""/);
});

test("next travel leg starts from the previous destination and date", async () => {
  const { nextTravelLeg } = await import("./travelLegs.ts");
  const next = nextTravelLeg({
    from_location: "Windhoek, Namibia",
    to_location: "Johannesburg, South Africa",
    travel_date: "2026-08-21",
    transport_mode: "flight",
    days_count: 1,
  });
  assert.equal(next.from_location, "Johannesburg, South Africa");
  assert.equal(next.to_location, "");
  assert.equal(next.travel_date, "2026-08-21");
  assert.equal(next.transport_mode, "flight");
});

test("next travel leg keeps an empty from/date when the previous leg is blank", async () => {
  const { nextTravelLeg } = await import("./travelLegs.ts");
  const next = nextTravelLeg({
    from_location: "",
    to_location: "",
    travel_date: "",
    transport_mode: "bus",
    days_count: 2,
  });
  assert.equal(next.from_location, "");
  assert.equal(next.travel_date, "");
  assert.equal(next.transport_mode, "bus");
});

test("travel create itinerary has labelled flight name and number fields", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/create/page.tsx"), "utf8");
  const itinerary = source.slice(source.indexOf("Step 1: Itinerary"), source.indexOf("Step 2: Funding"));
  assert.match(itinerary, /FormField/);
  assert.match(itinerary, /label=["']Flight name["']/);
  assert.match(itinerary, /label=["']Flight number["']/);
  assert.match(itinerary, /htmlFor=\{`leg-\$\{i\}-flight-name`\}/);
  assert.match(itinerary, /htmlFor=\{`leg-\$\{i\}-flight-number`\}/);
  assert.doesNotMatch(itinerary, /window\.prompt/);
});

test("travel create posts flight name and number with itineraries", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/create/page.tsx"), "utf8");
  const payload = source.slice(source.indexOf("const buildPayload"), source.indexOf("const handleSubmit"));
  assert.match(payload, /flight_name:\s*l\.flight_name/);
  assert.match(payload, /flight_number:\s*l\.flight_number/);
});

test("travel detail shows flight name and number on itinerary legs", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/[id]/page.tsx"), "utf8");
  assert.match(source, /leg\.flight_name/);
  assert.match(source, /leg\.flight_number/);
});

test("next travel leg does not copy flight name or number from the previous hop", async () => {
  const { nextTravelLeg } = await import("./travelLegs.ts");
  const next = nextTravelLeg({
    from_location: "Windhoek, Namibia",
    to_location: "Johannesburg, South Africa",
    travel_date: "2026-08-21",
    transport_mode: "flight",
    days_count: 1,
    flight_name: "Air Namibia",
    flight_number: "SW 287",
  });
  assert.equal(next.from_location, "Johannesburg, South Africa");
  assert.equal(next.transport_mode, "flight");
  assert.equal(next.flight_name, "");
  assert.equal(next.flight_number, "");
});

test("formatDateShort uses 21 Aug 2026 and never dumps ISO", () => {
  assert.equal(formatDateShort("2026-08-21"), "21 Aug 2026");
  assert.equal(formatDateShort("2026-08-21T10:00:00.000000Z"), "21 Aug 2026");
  assert.equal(formatDateShort("2026-08-21T00:00:00.000000Z"), "21 Aug 2026");
  assert.doesNotMatch(formatDateShort("2026-08-21T10:00:00.000000Z"), /2026-08-21T|000000Z/);
});

test("weekly summaries assignment table formats due dates", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/page.tsx"), "utf8");
  assert.match(source, /formatDateShort/);
  assert.match(source, /formatDateShort\(row\.due_date/);
  assert.doesNotMatch(source, /\{row\.due_date \?\? "—"\}/);
});

test("people assignment register formats ISO date cells via labelledObjectCell", () => {
  const labelled = readFileSync(join(webRoot, "components/ui/LabelledRecord.tsx"), "utf8");
  const page = readFileSync(join(webRoot, "app/(app)/people/assignments/page.tsx"), "utf8");
  assert.match(labelled, /formatDateShort/);
  assert.match(page, /labelledObjectCell/);
});

test("travel reports page uses module chrome and the reports pack API", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/reports/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /href: "\/travel"/);
  assert.match(source, /FormSection/);
  assert.match(source, /FormField/);
  assert.match(source, /LabelledRecord|labelledObjectCell/);
  assert.match(source, /travelApi\.reportsPack/);
  assert.match(source, /reportsPackExportUrl/);
  assert.doesNotMatch(source, /JSON\.stringify/);
  assert.doesNotMatch(source, /window\.prompt/);
});

test("travel reports page formats dates and currency and has empty loading error states", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/reports/page.tsx"), "utf8");
  assert.match(source, /formatDateShort/);
  assert.match(source, /formatCurrency/);
  assert.match(source, /EmptyState/);
  assert.match(source, /Loading/);
  assert.match(source, /Failed to load/);
});

test("travel reports page shows named programmes not raw IDs", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/reports/page.tsx"), "utf8");
  assert.match(source, /programme_title|programme_reference|\.programme\b/);
  assert.doesNotMatch(source, /row\.programme_id/);
  assert.doesNotMatch(source, /placeholder=["'][^"']*ID/);
  assert.doesNotMatch(source, /type=["']number["']/);
  assert.doesNotMatch(source, /Coming Soon/);
});

test("travel reports page renders labelled analytics slices with tables", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/reports/page.tsx"), "utf8");
  assert.match(source, /by_status/);
  assert.match(source, /cost_by_programme/);
  assert.match(source, /cost_by_funding_agency/);
  assert.match(source, /travel_register/);
  assert.match(source, /<thead/);
  assert.match(source, /Download CSV/);
});

function travelSidebarChildren(source: string): string[] {
  const start = source.indexOf('label: "Travel"');
  const leave = source.indexOf('label: "Leave"');
  assert.ok(start >= 0 && leave > start, "Travel nav block not found in Sidebar");
  const block = source.slice(start, leave);
  const childrenStart = block.indexOf("children:");
  assert.ok(childrenStart >= 0, "Travel children array not found");
  return [...block.slice(childrenStart).matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
}

test("travel hub page uses ModulePageHeader and labelled feature cards", () => {
  const page = readFileSync(join(webRoot, "app/(app)/travel/page.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/travelHub.ts"), "utf8");
  const source = page + hub;
  assert.match(page, /ModulePageHeader/);
  assert.match(page, /PageBreadcrumbs/);
  assert.match(page, /FormSection/);
  assert.match(page, /EmptyState/);
  assert.match(page, /TRAVEL_HUB_CARDS/);
  assert.match(source, /href:\s*["']\/travel\/reports["']/);
  assert.match(source, /href:\s*["']\/travel\/register["']/);
  assert.match(source, /href:\s*["']\/travel\/create["']/);
  assert.match(source, /href:\s*["']\/travel\/settings["']/);
  assert.match(source, /href:\s*["']\/travel\/calendar["']/);
  assert.match(source, /href:\s*["']\/travel\/missions["']/);
  assert.match(source, /href:\s*["']\/travel\/toil["']/);
  assert.match(source, /href:\s*["']\/travel\/queues\/approval["']/);
  assert.match(source, /href:\s*["']\/travel\/queues\/admin["']/);
  assert.match(source, /href:\s*["']\/travel\/queues\/finance["']/);
  assert.match(source, /href:\s*["']\/travel\/queues\/director-finance["']/);
  assert.match(source, /href:\s*["']\/travel\/queues\/retirement["']/);
  assert.match(source, /href:\s*["']\/travel\/dashboards\/admin["']/);
  assert.match(source, /href:\s*["']\/travel\/dashboards\/finance["']/);
  assert.match(source, /imprest\?linked=travel/);
  assert.match(source, /Visa reminders/);
  assert.doesNotMatch(page, /JSON\.stringify\(/);
});

test("travel hub page keeps live dashboard counts and permission-filters cards", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/page.tsx"), "utf8");
  assert.match(source, /travelApi\.dashboardTraveller/);
  assert.match(source, /travelApi\.dashboardAdmin/);
  assert.match(source, /travelApi\.dashboardFinance/);
  assert.match(source, /canAccessRoute/);
  assert.match(source, /formatDateShort/);
  assert.match(source, /New request|Create request/i);
  assert.match(source, /Open register|Register/);
});

test("sidebar Travel children are a short primary set not every leaf", () => {
  const source = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const hrefs = travelSidebarChildren(source);
  assert.ok(
    hrefs.length >= 1 && hrefs.length <= 6,
    `expected <=6 Travel sidebar children, got ${hrefs.length}: ${hrefs.join(", ")}`,
  );
  assert.ok(hrefs.includes("/travel"), "hub remains in the Travel sidebar");
  assert.ok(hrefs.includes("/travel/create"), "New request remains in the Travel sidebar");
  assert.ok(hrefs.includes("/travel/register"), "Register remains in the Travel sidebar");
  assert.ok(hrefs.includes("/travel/missions"), "Missions remains in the Travel sidebar");
  assert.ok(hrefs.includes("/travel/settings"), "Settings remains in the Travel sidebar");
  assert.ok(!hrefs.includes("/travel/calendar"), "Calendar moved off the sidebar");
  assert.ok(!hrefs.includes("/travel/reports"), "Reports moved off the sidebar");
  assert.ok(!hrefs.includes("/travel/toil"), "TOIL moved off the sidebar");
  assert.ok(!hrefs.includes("/travel/queues/admin"), "Admin queue moved off the sidebar");
  assert.ok(!hrefs.includes("/travel/queues/finance"), "Finance queue moved off the sidebar");
  assert.ok(!hrefs.includes("/travel/queues/approval"), "Approval queue moved off the sidebar");
});

test("former travel routes remain reachable as pages", () => {
  const pages = [
    "app/(app)/travel/page.tsx",
    "app/(app)/travel/create/page.tsx",
    "app/(app)/travel/register/page.tsx",
    "app/(app)/travel/calendar/page.tsx",
    "app/(app)/travel/missions/page.tsx",
    "app/(app)/travel/reports/page.tsx",
    "app/(app)/travel/settings/page.tsx",
    "app/(app)/travel/toil/page.tsx",
    "app/(app)/travel/dashboards/admin/page.tsx",
    "app/(app)/travel/dashboards/finance/page.tsx",
    "app/(app)/travel/queues/admin/page.tsx",
    "app/(app)/travel/queues/approval/page.tsx",
    "app/(app)/travel/queues/director-finance/page.tsx",
    "app/(app)/travel/queues/finance/page.tsx",
    "app/(app)/travel/queues/retirement/page.tsx",
    "app/(app)/travel/[id]/page.tsx",
  ];
  for (const page of pages) {
    assert.ok(existsSync(join(webRoot, page)), `missing travel page ${page}`);
  }
});

test("travel settings and calendar breadcrumbs link back to the hub", () => {
  const settings = readFileSync(join(webRoot, "app/(app)/travel/settings/page.tsx"), "utf8");
  const calendar = readFileSync(join(webRoot, "app/(app)/travel/calendar/page.tsx"), "utf8");
  assert.match(settings, /href:\s*["']\/travel["']/);
  assert.match(settings, /data-testid=["']travel-dsa-settings["']/);
  assert.match(settings, /Type 1 — Acc \+ meals \+ incidentals/);
  assert.match(calendar, /href:\s*["']\/travel["']/);
});

test("travel calendar is a month grid with human dates, not ISO day headings", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/calendar/page.tsx"), "utf8");
  assert.match(source, /grid-cols-7/);
  assert.match(source, /Month grid/);
  assert.match(source, /formatDateShort/);
  assert.match(source, /data-testid=["']travel-calendar["']/);
  assert.match(source, /EmptyState/);
  assert.doesNotMatch(source, /<h2[^>]*>\{date\}<\/h2>/);
});

function leaveSidebarChildren(source: string): string[] {
  const start = source.indexOf('label: "Leave"');
  const next = source.indexOf('label: "Procurement"');
  assert.ok(start >= 0 && next > start, "Leave nav block not found in Sidebar");
  const block = source.slice(start, next);
  const childrenStart = block.indexOf("children:");
  assert.ok(childrenStart >= 0, "Leave children array not found");
  return [...block.slice(childrenStart).matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
}

test("workplan event types page can delete system types", () => {
  const source = readFileSync(join(webRoot, "app/(app)/workplan/event-types/page.tsx"), "utf8");
  assert.match(source, /workplanEventTypesApi\.delete/);
  assert.match(source, />\s*Delete\s*</);
  assert.doesNotMatch(source, /!et\.is_system/);
  assert.doesNotMatch(source, /System types cannot be deleted/);
});

test("workplan calendar opens an event on a single click", () => {
  const source = readFileSync(join(webRoot, "app/(app)/workplan/page.tsx"), "utf8");
  assert.doesNotMatch(source, /onDoubleClick/);
  assert.doesNotMatch(source, /Double-click to open/);
  assert.match(source, /onOpenEvent\(ev\.id\)/);
  assert.match(source, /handleOpenEvent\(ev\.id\)/);
  assert.match(source, /onClick=\{\(\) => handleOpenEvent\(ev\.id\)\}/);
});

test("leave create form shows remaining days by type and labelled fields", () => {
  const source = readFileSync(join(webRoot, "app/(app)/leave/create/page.tsx"), "utf8");
  assert.match(source, /LeaveBalanceStrip|categorizeLeaveBalances/);
  assert.match(source, /leaveTypeOptionLabel/);
  assert.match(source, /leaveApi\.getBalances/);
  assert.match(source, /FormField/);
  assert.match(source, /Leave period|What kind of leave/);
  assert.match(source, /searchParams|edit=/);
  assert.match(source, /prefillLeaveEndDate/);
  assert.doesNotMatch(source, /Server preview/);
  assert.doesNotMatch(source, />Segments</);
});

test("leave create is a single-column request without duplicate pickers or a TOIL sidebar", () => {
  const source = readFileSync(join(webRoot, "app/(app)/leave/create/page.tsx"), "utf8");
  assert.match(source, /LeaveBalanceStrip/);
  assert.match(source, /compact/);
  assert.match(source, /total_working_days/);
  assert.doesNotMatch(source, /lg:grid-cols-\[minmax\(0,1fr\)_340px\]/);
  assert.doesNotMatch(source, /Available TOIL/);
  assert.doesNotMatch(source, /Selected type/);
  assert.doesNotMatch(source, /Calendar days/);
  assert.doesNotMatch(source, /Holidays excluded/);
  assert.doesNotMatch(source, /Notes for this period/);
});

test("leave hub shows remaining days per type and labelled destination cards", () => {
  const page = readFileSync(join(webRoot, "app/(app)/leave/page.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/leaveHub.ts"), "utf8");
  assert.match(page, /LeaveBalanceStrip|categorizeLeaveBalances/);
  assert.match(page, /LEAVE_HUB_CARDS/);
  assert.match(page, /queue=recommend|queue === ["']recommend["']/);
  assert.match(hub, /href:\s*["']\/leave\/create["']/);
  assert.match(hub, /href:\s*["']\/leave\/calendar["']/);
  assert.match(hub, /href:\s*["']\/leave\/toil["']/);
  assert.match(hub, /href:\s*["']\/leave\/queues\/certify["']/);
  assert.doesNotMatch(page, /days remaining[\s\S]*hours available[\s\S]*days used/);
});

test("sidebar Leave children are a short primary set not every leaf", () => {
  const source = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const hrefs = leaveSidebarChildren(source);
  assert.ok(
    hrefs.length >= 1 && hrefs.length <= 5,
    `expected <=5 Leave sidebar children, got ${hrefs.length}: ${hrefs.join(", ")}`,
  );
  assert.ok(hrefs.includes("/leave"), "hub remains in the Leave sidebar");
  assert.ok(hrefs.includes("/leave/create"), "New request remains in the Leave sidebar");
  assert.ok(!hrefs.includes("/leave/toil"), "TOIL moved off the sidebar");
  assert.ok(!hrefs.includes("/leave/queues/certify"), "Certify queue moved off the sidebar");
  assert.ok(!hrefs.includes("/leave?queue=recommend"), "Recommend inbox moved off the sidebar");
});

test("leave calendar, TOIL, and certify pages keep labelled people and short dates", () => {
  const calendar = readFileSync(join(webRoot, "app/(app)/leave/calendar/page.tsx"), "utf8");
  const toil = readFileSync(join(webRoot, "app/(app)/leave/toil/page.tsx"), "utf8");
  const certify = readFileSync(join(webRoot, "app/(app)/leave/queues/certify/page.tsx"), "utf8");
  assert.match(calendar, /formatDateShort/);
  assert.match(calendar, /requester\?\.name/);
  assert.match(toil, /formatDateShort/);
  assert.match(certify, /formatDateShort/);
  assert.match(certify, /requester\?\.name/);
  assert.match(calendar, /href:\s*["']\/leave["']/);
});

test("nginx auth rate limit does not wrap GET /auth/me", () => {
  const source = readFileSync(join(webRoot, "../docker/nginx/api.conf"), "utf8");
  assert.doesNotMatch(source, /location ~ \^\/api\/v1\/auth \{/);
  assert.match(source, /location ~ \^\/api\/v1\/auth\/\(login/);
  assert.match(source, /zone=api_auth/);
});

test("AuthProvider does not refetch /auth/me on every pathname change", () => {
  const source = readFileSync(join(webRoot, "components/providers/AuthProvider.tsx"), "utf8");
  assert.match(source, /authApi\.me\(/);
  assert.doesNotMatch(source, /authApi\.me\([\s\S]*\}, \[pathname\]\)/);
});

test("QueryClient does not retry client 4xx failures", () => {
  const source = readFileSync(join(webRoot, "components/providers/QueryProvider.tsx"), "utf8");
  assert.match(source, /retry:/);
  assert.match(source, /status < 500|status >= 500/);
});

function navChildrenBetween(source: string, startLabel: string, nextLabel: string | null): string[] {
  const start = source.indexOf(`label: "${startLabel}"`);
  assert.ok(start >= 0, `${startLabel} nav block not found`);
  const next = nextLabel ? source.indexOf(`label: "${nextLabel}"`, start + 1) : source.indexOf("const MANIFEST_I18N_KEYS");
  assert.ok(next > start, `${startLabel} nav end marker not found`);
  const block = source.slice(start, next);
  const childrenStart = block.indexOf("children:");
  assert.ok(childrenStart >= 0, `${startLabel} children array not found`);
  return [...block.slice(childrenStart).matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
}

const OVERCROWDED_SIDEBARS: {
  label: string;
  next: string | null;
  max: number;
  hubFile: string;
  page: string;
  mustInclude: string[];
  mustExclude: string[];
  formerHrefs: string[];
}[] = [
  {
    label: "Salary Advances",
    next: "Programmes",
    max: 5,
    hubFile: "lib/hubs/salaryAdvances.ts",
    page: "app/(app)/salary-advances/page.tsx",
    mustInclude: ["/salary-advances", "/salary-advances/create", "/salary-advances/applications"],
    mustExclude: [
      "/salary-advances/queues/certify",
      "/salary-advances/queues/payment",
      "/salary-advances/queues/recovery",
      "/salary-advances/reconciliation",
      "/salary-advances/outstanding",
    ],
    formerHrefs: [
      "/salary-advances/create",
      "/salary-advances/applications",
      "/salary-advances/history",
      "/salary-advances/finance",
      "/salary-advances/queues/certify",
      "/salary-advances/pending-approval",
      "/salary-advances/queues/payment",
      "/salary-advances/queues/recovery",
      "/salary-advances/outstanding",
      "/salary-advances/reconciliation",
      "/salary-advances/register",
      "/salary-advances/reports",
      "/salary-advances/settings",
    ],
  },
  {
    label: "Weekly Summaries",
    next: "Travel",
    max: 3,
    hubFile: "lib/hubs/weeklySummaries.ts",
    page: "app/(app)/weekly-summaries/page.tsx",
    mustInclude: ["/weekly-summaries"],
    mustExclude: [
      "/weekly-summaries/review",
      "/weekly-summaries/department",
      "/weekly-summaries/institutional",
      "/weekly-summaries/compliance",
      "/reports/weekly",
    ],
    formerHrefs: [
      "/weekly-summaries/review",
      "/weekly-summaries/department",
      "/weekly-summaries/institutional",
      "/weekly-summaries/compliance",
      "/weekly-summaries/trends",
      "/reports/weekly",
    ],
  },
  {
    label: "Assignments",
    next: "Weekly Summaries",
    max: 6,
    hubFile: "lib/hubs/assignments.ts",
    page: "app/(app)/assignments/page.tsx",
    mustInclude: ["/assignments", "/assignments/create", "/assignments/mine"],
    mustExclude: ["/assignments/overdue", "/assignments/blocked", "/assignments/escalations", "/assignments/unassigned"],
    formerHrefs: [
      "/assignments/mine",
      "/assignments/assigned-by-me",
      "/assignments/review",
      "/assignments/team",
      "/assignments/create",
      "/assignments/register",
      "/assignments/unassigned",
      "/assignments/pending",
      "/assignments/overdue",
      "/assignments/blocked",
      "/assignments/escalations",
      "/assignments/recurring",
      "/assignments/completed",
      "/assignments/reports",
      "/assignments/calendar",
      "/assignments/capacity",
    ],
  },
  {
    label: "Procurement",
    next: "Supplier Portal",
    max: 6,
    hubFile: "lib/hubs/procurement.ts",
    page: "app/(app)/procurement/page.tsx",
    mustInclude: ["/procurement", "/procurement/create", "/procurement/settings"],
    mustExclude: ["/procurement/tender-committee", "/procurement/bid-submissions", "/procurement/receipts"],
    formerHrefs: [
      "/procurement/analytics",
      "/procurement/create",
      "/procurement/intake",
      "/procurement/budget",
      "/procurement/rfq",
      "/procurement/tenders",
      "/procurement/notices",
      "/procurement/bid-submissions",
      "/procurement/evaluations",
      "/procurement/tender-committee",
      "/procurement/planning",
      "/procurement/catalogue",
      "/procurement/vendors",
      "/procurement/purchase-orders",
      "/procurement/receipts",
      "/procurement/invoices",
      "/procurement/contracts",
      "/procurement/register",
      "/procurement/settings",
    ],
  },
  {
    label: "Finance",
    next: "Salary Advances",
    max: 6,
    hubFile: "lib/hubs/finance.ts",
    page: "app/(app)/finance/page.tsx",
    mustInclude: ["/finance", "/budget", "/imprest"],
    mustExclude: ["/budget/contribution-schedules", "/budget/fx-rates", "/finance/payroll-imports"],
    formerHrefs: [
      "/budget",
      "/budget/cycles",
      "/budget/changes",
      "/budget/variance",
      "/budget/reports",
      "/budget/cashflow",
      "/budget/fx-rates",
      "/budget/contribution-schedules",
      "/finance/budget",
      "/finance/payslips",
      "/finance/payroll-imports",
      "/imprest",
      "/finance/balance-register",
    ],
  },
  {
    label: "Timesheets",
    next: "HR",
    max: 5,
    hubFile: "lib/hubs/timesheets.ts",
    page: "app/(app)/hr/timesheets/page.tsx",
    mustInclude: ["/hr/timesheets", "/hr/timesheets/monthly"],
    mustExclude: ["/hr/timesheets/payroll", "/hr/timesheets/history", "/hr/timesheets/overtime"],
    formerHrefs: [
      "/hr/timesheets/monthly",
      "/hr/timesheets/overtime",
      "/hr/timesheets/team",
      "/hr/timesheets/schedules",
      "/hr/timesheets/payroll",
      "/hr/timesheets/templates",
      "/hr/timesheets/history",
    ],
  },
  {
    label: "HR",
    next: "Risk Register",
    max: 6,
    hubFile: "lib/hubs/hr.ts",
    page: "app/(app)/hr/page.tsx",
    mustInclude: ["/hr", "/hr/leave", "/hr/files"],
    mustExclude: ["/hr/profile-requests", "/hr/incidents", "/leave/toil"],
    formerHrefs: [
      "/hr/leave",
      "/hr/leave/balances",
      "/leave/queues/certify",
      "/leave/toil",
      "/hr/appraisals",
      "/hr/conduct",
      "/hr/performance",
      "/hr/incidents",
      "/hr/files",
      "/hr/documents",
      "/hr/profile-requests",
      "/hr/payslips",
      "/hr/departments",
      "/hr/positions",
    ],
  },
  {
    label: "Risk Register",
    next: "Audit Management",
    max: 5,
    hubFile: "lib/hubs/risk.ts",
    page: "app/(app)/risk/page.tsx",
    mustInclude: ["/risk", "/risk/create", "/risk/dashboard"],
    mustExclude: ["/risk/kri", "/risk/control-testing", "/risk/bcp"],
    formerHrefs: [
      "/risk/dashboard",
      "/risk/analytics",
      "/risk/controls",
      "/risk/incidents",
      "/risk/appetite",
      "/risk/audit-trail",
      "/risk/policies",
      "/risk/create",
      "/risk/kri",
      "/risk/control-testing",
      "/risk/bcp",
    ],
  },
  {
    label: "Audit Management",
    next: "People & Authority",
    max: 5,
    hubFile: "lib/hubs/audit.ts",
    page: "app/(app)/audit/page.tsx",
    mustInclude: ["/audit", "/audit/engagements", "/audit/settings"],
    mustExclude: ["/audit/ai", "/audit/qa", "/audit/campaigns"],
    formerHrefs: [
      "/audit/analytics",
      "/audit/universe",
      "/audit/plans",
      "/audit/engagements",
      "/audit/findings",
      "/audit/corrective-actions",
      "/audit/campaigns",
      "/audit/resources",
      "/audit/qa",
      "/audit/templates",
      "/audit/governance-packs",
      "/audit/appointments",
      "/audit/external",
      "/audit/ai",
      "/audit/settings",
    ],
  },
  {
    label: "Employee Lifecycle",
    next: "M&E / Results Monitoring",
    max: 5,
    hubFile: "lib/hubs/lifecycle.ts",
    page: "app/(app)/lifecycle/page.tsx",
    mustInclude: ["/lifecycle", "/lifecycle/my-tasks"],
    mustExclude: ["/lifecycle/admin/templates", "/lifecycle/reports", "/lifecycle/onboarding/create"],
    formerHrefs: [
      "/lifecycle/onboarding/create",
      "/lifecycle/separation/create",
      "/lifecycle/onboarding",
      "/lifecycle/separation",
      "/lifecycle/my-tasks",
      "/lifecycle/reports",
      "/lifecycle/admin/templates",
    ],
  },
  {
    label: "People & Authority",
    next: "Employee Lifecycle",
    max: 5,
    hubFile: "lib/hubs/people.ts",
    page: "app/(app)/people/page.tsx",
    mustInclude: ["/people", "/people/directory"],
    mustExclude: ["/people/acting", "/saam", "/verify-signature"],
    formerHrefs: [
      "/profile",
      "/saam",
      "/people/directory",
      "/organogram",
      "/people/authority",
      "/people/delegations",
      "/people/acting",
      "/verify-signature",
    ],
  },
  {
    label: "M&E / Results Monitoring",
    next: "Reports",
    max: 6,
    hubFile: "lib/hubs/mande.ts",
    page: "app/(app)/mande/page.tsx",
    mustInclude: ["/mande", "/mande/activity-reports/mine", "/mande/settings"],
    mustExclude: ["/mande/import", "/mande/data-quality", "/mande/pm-review"],
    formerHrefs: [
      "/mande/intake",
      "/mande/activity-reports/mine",
      "/mande/activity-reports",
      "/mande/review-queue",
      "/mande/pm-review",
      "/mande/strategic-plan",
      "/mande/results",
      "/mande/indicators",
      "/mande/calendar",
      "/mande/reports",
      "/mande/data-quality",
      "/mande/import",
      "/mande/settings",
    ],
  },
  {
    label: "Fixed Assets",
    next: "Consumables / Stock",
    max: 6,
    hubFile: "lib/hubs/assets.ts",
    page: "app/(app)/assets/dashboard/page.tsx",
    mustInclude: ["/assets/dashboard", "/assets", "/assets/settings"],
    mustExclude: ["/assets/revaluation", "/assets/insurance", "/assets/depreciation"],
    formerHrefs: [
      "/assets",
      "/fleet",
      "/fleet/utilisation",
      "/assets/intake",
      "/assets/mine",
      "/assets/transfers",
      "/assets/verification",
      "/assets/maintenance",
      "/assets/depreciation",
      "/assets/disposal",
      "/assets/revaluation",
      "/assets/reports",
      "/assets/settings",
      "/assets/categories",
      "/assets/requests",
      "/assets/insurance",
    ],
  },
  {
    label: "Consumables / Stock",
    next: "Governance",
    max: 6,
    hubFile: "lib/hubs/stock.ts",
    page: "app/(app)/stock/dashboard/page.tsx",
    mustInclude: ["/stock/dashboard", "/stock", "/stock/requests"],
    mustExclude: ["/stock/write-offs", "/stock/batches", "/stock/phase2/forecasting"],
    formerHrefs: [
      "/stock",
      "/stock/requests",
      "/stock/issues",
      "/stock/returns",
      "/stock/transfers",
      "/stock/movements",
      "/stock/stocktakes",
      "/stock/scan",
      "/stock/write-offs",
      "/stock/replenishments",
      "/stock/low-stock",
      "/stock/batches",
      "/stock/reports",
      "/stock/locations",
      "/stock/units",
      "/stock/categories",
      "/stock/phase2/forecasting",
      "/stock/unified-register",
    ],
  },
  {
    label: "Correspondence",
    next: "Analytics",
    max: 6,
    hubFile: "lib/hubs/correspondence.ts",
    page: "app/(app)/correspondence/page.tsx",
    mustInclude: ["/correspondence", "/correspondence/incoming", "/correspondence/create"],
    mustExclude: ["/correspondence/subject-files", "/correspondence/retention", "/correspondence/letterhead"],
    formerHrefs: [
      "/correspondence/incoming",
      "/correspondence/registry?direction=incoming",
      "/correspondence/create",
      "/correspondence/mail-merge",
      "/correspondence/registry?direction=outgoing",
      "/correspondence/my-actions",
      "/correspondence/pending-routing",
      "/correspondence/master-register",
      "/correspondence/subject-files",
      "/correspondence/retention",
      "/correspondence/contacts",
      "/correspondence/letterhead",
      "/correspondence/reports",
      "/correspondence/mailbox",
    ],
  },
];

const ADMIN_SIDEBAR_HREFS = [
  "/admin",
  "/admin/operations",
  "/admin/users",
  "/admin/access/roles",
  "/admin/access",
  "/admin/departments",
  "/admin/positions",
  "/admin/portfolios",
  "/admin/workflows",
  "/admin/workflows/designer",
  "/admin/workflows/simulate",
  "/admin/workflows/analytics",
  "/admin/workflows/ai",
  "/admin/settings",
  "/settings/hr",
  "/admin/governance",
  "/admin/notifications",
  "/admin/timesheet-projects",
  "/admin/calendar",
  "/admin/payslips",
  "/admin/salary-assignments",
  "/admin/audit-trail",
  "/admin/documents",
  "/admin/ledger",
  "/admin/data-scope",
  "/admin/weekly-summary",
  "/admin/correspondence",
];

test("overcrowded sidebars are shortened and hub cards keep every former destination", () => {
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const hubCards = readFileSync(join(webRoot, "components/ui/ModuleHubCards.tsx"), "utf8");
  assert.match(hubCards, /data-testid=["']module-hub-cards["']/);
  assert.match(hubCards, /FormSection/);
  assert.match(hubCards, /canAccessRoute/);

  for (const mod of OVERCROWDED_SIDEBARS) {
    const hrefs = navChildrenBetween(sidebar, mod.label, mod.next);
    assert.ok(
      hrefs.length >= 1 && hrefs.length <= mod.max,
      `${mod.label}: expected <=${mod.max} sidebar children, got ${hrefs.length}: ${hrefs.join(", ")}`,
    );
    for (const href of mod.mustInclude) {
      assert.ok(hrefs.includes(href), `${mod.label} sidebar missing ${href}`);
    }
    for (const href of mod.mustExclude) {
      assert.ok(!hrefs.includes(href), `${mod.label} sidebar still lists ${href}`);
    }

    const hubPath = join(webRoot, mod.hubFile);
    assert.ok(existsSync(hubPath), `missing hub file ${mod.hubFile}`);
    const hub = readFileSync(hubPath, "utf8");
    const page = readFileSync(join(webRoot, mod.page), "utf8");
    assert.match(page, /ModuleHubCards/);
    assert.match(page, /_HUB_CARDS/);
    for (const href of mod.formerHrefs) {
      const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(hub, new RegExp(escaped), `${mod.hubFile} missing former destination ${href}`);
    }
  }
});

test("timesheet capture collapses extra tools and hides specialist destinations from staff", () => {
  const page = readFileSync(join(webRoot, "app/(app)/hr/timesheets/page.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/hubs/timesheets.ts"), "utf8");
  const auth = readFileSync(join(webRoot, "lib/authAccess.ts"), "utf8");
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const cards = readFileSync(join(webRoot, "components/ui/ModuleHubCards.tsx"), "utf8");
  assert.match(page, /ModulePageHeader/);
  assert.match(page, /More timesheet tools/);
  assert.match(page, /<details/);
  assert.doesNotMatch(page, /Timesheet #\{timesheet\.id\}/);
  assert.doesNotMatch(page, /pay XOR TOIL/);
  assert.match(hub, /href:\s*["']\/hr\/timesheets\/payroll["'][\s\S]*permission:/);
  assert.match(hub, /OT validation[\s\S]*permission:/);
  assert.match(auth, /\/hr\/timesheets\/payroll/);
  assert.match(auth, /\/hr\/timesheets\/schedules/);
  assert.match(cards, /card\.permission/);
  const hrefs = navChildrenBetween(sidebar, "Timesheets", "HR");
  assert.ok(!hrefs.includes("/hr/timesheets/team"), "Team view stays off the short Timesheets sidebar");
  assert.ok(!hrefs.includes("/hr/timesheets/templates"), "Templates stay off the short Timesheets sidebar");
});

test("assignment dashboard collapses extra tools and hides specialist queues from staff", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assignments/page.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/hubs/assignments.ts"), "utf8");
  const auth = readFileSync(join(webRoot, "lib/authAccess.ts"), "utf8");
  assert.match(page, /More assignment tools/);
  assert.match(page, /<details/);
  assert.match(hub, /Unassigned queue[\s\S]*permission:/);
  assert.match(hub, /Escalations[\s\S]*permission:/);
  assert.match(auth, /\/assignments\/unassigned/);
  assert.match(auth, /\/assignments\/escalations/);
  assert.match(auth, /\/assignments\/review/);
  assert.match(auth, /\/assignments\/pending/);
});

test("salary advance dashboard collapses finance tools away from the employee summary", () => {
  const page = readFileSync(join(webRoot, "app/(app)/salary-advances/page.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/hubs/salaryAdvances.ts"), "utf8");
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  assert.match(page, /More salary-advance tools/);
  assert.match(page, /<details/);
  assert.match(page, /ModuleHubCards/);
  assert.match(hub, /Finance dashboard[\s\S]*permission:/);
  assert.match(hub, /Pending finance certification[\s\S]*permission:/);
  const hrefs = navChildrenBetween(sidebar, "Salary Advances", "Programmes");
  assert.ok(!hrefs.includes("/salary-advances/settings"), "Settings stays off the short Salary Advances sidebar");
  assert.ok(!hrefs.includes("/salary-advances/finance"), "Finance dashboard stays off the short Salary Advances sidebar");
});

test("weekly summary compose collapses specialist tools and hides them from staff", () => {
  const page = readFileSync(join(webRoot, "app/(app)/weekly-summaries/page.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/hubs/weeklySummaries.ts"), "utf8");
  const auth = readFileSync(join(webRoot, "lib/authAccess.ts"), "utf8");
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  assert.match(page, /More weekly-summary tools/);
  assert.match(page, /<details/);
  assert.match(hub, /title:\s*["']Team review["']/);
  assert.match(hub, /title:\s*["']Department summary["']/);
  assert.match(hub, /title:\s*["']Institutional summary["']/);
  assert.match(auth, /\/weekly-summaries\/department/);
  assert.match(auth, /\/weekly-summaries\/institutional/);
  assert.match(auth, /\/weekly-summaries\/compliance/);
  const hrefs = navChildrenBetween(sidebar, "Weekly Summaries", "Travel");
  assert.ok(!hrefs.includes("/weekly-summaries/review"), "Team review stays off the short Weekly Summaries sidebar");
  assert.ok(!hrefs.includes("/weekly-summaries/department"), "Department summary stays off the short Weekly Summaries sidebar");
});

test("PIF detail does not render a responsible-officer user object as a React child", () => {
  const source = readFileSync(join(webRoot, "app/(app)/pif/[id]/page.tsx"), "utf8");
  assert.match(source, /personLabel\(/);
  assert.doesNotMatch(source, /currentHolder=\{programme\.responsible_officer\s*\?\?/);
  const banner = readFileSync(join(webRoot, "components/workflow/WorkflowStatusBanner.tsx"), "utf8");
  assert.match(banner, /function bannerText/);
});

test("PIF edit uses labelled sections, catalogues, need-toggles, and a sticky save bar", () => {
  const source = readFileSync(join(webRoot, "app/(app)/pif/[id]/edit/page.tsx"), "utf8");
  assert.match(source, /FormSection/);
  assert.match(source, /FormField/);
  assert.match(source, /NeedToggle/);
  assert.match(source, /Media liaison rate/);
  assert.match(source, /media_liaison_rate/);
  assert.match(source, /PIF_STRATEGIC_PILLARS/);
  assert.match(source, /DEPARTMENTS/);
  assert.match(source, /CURRENCIES/);
  assert.match(source, /listDestinations/);
  assert.match(source, /formatDateRange/);
  assert.match(source, /Save this page/);
  assert.match(source, /data-testid=["']pif-edit-actions["']/);
  assert.match(source, /sticky/);
  const toggle = readFileSync(join(webRoot, "app/(app)/pif/[id]/edit/NeedToggle.tsx"), "utf8");
  assert.match(toggle, /data-testid=["']pif-need-toggle["']/);
});

test("Administration sidebar and hub keep every control-plane destination", () => {
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const hrefs = navChildrenBetween(sidebar, "Administration", null);
  for (const href of ADMIN_SIDEBAR_HREFS) {
    assert.ok(hrefs.includes(href), `Administration sidebar missing ${href}`);
  }
  const page = readFileSync(join(webRoot, "app/(app)/admin/page.tsx"), "utf8");
  const hub = readFileSync(join(webRoot, "lib/hubs/admin.ts"), "utf8");
  assert.match(page, /ModuleHubCards/);
  assert.match(page, /ADMIN_HUB_CARDS/);
  for (const href of [
    "/admin/users",
    "/admin/access/roles",
    "/admin/workflows",
    "/admin/settings",
    "/admin/documents",
    "/admin/notifications",
  ]) {
    assert.match(hub, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("workflow analytics page normalizes API payload and offers reload on failure", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/workflows/analytics/page.tsx"), "utf8");
  assert.match(source, /data-testid="workflow-analytics-page"/);
  assert.match(source, /normalizeAnalyticsSummary/);
  assert.match(source, /workflowEngineApi/);
  assert.match(source, /\.analytics\(/);
  assert.match(source, /Reload/);
  assert.doesNotMatch(source, /JSON\.stringify/);
});

test("travel settings exposes DSA rate register with edit and rate type labels", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/settings/page.tsx"), "utf8");
  assert.match(source, /data-testid="travel-dsa-settings"/);
  assert.match(source, /RATE_TYPE_LABELS/);
  assert.match(source, /saveDsaRate/);
  assert.match(source, /startEdit/);
  assert.match(source, /effective_from/);
});

