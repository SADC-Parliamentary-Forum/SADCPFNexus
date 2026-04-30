"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:            { label: "Draft",           cls: "badge-muted"   },
  pending_review:   { label: "Pending Review",  cls: "badge-warning" },
  pending_approval: { label: "Pending Approval",cls: "badge-warning" },
  approved:         { label: "Approved",        cls: "badge-success" },
  sent:             { label: "Sent",            cls: "badge-success" },
  archived:         { label: "Archived",        cls: "badge-muted"   },
};

const typeLabel: Record<string, string> = {
  internal_memo: "Memo", external: "External",
  diplomatic_note: "Diplomatic", procurement: "Procurement",
};

function safeIsoDay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function CorrespondenceRegistryPage() {
  const [letters, setLetters] = useState<CorrespondenceLetter[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDir, setFilterDir] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: 25 };
    if (search) params.search = search;
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterType !== "all") params.type = filterType;
    if (filterDir !== "all") params.direction = filterDir;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    correspondenceApi
      .list(params)
      .then((res) => {
        setLetters(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, filterStatus, filterType, filterDir, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function clearFilters() {
    setSearch(""); setFilterStatus("all"); setFilterType("all");
    setFilterDir("all"); setDateFrom(""); setDateTo("");
    setPage(1);
  }

  function exportCsv() {
    const rows = [
      ["Reference", "Subject", "Type", "Direction", "Status", "Created By", "Date"],
      ...letters.map((l) => [
        l.reference_number ?? "",
        l.subject,
        typeLabel[l.type] ?? l.type,
        l.direction,
        l.status,
        l.creator?.name ?? "",
        safeIsoDay(l.created_at),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `correspondence-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <Link href="/correspondence" className="hover:text-neutral-700">Correspondence</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-900 font-medium">Registry</span>
          </div>
          <h1 className="page-title">Correspondence Registry</h1>
          <p className="page-subtitle">{total} record{total !== 1 ? "s" : ""} total</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={exportCsv} className="btn-secondary inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export CSV
          </button>
          <Link href="/correspondence/create" className="btn-primary inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Letter
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="form-input w-full"
              placeholder="Search reference, subject, title…"
            />
          </div>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="form-input">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_review">Pending Review</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="sent">Sent</option>
            <option value="archived">Archived</option>
          </select>
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="form-input">
            <option value="all">All types</option>
            <option value="external">External</option>
            <option value="internal_memo">Internal Memo</option>
            <option value="diplomatic_note">Diplomatic Note</option>
            <option value="procurement">Procurement</option>
          </select>
          <select value={filterDir} onChange={(e) => { setFilterDir(e.target.value); setPage(1); }} className="form-input">
            <option value="all">Both directions</option>
            <option value="outgoing">Outgoing</option>
            <option value="incoming">Incoming</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="form-input" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="form-input" title="To date" />
          {(search || filterStatus !== "all" || filterType !== "all" || filterDir !== "all" || dateFrom || dateTo) && (
            <button onClick={clearFilters} className="btn-secondary text-sm">Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Dir.</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j}><div className="h-4 w-24 animate-pulse rounded bg-neutral-100" /></td>
                    ))}
                  </tr>
                ))
              ) : letters.length > 0 ? (
                letters.map((l) => {
                  const s = statusConfig[l.status] ?? { label: l.status, cls: "badge-muted" };
                  return (
                    <tr key={l.id}>
                      <td className="font-mono text-xs text-primary">
                        {l.reference_number ?? <span className="text-neutral-400 italic">No ref</span>}
                      </td>
                      <td className="max-w-xs">
                        <p className="truncate text-sm font-medium text-neutral-900">{l.subject}</p>
                        <p className="text-xs text-neutral-400 truncate">{l.title}</p>
                      </td>
                      <td><span className="text-xs text-neutral-600">{typeLabel[l.type] ?? l.type}</span></td>
                      <td>
                        <span className={`text-xs font-medium ${l.direction === "outgoing" ? "text-blue-600" : "text-emerald-600"}`}>
                          {l.direction === "outgoing" ? "↑ Out" : "↓ In"}
                        </span>
                      </td>
                      <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      <td className="text-xs text-neutral-500">{l.creator?.name ?? "—"}</td>
                      <td className="text-xs text-neutral-400">{new Date(l.created_at).toLocaleDateString()}</td>
                      <td>
                        <Link href={`/correspondence/${l.id}`} className="text-xs font-semibold text-primary hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-neutral-400">
                    No correspondence found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">Page {page} of {lastPage}</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary text-xs py-1 px-2 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-xs py-1 px-2 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
