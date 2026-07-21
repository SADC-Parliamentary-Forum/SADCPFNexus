#!/usr/bin/env node
import fs from "node:fs";

const workflows = [
  { module: "leave", sequence: ["requester", "hod", "hr_admin", "secretary_general"] },
  { module: "salary_advance", sequence: ["requester", "finance", "senior_approver"] },
  { module: "travel", sequence: ["traveller", "hod", "admin_logistics", "finance_dsa", "director_finance", "secretary_general"] },
  { module: "pif", sequence: ["programme_officer", "programme_manager", "activity_authoriser", "project_accountant", "director_finance", "secretary_general"] },
  { module: "procurement", sequence: ["requester", "budget_verification", "hod", "procurement", "evaluation", "award", "lpo", "grn", "invoice", "finance_payment"] },
];

const invariants = [
  "requester_cannot_self_approve",
  "strict_sequential_approval",
  "next_approver_notification_only",
  "no_step_skip",
  "reject_stops_workflow",
  "return_for_correction_restarts_correct_step",
  "immutable_audit_trail",
  "final_approval_record_lock",
];

const rows = [];
for (const wf of workflows) {
  for (let i = 0; i < wf.sequence.length; i += 1) {
    rows.push({
      module: wf.module,
      step_order: i + 1,
      step_actor: wf.sequence[i],
      next_actor: wf.sequence[i + 1] || "end",
      invariants: Object.fromEntries(invariants.map((x) => [x, "required"])),
    });
  }
}

const header = ["module", "step_order", "step_actor", "next_actor", ...invariants].join(",");
const csvRows = rows.map((r) => [
  r.module,
  r.step_order,
  r.step_actor,
  r.next_actor,
  ...invariants.map((x) => r.invariants[x]),
].join(","));

fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/workflow-sequencing-matrix.json", JSON.stringify({ generated_at: new Date().toISOString(), invariants, rows }, null, 2));
fs.writeFileSync("artifacts/workflow-sequencing-matrix.csv", [header, ...csvRows].join("\n"));

console.log(`Generated workflow sequencing matrix rows: ${rows.length}`);
