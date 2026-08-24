import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("procurement notices expose newspaper templates and a human checklist", () => {
  const source = readFileSync(join(webRoot, "app/(app)/procurement/notices/page.tsx"), "utf8");
  assert.match(source, /newspaper-notice-templates/);
  assert.match(source, /newspaper-notice-checklist/);
  assert.match(source, /saveNewspaperChecklist/);
  assert.match(source, /never auto-awards/);
  assert.match(source, /copy-filled-notice/);
});

test("stock event packs instantiate draft requests only", () => {
  const source = readFileSync(join(webRoot, "app/(app)/stock/event-packs/page.tsx"), "utf8");
  assert.match(source, /stockEventPacksApi\.instantiate/);
  assert.match(source, /never auto-issues/);
  assert.match(source, /stockEventPacksApi\.duplicate/);
  assert.match(source, /event-pack-barcode-add/);
});

test("barcode scan has bulk lookup plus event-pack link", () => {
  const source = readFileSync(join(webRoot, "app/(app)/stock/scan/page.tsx"), "utf8");
  assert.match(source, /barcode-bulk-lookup/);
  assert.match(source, /stockEventPacksApi\.barcodeLookup/);
  assert.match(source, /\/stock\/event-packs/);
});

test("timesheet capacity page refuses invented OT rates", () => {
  const source = readFileSync(join(webRoot, "app/(app)/hr/timesheets/capacity/page.tsx"), "utf8");
  assert.match(source, /timesheet-capacity-disclaimer/);
  assert.match(source, /capacityAnalytics/);
  assert.match(source, /Not a performance score/);
  assert.match(source, /timesheet-capacity-week-picker/);
  assert.match(source, /timesheet-capacity-csv/);
  assert.doesNotMatch(source, /overtime_rate|ot_rate/);
});

test("weekly summary detail offers a management pack without auto-send", () => {
  const source = readFileSync(join(webRoot, "app/(app)/weekly-summaries/[id]/page.tsx"), "utf8");
  assert.match(source, /management-pack/);
  assert.match(source, /assignment feed/);
  assert.doesNotMatch(source, /auto-send|autoSend/);
});

test("assignment handover pack suggests filters only", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/handover/page.tsx"), "utf8");
  assert.match(source, /handoverPack/);
  assert.match(source, /nlSearch/);
  assert.match(source, /Filter suggest only|filter_suggest_only|Suggest filters/);
  assert.match(source, /not a surveillance ranking/);
  assert.match(source, /apply_hrefs|assignment-nl-apply-hrefs/);
  assert.match(source, /handover-pack-docx/);
  assert.doesNotMatch(source, /leaderboard|rank employees|surveillance ranking of/i);
});

test("assignment detail couples timesheet hours without auto-complete", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/[id]/page.tsx"), "utf8");
  assert.match(source, /timesheetHours/);
  assert.match(source, /does not complete the assignment/);
});

test("audit AI includes investigation pack that never auto-closes", () => {
  const source = readFileSync(join(webRoot, "app/(app)/audit/ai/page.tsx"), "utf8");
  assert.match(source, /investigation_pack/);
  assert.match(source, /never auto-closes/);
  assert.match(source, /audit-engagement-id/);
  assert.match(source, /audit-next-questions/);
});

test("decisions dashboard can promote risk drafts and a meeting pack", () => {
  const source = readFileSync(join(webRoot, "app/(app)/decisions/dashboard/page.tsx"), "utf8");
  assert.match(source, /promoteRisks/);
  assert.match(source, /Promote risk drafts/);
  assert.match(source, /promoteMeetingPack/);
  assert.match(source, /Promote meeting pack/);
  assert.match(source, /promoteFromMinutes/);
  assert.match(source, /promote-from-minutes/);
});

test("M&E narrative assist requires human confirm", () => {
  const source = readFileSync(join(webRoot, "app/(app)/mande/ai-assist/page.tsx"), "utf8");
  assert.match(source, /mandeApi\.aiAssist/);
  assert.match(source, /confirmAiAssist/);
  assert.match(source, /Never auto-mutates/);
  assert.match(source, /mande-nl-filter-hrefs/);
});

test("correspondence detail shows a labelled registry pack without live courier proof", () => {
  const source = readFileSync(join(webRoot, "app/(app)/correspondence/[id]/page.tsx"), "utf8");
  assert.match(source, /correspondence-registry-pack/);
  assert.match(source, /registryPack/);
  assert.match(source, /not live carrier proof/);
});

test("assignment workload forecast is not a ranking", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/workload/page.tsx"), "utf8");
  assert.match(source, /workloadForecast/);
  assert.match(source, /Not a surveillance ranking/);
  assert.match(source, /workload-weeks/);
});
