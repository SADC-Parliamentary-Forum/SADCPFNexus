"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { parliamentsApi, type Parliament } from "@/lib/api";

export default function ParliamentsPage() {
  const [parliaments, setParliaments] = useState<Parliament[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [lastPage, setLastPage]       = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    parliamentsApi
      .list({ search: search || undefined, per_page: 20, page })
      .then((res) => {
        setParliaments(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
      })
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Member State Parliaments</h1>
          <p className="page-subtitle">SADC member state parliaments where researchers are or can be deployed.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">search</span>
          <input
            className="form-input pl-9"
            placeholder="Search parliaments…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <p className="text-sm text-neutral-500 ml-auto">{total} parliament{total !== 1 ? "s" : ""}</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Parliament</th>
              <th>Country</th>
              <th>City</th>
              <th>Active Deployments</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j}><div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4" /></td>
                    ))}
                  </tr>
                ))
              : parliaments.length === 0
              ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-neutral-400 text-sm">
                      No parliaments found.
                    </td>
                  </tr>
                )
              : parliaments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-medium text-neutral-900 text-sm">{p.name}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                          {p.country_code}
                        </span>
                        <span className="text-sm text-neutral-700">{p.country_name}</span>
                      </div>
                    </td>
                    <td className="text-sm text-neutral-600">{p.city ?? "—"}</td>
                    <td>
                      {(p.active_deployments_count ?? 0) > 0 ? (
                        <span className="badge badge-success">{p.active_deployments_count} active</span>
                      ) : (
                        <span className="text-sm text-neutral-400">None</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${p.is_active ? "badge-success" : "badge-muted"}`}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/srhr/parliaments/${p.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-xs text-neutral-500">Page {page} of {lastPage}</span>
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
