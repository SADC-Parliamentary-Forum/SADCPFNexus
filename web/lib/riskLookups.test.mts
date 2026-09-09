import assert from "node:assert/strict";
import test from "node:test";
import {
  asOwnerOptions,
  mergeCurrentUserIntoOwners,
  validateRiskCreateForm,
  buildMitigationFormData,
  assertMitigationRiskIds,
} from "./riskLookups.ts";

test("assertMitigationRiskIds rejects empty and over-limit selections", () => {
  assert.equal(assertMitigationRiskIds([]), "risk.mitigation.noneSelected");
  assert.equal(assertMitigationRiskIds(Array.from({ length: 51 }, (_, i) => i + 1)), "risk.mitigation.tooMany");
  assert.equal(assertMitigationRiskIds([3, 8]), null);
});

test("asOwnerOptions reads Laravel { data: [] } owner lookups", () => {
  const rows = asOwnerOptions({
    data: [
      { id: 7, name: "Ada Lovelace", email: "ada@example.org" },
      { id: "9", name: "Grace Hopper", email: "grace@example.org" },
    ],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 7);
  assert.equal(rows[1].name, "Grace Hopper");
});

test("asOwnerOptions reads a bare array and skips invalid ids", () => {
  const rows = asOwnerOptions([
    { id: 1, name: "One" },
    { id: 0, name: "Nope" },
    { name: "Missing" },
  ]);
  assert.deepEqual(rows.map((r) => r.id), [1]);
});

test("mergeCurrentUserIntoOwners prepends the signed-in user when the directory is empty", () => {
  const merged = mergeCurrentUserIntoOwners([], { id: 42, name: "Me", email: "me@sadcpf.org" });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 42);
  assert.equal(merged[0].email, "me@sadcpf.org");
});

test("mergeCurrentUserIntoOwners does not duplicate the signed-in user", () => {
  const merged = mergeCurrentUserIntoOwners(
    [{ id: 42, name: "Me", email: "me@sadcpf.org" }],
    { id: 42, name: "Me", email: "me@sadcpf.org" },
  );
  assert.equal(merged.length, 1);
});

test("buildMitigationFormData appends risk ids and an optional file", () => {
  const file = new File(["plan"], "plan.txt", { type: "text/plain" });
  const form = buildMitigationFormData({
    riskIds: [3, 8],
    description: "Install backup generator",
    treatmentType: "mitigate",
    dueDate: "2026-09-30",
    file,
    documentType: "risk_mitigation_plan",
  });
  assert.deepEqual(form.getAll("risk_ids[]"), ["3", "8"]);
  assert.equal(form.get("description"), "Install backup generator");
  assert.equal(form.get("treatment_type"), "mitigate");
  assert.equal((form.get("file") as File).name, "plan.txt");
});

test("validateRiskCreateForm requires title, category and 1–5 scores before save", () => {
  const errors = validateRiskCreateForm({
    title: "  ",
    description: "",
    category: "",
    likelihood: 0,
    impact: 0,
    strategic_objective_id: "",
    risk_owner_id: "",
  });
  assert.ok(errors.title);
  assert.ok(errors.description);
  assert.ok(errors.category);
  assert.ok(errors.likelihood);
  assert.ok(errors.impact);
});

test("validateRiskCreateForm requires owner on submit but not a missing objective when none exist", () => {
  const draft = validateRiskCreateForm({
    title: "Budget overrun",
    description: "Spending exceeds ceiling",
    category: "financial",
    likelihood: 3,
    impact: 4,
    strategic_objective_id: "",
    risk_owner_id: "",
  });
  assert.deepEqual(draft, {});

  const submit = validateRiskCreateForm(
    {
      title: "Budget overrun",
      description: "Spending exceeds ceiling",
      category: "financial",
      likelihood: 3,
      impact: 4,
      strategic_objective_id: "",
      risk_owner_id: "",
    },
    { requireOwner: true, requireObjective: false },
  );
  assert.ok(submit.risk_owner_id);
  assert.equal(submit.strategic_objective_id, undefined);
});
