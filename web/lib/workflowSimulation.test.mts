import assert from "node:assert/strict";
import test from "node:test";
import { formatApplicablePath, parseSimulationResponse } from "./workflowSimulation.ts";

const projection = {
  module_type: "supplier",
  stages: [{ step_order: 0, applies: true, step_name: "Procurement Verification" }],
  applicable_path: [
    { step_order: 0, step_name: "Procurement Verification", stage_type: "verify" },
    { step_order: 1, step_name: "Finance/Compliance Verification", stage_type: "verify" },
    { step_order: 2, step_name: "Procurement Authorisation", stage_type: "authorise" },
  ],
  created_production_approval: false,
};

test("parseSimulationResponse reads Laravel model envelope", () => {
  const parsed = parseSimulationResponse({
    data: {
      id: 8,
      result: projection,
      created_production_approval: false,
    },
    created_production_approval: false,
  });
  assert.equal(parsed?.module_type, "supplier");
  assert.equal(parsed?.applicable_path?.length, 3);
});

test("parseSimulationResponse reads a double-nested data envelope", () => {
  const parsed = parseSimulationResponse({
    data: { data: { result: projection } },
  });
  assert.equal(parsed?.module_type, "supplier");
});

test("parseSimulationResponse reads a JSON-string result column", () => {
  const parsed = parseSimulationResponse({
    data: { id: 8, result: JSON.stringify(projection) },
  });
  assert.equal(parsed?.module_type, "supplier");
  assert.equal(parsed?.applicable_path?.length, 3);
});

test("parseSimulationResponse reads a top-level result flatten", () => {
  const parsed = parseSimulationResponse({
    data: { id: 8 },
    result: projection,
    created_production_approval: false,
  });
  assert.equal(parsed?.module_type, "supplier");
});

test("formatApplicablePath joins named stages", () => {
  assert.equal(
    formatApplicablePath(projection),
    "Procurement Verification → Finance/Compliance Verification → Procurement Authorisation",
  );
});
