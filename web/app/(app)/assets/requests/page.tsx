"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { assetRequestsApi, type AssetRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending:  { label: "Pending",  badge: "badge-warning" },
  approved: { label: "Approved", badge: "badge-success" },
  rejected: { label: "Rejected", badge: "badge-danger" },
};

function padId(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

const FILTER_TABS = ["all", "pending", "approved", "rejected"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

export default function AssetRequestsPage() {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await assetRequestsApi.list({ per_page: 15, page: pg });
      const data = (res.data as any).data ?? res.data;
      setRequests(Array.isArray(data) ? data : []);
      setLastPage((res.data as any).last_page ?? 1);
      setPage(pg);
    } catch {
      setError("Failed to load asset requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered =
    filter === "all"
      ? requests
      : requests.filter((r) => r.status === filter);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
            <Link href="/assets" className="hover:text-neutral-700 transition-colors">Assets</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Requests</span>
          </div>
          <h1 className="page-title">Asset Requests</h1>
          <p className="page-subtitle">Submit and track requests for new or replacement assets.</p>
        </div>
        <Link
          href="/assets/requests/new"
          className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New request
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`filter-tab capitalize${filter === tab ? " active" : ""}`}
          >
            {tab === "all" ? "All" : (STATUS_CONFIG[tab]?.label ?? tab)}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[28px] text-primary">inventory_2</span>
          </div>
          <p className="text-sm font-semibold text-neutral-700">No asset requests found</p>
          <p className="text-xs text-neutral-500 mt-1">
            {filter !== "all"
              ? "No requests match the selected filter."
              : "You have not submitted any asset requests yet."}
          </p>
          <Link
            href="/assets/requests/new"
            className="btn-primary inline-flex items-center gap-2 mt-5 py-2 px-4 text-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New request
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Requester</th>
                  <th>Justification</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => {
                  const sc = STATUS_CONFIG[req.status] ?? { label: req.status, badge: "badge-muted" };
                  return (
                    <tr key={req.id}>
                      <td className="font-mono text-xs text-neutral-600 whitespace-nowrap">
                        {padId(req.id)}
                      </td>
                      <td className="font-medium text-neutral-900 whitespace-nowrap">
                        {req.requester?.name ?? "—"}
                      </td>
                      <td className="text-neutral-600 max-w-[260px] truncate">
                        {req.justification}
                      </td>
                      <td>
                        <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                      </td>
                      <td className="text-neutral-500 whitespace-nowrap text-xs">
                        {formatDate(req.created_at)}
                      </td>
                      <td>
                        <Link
                          href={`/assets/requests/${req.id}`}
                          className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
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

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
              <p className="text-xs text-neutral-500">Page {page} of {lastPage}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => load(page - 1)}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= lastPage}
                  onClick={() => load(page + 1)}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
