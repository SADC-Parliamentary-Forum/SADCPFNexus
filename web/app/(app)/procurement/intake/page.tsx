"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { procurementApi, type ProcurementRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft: { label: "Draft", badge: "badge-muted" },
  submitted: { label: "Submitted", badge: "badge-warning" },
  approved: { label: "Approved", badge: "badge-success" },
  rejected: { label: "Rejected", badge: "badge-danger" },
  cancelled: { label: "Cancelled", badge: "badge-muted" },
  awarded: { label: "Awarded", badge: "badge-success" },
  in_progress: { label: "In progress", badge: "badge-primary" },
  completed: { label: "Completed", badge: "badge-success" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
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

export default function ProcurementIntakePage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["procurement", "intake"],
    queryFn: () =>
      procurementApi.list({ has_programme: 1, per_page: 100 }).then((res) => getListData(res.data)),
    staleTime: 20_000,
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.title,
        row.status,
        row.programme?.reference_number,
        row.programme?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, search]);

  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [filtered, page, lastPage],
  );

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `procurement-intake-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        title: r.title,
        status: r.status,
        pif: r.programme?.reference_number ?? "",
        value: r.estimated_value,
        currency: r.currency,
        submitted_at: r.submitted_at ?? "",
      })),
      [
        { key: "reference", header: "Reference" },
        { key: "title", header: "Title" },
        { key: "status", header: "Status" },
        { key: "pif", header: "PIF" },
        { key: "currency", header: "Currency" },
        { key: "value", header: "Value" },
        { key: "submitted_at", header: "Submitted" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/procurement" className="transition-colors hover:text-neutral-700">
              Procurement
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Intake</span>
          </div>
          <h1 className="page-title">Procurement Intake</h1>
          <p className="page-subtitle">
            PIF-linked procurement packages transferred from approved programmes.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-50"
          disabled={filtered.length === 0}
          onClick={handleExport}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export CSV
        </button>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">Failed to load intake queue.</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Intake packages", value: rows.length, icon: "inbox", color: "text-primary", bg: "bg-primary/10" },
            {
              label: "Matching filter",
              value: filtered.length,
              icon: "filter_alt",
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "Drafts",
              value: rows.filter((r) => r.status === "draft").length,
              icon: "edit_note",
              color: "text-neutral-600",
              bg: "bg-neutral-100",
            },
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
      )}

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder="Search reference, title, PIF…"
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
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">inbox</span>
            <p className="text-sm font-semibold text-neutral-600">
              {rows.length === 0 ? "No PIF-linked requests yet" : "No matches for your filters"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-neutral-400">
              {rows.length === 0
                ? "Use the Procurement tab on an approved programme to batch selected items into one request. One transfer creates one package; send a subset again if you need separate lots."
                : "Try a different search or status filter."}
            </p>
            {rows.length === 0 && (
              <Link href="/pif" className="btn-secondary mt-4 inline-flex text-sm">
                Browse Programmes
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>PIF</th>
                  <th>Status</th>
                  <th>Value</th>
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
                      <td className="max-w-sm font-medium text-neutral-900">
                        <span className="line-clamp-2">{row.title}</span>
                      </td>
                      <td className="text-xs">
                        {row.programme ? (
                          <Link
                            href={`/pif/${row.programme.id}`}
                            className="font-mono text-primary hover:underline"
                          >
                            {row.programme.reference_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className={`badge text-xs capitalize ${sc.badge}`}>{sc.label}</span>
                      </td>
                      <td className="whitespace-nowrap font-mono text-sm">
                        {row.currency} {Number(row.estimated_value ?? 0).toLocaleString()}
                      </td>
                      <td className="text-xs text-neutral-500">
                        {row.submitted_at ? formatDateShort(row.submitted_at) : "—"}
                      </td>
                      <td>
                        <Link
                          href={`/procurement/${row.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && filtered.length > 0 && (
          <ListPagination
            page={Math.min(page, lastPage)}
            lastPage={lastPage}
            total={filtered.length}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
