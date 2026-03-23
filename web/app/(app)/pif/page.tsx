"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { programmeApi, type Programme } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  draft:              "badge-muted",
  submitted:          "badge-warning",
  approved:           "badge-primary",
  active:             "badge-success",
  on_hold:            "badge-warning",
  completed:          "badge-success",
  financially_closed: "badge-muted",
  archived:           "badge-muted",
};

const STATUS_LABELS = ["All", "draft", "submitted", "approved", "active", "on_hold", "completed"];

function SkeletonRow() {
  return (
    <tr>
      {[1,2,3,4,5,6,7,8].map((i) => (
        <td key={i}><div className="h-4 bg-neutral-100 rounded animate-pulse w-full max-w-[120px]" /></td>
      ))}
    </tr>
  );
}

export default function PifPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  useEffect(() => {
    setLoading(true);
    setError(null);
    programmeApi.list({
      ...(filterStatus !== "All" && { status: filterStatus }),
      ...(search && { search }),
    })
      .then((r) => setProgrammes((r.data as any).data))
      .catch(() => setError("Failed to load programmes."))
      .finally(() => setLoading(false));
  }, [filterStatus, search]);

  const stats = ["active", "submitted", "completed", "on_hold"].map((s) => ({
    status: s,
    count: programmes.filter((p) => p.status === s).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Programmes</h1>
          <p className="page-subtitle">Programme Implementation Framework — manage and track all funded programmes.</p>
        </div>
        <Link href="/pif/create" className="btn-primary px-4 py-2 text-sm flex items-center gap-2 self-start">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>add</span>
          New Programme
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map(({ status, count }) => (
          <div key={status} className="card p-4 text-center">
            <p className="text-2xl font-bold text-neutral-900">{loading ? "—" : count}</p>
            <p className="text-xs text-neutral-500 mt-0.5 capitalize">{status.replace("_", " ")}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" style={{ fontSize: "20px" }}>search</span>
          <input
            type="search"
            placeholder="Search programmes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_LABELS.map((s) => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className={`filter-tab capitalize ${filterStatus === s ? "active" : ""}`}>
              {s === "All" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {!loading && programmes.length === 0 && !error ? (
          <div className="min-h-[200px] flex flex-col items-center justify-center gap-2 py-12">
            <span className="material-symbols-outlined text-5xl text-neutral-200">account_tree</span>
            <p className="text-sm font-medium text-neutral-500">No programmes found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Funding Source</th>
                  <th>Budget</th>
                  <th>Responsible</th>
                  <th>End Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  : programmes.map((p) => (
                      <tr key={p.id}>
                        <td className="font-mono text-xs text-neutral-600">{p.reference_number}</td>
                        <td className="font-medium text-neutral-900 max-w-[220px]">
                          <p className="truncate">{p.title}</p>
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[p.status] ?? "badge-muted"} capitalize`}>
                            {p.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="text-neutral-600">{p.funding_source || "—"}</td>
                        <td className="text-neutral-700 font-medium">
                          {p.primary_currency} {p.total_budget.toLocaleString()}
                        </td>
                        <td className="text-neutral-600">{p.responsible_officer || "—"}</td>
                        <td className="text-neutral-500 text-xs">{formatDateShort(p.end_date) ?? "—"}</td>
                        <td>
                          <Link href={`/pif/${p.id}`} className="text-primary hover:underline text-xs font-medium">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
