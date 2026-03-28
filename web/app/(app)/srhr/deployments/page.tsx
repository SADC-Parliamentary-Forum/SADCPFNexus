"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { deploymentsApi, type StaffDeployment } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "badge-success" },
  completed: { label: "Completed", cls: "badge-muted"   },
  recalled:  { label: "Recalled",  cls: "badge-danger"  },
  suspended: { label: "Suspended", cls: "badge-warning" },
};

const typeLabel: Record<string, string> = {
  field_researcher: "Field Researcher",
  srhr_researcher:  "Field Researcher", // legacy label
  secondment:       "Secondment",
  other:            "Other",
};

const FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Recalled", value: "recalled" },
];

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<StaffDeployment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [status, setStatus]           = useState("");
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [lastPage, setLastPage]       = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    deploymentsApi
      .list({ status: status || undefined, search: search || undefined, per_page: 20, page })
      .then((res) => {
        setDeployments(res.data.data ?? []);
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
          <h1 className="page-title">Field Deployments</h1>
          <p className="page-subtitle">Track SRHR researcher deployments at member state parliaments.</p>
        </div>
        <Link href="/srhr/deployments/new" className="btn-primary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Deployment
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
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
        <p className="text-sm text-neutral-500">{total} deployment{total !== 1 ? "s" : ""}</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Researcher</th>
              <th>Parliament</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
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
              : deployments.length === 0
              ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-neutral-400 text-sm">
                      No deployments found.
                    </td>
                  </tr>
                )
              : deployments.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="font-mono text-xs text-neutral-600">{d.reference_number}</span>
                    </td>
                    <td>
                      <p className="font-medium text-sm text-neutral-900">{d.employee?.name ?? "—"}</p>
                      <p className="text-xs text-neutral-500">{d.employee?.email}</p>
                    </td>
                    <td className="text-sm text-neutral-700">{d.parliament?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{typeLabel[d.deployment_type] ?? d.deployment_type}</td>
                    <td className="text-sm text-neutral-700">{formatDate(d.start_date)}</td>
                    <td className="text-sm text-neutral-500">{d.end_date ? formatDate(d.end_date) : "Open"}</td>
                    <td>
                      <span className={`badge ${statusConfig[d.status]?.cls ?? "badge-muted"}`}>
                        {statusConfig[d.status]?.label ?? d.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/srhr/deployments/${d.id}`} className="text-xs text-primary hover:underline">
                        View
                      </Link>
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
