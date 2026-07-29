"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { procurementApi, type ProcurementRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft: { label: "Draft", badge: "badge-muted" },
  submitted: { label: "Submitted", badge: "badge-warning" },
  approved: { label: "Approved", badge: "badge-success" },
  rejected: { label: "Rejected", badge: "badge-danger" },
  cancelled: { label: "Cancelled", badge: "badge-muted" },
  awarded: { label: "Awarded", badge: "badge-success" },
  in_progress: { label: "In progress", badge: "badge-primary" },
  completed: { label: "Completed", badge: "badge-success" },
  returned_for_correction: { label: "Returned", badge: "badge-warning" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "awarded", label: "Awarded" },
  { key: "completed", label: "Completed" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function getListData(payload: unknown): ProcurementRequest[] {
  if (Array.isArray(payload)) return payload as ProcurementRequest[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as ProcurementRequest[];
  }
  return [];
}

export default function ProcurementRegisterPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["procurement", "register"],
    queryFn: () => procurementApi.list({ per_page: 500 }).then((res) => getListData(res.data)),
    staleTime: 30_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.title,
        row.category,
        row.procurement_method,
        row.status,
        row.budget_line,
        row.programme?.reference_number,
        row.requester?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, search]);

  const pageCount = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, pageCount), DEFAULT_PAGE_SIZE),
    [filtered, page, pageCount],
  );

  const stats = useMemo(
    () => ({
      total: rows.length,
      submitted: rows.filter((r) => r.status === "submitted").length,
      approved: rows.filter((r) => r.status === "approved" || r.status === "awarded").length,
      drafts: rows.filter((r) => r.status === "draft").length,
    }),
    [rows],
  );

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `procurement-register-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        title: r.title,
        category: r.category,
        method: r.procurement_method,
        status: r.status,
        currency: r.currency,
        estimated_value: r.estimated_value,
        budget_line: r.budget_line ?? "",
        pif: r.programme?.reference_number ?? "",
        requester: r.requester?.name ?? "",
        submitted_at: r.submitted_at ?? "",
        approved_at: r.approved_at ?? "",
      })),
      [
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
      ],
    );
  };

  return (
    <RegisterShell
      title="Procurement Register"
      subtitle="Full tenant register of procurement requests."
      breadcrumbs={
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Link href="/procurement" className="transition-colors hover:text-neutral-700">
            Procurement
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700">Register</span>
        </div>
      }
      actions={
        <>
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/procurement/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New request
          </Link>
        </>
      }
      density={density}
      onDensityChange={setDensity}
      page={Math.min(page, pageCount)}
      pageCount={pageCount}
      total={filtered.length}
      onPageChange={setPage}
      loading={isLoading}
      stats={
        <>
          {isError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="material-symbols-outlined text-[16px]">error_outline</span>
              <span className="flex-1">Failed to load register.</span>
              <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
                Retry
              </button>
            </div>
          ) : null}
          {!isLoading && rows.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Register rows", value: stats.total, icon: "menu_book", color: "text-primary", bg: "bg-primary/10" },
                { label: "Submitted", value: stats.submitted, icon: "pending_actions", color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Approved / Awarded", value: stats.approved, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
                { label: "Drafts", value: stats.drafts, icon: "edit_note", color: "text-neutral-600", bg: "bg-neutral-100" },
              ].map((s) => (
                <div key={s.label} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-500">{s.label}</p>
                      <p className="mt-0.5 text-lg font-bold text-neutral-900">{s.value}</p>
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                      <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      }
      filters={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder="Search reference, title, PIF, requester…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setFilter(tab.key);
                  setPage(1);
                }}
                className={`filter-tab ${filter === tab.key ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
      empty={
        !isLoading && filtered.length === 0 ? (
          <div className="card px-5 py-16 text-center">
            <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">shopping_cart</span>
            <p className="text-sm font-semibold text-neutral-600">No procurement requests found</p>
            <p className="mt-1 text-xs text-neutral-400">
              {rows.length === 0
                ? "No procurement requests recorded yet."
                : "No rows match the current filters."}
            </p>
          </div>
        ) : null
      }
    >
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
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
              {paged.map((row) => {
                const sc = STATUS_CONFIG[row.status] ?? {
                  label: row.status.replace(/_/g, " "),
                  badge: "badge-muted",
                };
                return (
                  <tr key={row.id}>
                    <td className="font-mono text-xs">{row.reference_number}</td>
                    <td className="max-w-xs truncate font-medium">{row.title}</td>
                    <td className="text-xs capitalize">{row.category}</td>
                    <td className="text-xs">{row.procurement_method}</td>
                    <td>
                      <span className={`badge text-xs capitalize ${sc.badge}`}>{sc.label}</span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-sm">
                      {row.currency} {Number(row.estimated_value ?? 0).toLocaleString()}
                    </td>
                    <td className="font-mono text-xs">{row.programme?.reference_number ?? "—"}</td>
                    <td className="text-xs text-neutral-500">
                      {row.submitted_at ? formatDateShort(row.submitted_at) : "—"}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/procurement/${row.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                        {row.status === "draft" && (
                          <Link
                            href={`/procurement/${row.id}`}
                            className="text-xs font-medium text-neutral-600 hover:underline"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </RegisterShell>
  );
}
