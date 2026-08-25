import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("lifecycle API exposes closeout mutations", () => {
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(api, /reopenTask/);
  assert.match(api, /approveTerminalPayment/);
  assert.match(api, /finaliseSeparation/);
  assert.match(api, /createTemplate/);
  assert.match(api, /getTemplate/);
  assert.match(api, /\/lifecycle\/tasks\/\$\{id\}\/reopen/);
  assert.match(api, /\/lifecycle\/cases\/\$\{caseId\}\/finalise/);
});

test("lifecycle case detail wires clearance, exceptions, terminal payment, and finalise", () => {
  const page = readFileSync(join(webRoot, "app/(app)/lifecycle/cases/[id]/page.tsx"), "utf8");
  assert.match(page, /lifecycleApi\.updateClearance/);
  assert.match(page, /lifecycleApi\.requestException/);
  assert.match(page, /lifecycleApi\.approveException/);
  assert.match(page, /lifecycleApi\.reopenTask/);
  assert.match(page, /lifecycleApi\.assertTerminalPayment/);
  assert.match(page, /lifecycleApi\.approveTerminalPayment/);
  assert.match(page, /lifecycleApi\.finaliseSeparation/);
  assert.match(page, /lifecycle-clearance-status/);
  assert.match(page, /lifecycle-exception-reason/);
  assert.match(page, /lifecycle-finalise/);
  assert.match(page, /useConfirm/);
  assert.match(page, /hasPermission/);
  assert.match(page, /ClearanceEditor/);
  assert.match(page, /latestRevision|setLatestRevision/);
});

test("lifecycle my-tasks can complete and clear without leaving the queue", () => {
  const page = readFileSync(join(webRoot, "app/(app)/lifecycle/my-tasks/page.tsx"), "utf8");
  assert.match(page, /lifecycleApi\.completeTask/);
  assert.match(page, /lifecycleApi\.updateClearance/);
  assert.match(page, /lifecycle-my-task-complete/);
  assert.match(page, /lifecycle-my-task-clearance/);
  assert.match(page, /ClearanceEditor/);
  assert.match(page, /!clearance/);
});

test("lifecycle templates can clone a draft and publish it", () => {
  const page = readFileSync(join(webRoot, "app/(app)/lifecycle/admin/templates/page.tsx"), "utf8");
  assert.match(page, /lifecycleApi\.createTemplate/);
  assert.match(page, /lifecycleApi\.publishTemplate/);
  assert.match(page, /lifecycleApi\.getTemplate/);
  assert.match(page, /draft_version/);
  assert.match(page, /lifecycle-template-publish/);
  assert.match(page, /useConfirm/);
  assert.match(page, /Draft already open/);
});

test("audit findings create, issue, and never auto-close", () => {
  const page = readFileSync(join(webRoot, "app/(app)/audit/findings/page.tsx"), "utf8");
  assert.match(page, /ModulePageHeader/);
  assert.match(page, /auditApi\.createFinding/);
  assert.match(page, /auditApi\.issueFinding/);
  assert.match(page, /never auto-closes|Never auto-closes/);
  assert.match(page, /\/audit\/findings\/\$\{/);
  assert.match(page, /r\.redacted/);
});

test("audit finding detail supports respond and corrective actions", () => {
  const page = readFileSync(join(webRoot, "app/(app)/audit/findings/[id]/page.tsx"), "utf8");
  assert.match(page, /auditApi\.getFinding/);
  assert.match(page, /auditApi\.respondFinding/);
  assert.match(page, /auditApi\.createCorrective/);
  assert.match(page, /does not close the finding|does not close/);
  assert.match(page, /owner_user_id/);
  assert.match(page, /issued && canRespond|issued && canManageCa/);
});

test("audit corrective actions can complete and verify without auto-close", () => {
  const page = readFileSync(join(webRoot, "app/(app)/audit/corrective-actions/page.tsx"), "utf8");
  assert.match(page, /ModulePageHeader/);
  assert.match(page, /auditApi\.completeCorrective/);
  assert.match(page, /auditApi\.verifyCorrective/);
  assert.match(page, /does not close the finding/);
});

test("assignment handover pack picks from and to staff", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assignments/handover/page.tsx"), "utf8");
  assert.match(page, /tenantUsersApi\.list/);
  assert.match(page, /from_user_id/);
  assert.match(page, /to_user_id/);
  assert.match(page, /handover-from-user/);
  assert.match(page, /handover-to-user/);
  assert.match(page, /pack\.isError/);
});
