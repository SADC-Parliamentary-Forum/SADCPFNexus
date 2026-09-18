import assert from "node:assert/strict";
import test from "node:test";
import { formatAssigneeLabel, assigneeDepartmentName } from "./asset-assignee.ts";

test("formatAssigneeLabel joins full name, email and department", () => {
  assert.equal(
    formatAssigneeLabel({ name: "Unaro Mungendje", email: "unaro@sadcpf.org", department: "ICT" }),
    "Unaro Mungendje · unaro@sadcpf.org · ICT",
  );
  assert.equal(
    formatAssigneeLabel({ name: "Boemo Sekgoma", email: "sg@sadcpf.org", department: { name: "Office of the SG" } }),
    "Boemo Sekgoma · sg@sadcpf.org · Office of the SG",
  );
  assert.equal(formatAssigneeLabel({ name: "Shared store" }), "Shared store");
});

test("assigneeDepartmentName reads string or nested department", () => {
  assert.equal(assigneeDepartmentName({ department: "ICT" }), "ICT");
  assert.equal(assigneeDepartmentName({ department: { name: "HR" } }), "HR");
  assert.equal(assigneeDepartmentName({}), null);
});
