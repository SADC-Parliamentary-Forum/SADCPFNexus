/**
 * Pure helpers for procurement register multi-select bulk actions.
 * Keep side-effect free so unit tests can lock behaviour without React/DOM.
 */

export type ProcurementBulkRow = {
  id: number;
  status: string;
  reference_number: string;
  title: string;
  category: string;
  procurement_method: string;
  currency: string;
  estimated_value?: number | string | null;
  budget_line?: string | null;
  programme?: { reference_number?: string | null } | null;
  requester?: { name?: string | null } | null;
  submitted_at?: string | null;
  approved_at?: string | null;
};

export type ProcurementExportRow = {
  reference: string;
  title: string;
  category: string;
  method: string;
  status: string;
  currency: string;
  estimated_value: string | number;
  budget_line: string;
  pif: string;
  requester: string;
  submitted_at: string;
  approved_at: string;
};

export const PROCUREMENT_EXPORT_COLUMNS = [
  { key: "reference", header: "Reference" },
  { key: "title", header: "Title" },
  { key: "category", header: "Category" },
  { key: "method", header: "Method" },
  { key: "status", header: "Status" },
  { key: "currency", header: "Currency" },
  { key: "estimated_value", header: "Estimated Value" },
  { key: "budget_line", header: "Budget Line" },
  { key: "pif", header: "PIF Reference" },
  { key: "requester", header: "Requester" },
  { key: "submitted_at", header: "Submitted" },
  { key: "approved_at", header: "Approved" },
] as const;

function normalizeIds(selectedIds: Array<number | string>): Set<number> {
  const out = new Set<number>();
  for (const raw of selectedIds) {
    const id = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(id)) out.add(id);
  }
  return out;
}

/** Rows currently selected (any status). */
export function selectedProcurementRows<T extends { id: number }>(
  rows: T[],
  selectedIds: Array<number | string>,
): T[] {
  const ids = normalizeIds(selectedIds);
  return rows.filter((row) => ids.has(row.id));
}

/**
 * Draft request IDs eligible for bulk cancel (delete).
 * Non-draft selections are ignored — only drafts can be deleted via API.
 */
export function draftIdsForBulkCancel(
  rows: Array<{ id: number; status: string }>,
  selectedIds: Array<number | string>,
): number[] {
  const ids = normalizeIds(selectedIds);
  return rows
    .filter((row) => ids.has(row.id) && row.status === "draft")
    .map((row) => row.id);
}

export function buildProcurementExportRows(rows: ProcurementBulkRow[]): ProcurementExportRow[] {
  return rows.map((r) => ({
    reference: r.reference_number,
    title: r.title,
    category: r.category,
    method: r.procurement_method,
    status: r.status,
    currency: r.currency,
    estimated_value: r.estimated_value ?? "",
    budget_line: r.budget_line ?? "",
    pif: r.programme?.reference_number ?? "",
    requester: r.requester?.name ?? "",
    submitted_at: r.submitted_at ?? "",
    approved_at: r.approved_at ?? "",
  }));
}

export function canSelectProcurementRow(row: { status: string }): boolean {
  // All rows selectable for export; bulk cancel still filters to drafts only.
  return Boolean(row.status);
}
