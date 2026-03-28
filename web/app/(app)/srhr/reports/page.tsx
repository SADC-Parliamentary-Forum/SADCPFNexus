"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { researcherReportsApi, type ResearcherReport } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Draft",              cls: "badge-muted"    },
  submitted:          { label: "Submitted",          cls: "badge-primary"  },
  acknowledged:       { label: "Acknowledged",       cls: "badge-success"  },
  revision_requested: { label: "Revision Requested", cls: "badge-warning"  },
  archived:           { label: "Archived",           cls: "badge-muted"    },
};

const typeLabel: Record<string, string> = {
  monthly:   "Monthly",
  quarterly: "Quarterly",
  annual:    "Annual",
  ad_hoc:    "Ad Hoc",
};

const FILTERS = [
  { label: "All",        value: "" },
  { label: "Draft",      value: "draft" },
  { label: "Submitted",  value: "submitted" },
  { label: "Acknowledged", value: "acknowledged" },
  { label: "Revision",   value: "revision_requested" },
];

export default function ResearcherReportsPage() {
  const [reports, setReports] = useState<ResearcherReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState("");
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    researcherReportsApi
      .list({ status: status || undefined, search: search || undefined, per_page: 20, page })
      .then((res) => {
        setReports(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
      })
      .finally(() => setLoading(false));
  }, [status, search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Activity Reports</h1>
          <p className="page-subtitle">Periodic activity reports submitted by SRHR researchers.</p>
        </div>
        <Link href="/srhr/reports/new" className="btn-primary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add_notes</span>
          Submit Report
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
              className={`filter-tab${status === f.value ? " active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">search</span>
          <input
            className="form-input pl-9 w-56"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <p className="text-sm text-neutral-500">{total} report{total !== 1 ? "s" : ""}</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Title</th>
              <th>Researcher</th>
              <th>Parliament</th>
              <th>Type</th>
              <th>Period</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}><div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4" /></td>
                    ))}
                  </tr>
                ))
              : reports.length === 0
              ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-neutral-400 text-sm">No reports found.</td>
                  </tr>
                )
              : reports.map((r) => (
                  <tr key={r.id}>
                    <td><span className="font-mono text-xs text-neutral-600">{r.reference_number}</span></td>
                    <td>
                      <p className="text-sm font-medium text-neutral-900 max-w-xs truncate">{r.title}</p>
                    </td>
                    <td className="text-sm text-neutral-700">{r.employee?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{r.parliament?.country_name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{typeLabel[r.report_type] ?? r.report_type}</td>
                    <td className="text-sm text-neutral-500 whitespace-nowrap">
                      {formatDate(r.period_start)} – {formatDate(r.period_end)}
                    </td>
                    <td>
                      <span className={`badge ${statusConfig[r.status]?.cls ?? "badge-muted"}`}>
                        {statusConfig[r.status]?.label ?? r.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/srhr/reports/${r.id}`} className="text-xs text-primary hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn-secondary text-xs px-3 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-xs text-neutral-500">Page {page} of {lastPage}</span>
          <button className="btn-secondary text-xs px-3 py-1.5" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
