import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProcurementExportRows,
  draftIdsForBulkCancel,
  selectedProcurementRows,
} from "./procurementRegisterBulk.ts";

const rows = [
  {
    id: 1,
    status: "draft",
    reference_number: "PR-1",
    title: "Draft chairs",
    category: "goods",
    procurement_method: "RFQ",
    currency: "NAD",
    estimated_value: 1000,
    budget_line: "B1",
    programme: { reference_number: "PIF-1" },
    requester: { name: "Ada" },
    submitted_at: null,
    approved_at: null,
  },
  {
    id: 2,
    status: "submitted",
    reference_number: "PR-2",
    title: "Submitted desks",
    category: "goods",
    procurement_method: "Tender",
    currency: "NAD",
    estimated_value: 5000,
    budget_line: null,
    programme: null,
    requester: { name: "Bob" },
    submitted_at: "2026-07-01",
    approved_at: null,
  },
  {
    id: 3,
    status: "draft",
    reference_number: "PR-3",
    title: "Other draft",
    category: "services",
    procurement_method: "RFQ",
    currency: "NAD",
    estimated_value: 200,
    budget_line: "",
    programme: null,
    requester: null,
    submitted_at: null,
    approved_at: null,
  },
];

describe("procurementRegisterBulk", () => {
  it("selectedProcurementRows returns only checked ids", () => {
    const selected = selectedProcurementRows(rows, [1, "2", 99]);
    assert.deepEqual(
      selected.map((r) => r.id),
      [1, 2],
    );
  });

  it("draftIdsForBulkCancel ignores non-drafts and unknown ids", () => {
    assert.deepEqual(draftIdsForBulkCancel(rows, [1, 2, 3, 99]), [1, 3]);
    assert.deepEqual(draftIdsForBulkCancel(rows, [2]), []);
    assert.deepEqual(draftIdsForBulkCancel(rows, []), []);
  });

  it("buildProcurementExportRows maps register fields for CSV", () => {
    const exportRows = buildProcurementExportRows(selectedProcurementRows(rows, [1, 2]));
    assert.equal(exportRows.length, 2);
    assert.deepEqual(exportRows[0], {
      reference: "PR-1",
      title: "Draft chairs",
      category: "goods",
      method: "RFQ",
      status: "draft",
      currency: "NAD",
      estimated_value: 1000,
      budget_line: "B1",
      pif: "PIF-1",
      requester: "Ada",
      submitted_at: "",
      approved_at: "",
    });
    assert.equal(exportRows[1].pif, "");
    assert.equal(exportRows[1].submitted_at, "2026-07-01");
  });
});
