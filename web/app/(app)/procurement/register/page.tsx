"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { procurementApi, type ProcurementRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

function getListData(payload: unknown): ProcurementRequest[] {
  if (Array.isArray(payload)) return payload as ProcurementRequest[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as ProcurementRequest[];
  }
  return [];
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv(rows: ProcurementRequest[]) {
  const headers = [
    "Reference",
    "Title",
    "Category",
    "Method",
    "Status",
    "Currency",
    "Estimated Value",
    "Budget Line",
    "PIF Reference",
    "Requester",
    "Submitted",
    "Approved",
  ];
  const lines = rows.map((r) =>
    [
      r.reference_number,
      r.title,
      r.category,
      r.procurement_method,
      r.status,
      r.currency,
      r.estimated_value,
      r.budget_line ?? "",
      r.programme?.reference_number ?? "",
      r.requester?.name ?? "",
      r.submitted_at ?? "",
      r.approved_at ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `procurement-register-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProcurementRegisterPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "register"],
    queryFn: () =>
      procurementApi.list({ per_page: 500 }).then((res) => getListData<ProcurementRequest>(res.data)),
    staleTime: 30_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Procurement Register</h1>
          <p className="page-subtitle">Full tenant register of procurement requests.</p>
        </div>
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 text-sm"
          disabled={rows.length === 0}
          onClick={() => exportCsv(rows)}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export CSV
        </button>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load register.
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-neutral-400">No procurement requests recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Category</th>
                <th>Method</th>
                <th>Status</th>
                <th>Value</th>
                <th>PIF</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.reference_number}</td>
                  <td className="font-medium max-w-xs truncate">{row.title}</td>
                  <td className="text-xs capitalize">{row.category}</td>
                  <td className="text-xs">{row.procurement_method}</td>
                  <td>
                    <span className="badge badge-muted capitalize">{row.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="font-mono text-sm whitespace-nowrap">
                    {row.currency} {Number(row.estimated_value ?? 0).toLocaleString()}
                  </td>
                  <td className="font-mono text-xs">{row.programme?.reference_number ?? "—"}</td>
                  <td className="text-xs text-neutral-500">
                    {row.submitted_at ? formatDateShort(row.submitted_at) : "—"}
                  </td>
                  <td>
                    <Link href={`/procurement/${row.id}`} className="text-primary text-xs hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
