import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());
const apiRoot = join(process.cwd(), "..", "api");

test("workflow approve client sends confirm_password", () => {
  const source = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(source, /requires_signature\?: boolean/);
  assert.match(source, /confirm_password: confirmPassword/);
  assert.match(source, /decideTask:[\s\S]*confirm_password\?: string/);
});

test("SigningModal can approve a workflow step without a separate SAAM sign call", () => {
  const source = readFileSync(join(webRoot, "components/saam/SigningModal.tsx"), "utf8");
  assert.match(source, /onWorkflowApprove\?/);
  assert.match(
    source,
    /if \(onWorkflowApprove\) \{[\s\S]*?await onWorkflowApprove\([\s\S]*?return;/,
  );
});

test("approvals inbox opens the signing modal for requires_signature steps", () => {
  const source = readFileSync(join(webRoot, "app/(app)/approvals/page.tsx"), "utf8");
  assert.match(source, /stepRequiresSignature/);
  assert.match(source, /onWorkflowApprove/);
  assert.match(source, /workflowApi\.approve\([^)]*confirmPassword/);
});

test("email approval page blocks signing steps and points at Nexus", () => {
  const source = readFileSync(join(webRoot, "app/approval/page.tsx"), "utf8");
  assert.match(source, /requires_signature/);
  assert.match(source, /Open My Approvals/);
});

test("PIF detail uses workflow password sign rather than saamApi.signDocument", () => {
  const source = readFileSync(join(webRoot, "app/(app)/pif/[id]/page.tsx"), "utf8");
  assert.match(source, /onWorkflowApprove/);
  assert.match(source, /programmeApi\.approve/);
  assert.doesNotMatch(source, /saamApi\.signDocument/);
});

test("LPO seeder marks the SG signatory step as requiring a signature", () => {
  const source = readFileSync(join(apiRoot, "database/seeders/WorkflowSeeder.php"), "utf8");
  assert.match(
    source,
    /SG \/ Authorised Signatory[\s\S]*requires_signature' => true/,
  );
  assert.match(
    source,
    /Finance Certification[\s\S]*finance\.certify/,
  );
});
