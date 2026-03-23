"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { performanceTrackerApi, type PerformanceTracker } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  excellent: "Excellent",
  strong: "Strong",
  satisfactory: "Satisfactory",
  watchlist: "Watchlist",
  at_risk: "At Risk",
  critical_review_required: "Critical Review Required",
};

const STATUS_CLS: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 border-green-200",
  strong: "bg-primary/10 text-primary border-primary/20",
  satisfactory: "bg-neutral-100 text-neutral-700 border-neutral-200",
  watchlist: "bg-amber-100 text-amber-800 border-amber-200",
  at_risk: "bg-orange-100 text-orange-800 border-orange-200",
  critical_review_required: "bg-red-100 text-red-800 border-red-200",
};

const TREND_LABELS: Record<string, string> = {
  improving: "Improving",
  stable: "Stable",
  declining: "Declining",
  inconsistent: "Inconsistent",
  insufficient_data: "Insufficient Data",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PerformanceTrackerPage() {
  const [overview, setOverview] = useState<{
    status_counts: Record<string, number>;
    watchlist: PerformanceTracker[];
    attention_required: PerformanceTracker[];
  } | null>(null);
  const [list, setList] = useState<PerformanceTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [overviewError, setOverviewError] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await performanceTrackerApi.overview();
      setOverview(res.data);
      setOverviewError(false);
    } catch {
      setOverviewError(true);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter ? { status: statusFilter, per_page: 50 } : { per_page: 50 };
      const res = await performanceTrackerApi.list(params);
      const data = (res.data as { data?: PerformanceTracker[] }).data ?? [];
      setList(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load performance trackers.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
            HR
          </Link>
          <h1 className="page-title">Performance Tracker</h1>
          <p className="page-subtitle">
            Live view of employee performance trends, task completion, and attention flags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/hr/performance/team" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
            <span className="material-symbols-outlined text-[18px]">group</span>
            My Team
          </Link>
          <Link href="/hr/performance/hr-dashboard" className="btn-primary flex items-center gap-2 py-2 px-3 text-sm">
            <span className="material-symbols-outlined text-[18px]">insights</span>
            HR Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Overview (HR/admin) — only when overview succeeds */}
      {overview && !overviewError && (
        <>
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">insights</span>
              Status distribution
            </h2>
            <div className="flex flex-wrap gap-3">
              {["excellent", "strong", "satisfactory", "watchlist", "at_risk", "critical_review_required"].map(
                (status) => {
                  const count = overview.status_counts?.[status] ?? 0;
                  return (
                    <div
                      key={status}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${STATUS_CLS[status] ?? "bg-neutral-100 text-neutral-700"}`}
                    >
                      <span className="font-medium">{STATUS_LABELS[status] ?? status}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {(overview.watchlist?.length > 0 || overview.attention_required?.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {overview.watchlist?.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="card-header flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900">Watchlist / At risk</h3>
                    <span className="badge badge-warning">{overview.watchlist.length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {overview.watchlist.slice(0, 10).map((t) => (
                      <Link
                        key={t.id}
                        href={`/hr/performance/${t.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors"
                      >
                        <span className="text-sm font-medium text-neutral-900">
                          {t.employee?.name ?? `Employee #${t.employee_id}`}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CLS[t.status] ?? ""}`}>
                          {STATUS_LABELS[t.status] ?? t.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {overview.attention_required?.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="card-header flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900">HR attention required</h3>
                    <span className="badge badge-danger">{overview.attention_required.length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {overview.attention_required.slice(0, 10).map((t) => (
                      <Link
                        key={t.id}
                        href={`/hr/performance/${t.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors"
                      >
                        <span className="text-sm font-medium text-neutral-900">
                          {t.employee?.name ?? `Employee #${t.employee_id}`}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatDate(t.cycle_start)} – {formatDate(t.cycle_end)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</span>
        <select
          className="form-input max-w-[200px] py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Performance trackers</h3>
          <Link href="/hr" className="text-xs font-semibold text-primary hover:underline">
            Back to HR
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">trending_up</span>
            <p className="mt-3 text-sm text-neutral-500">No performance trackers found.</p>
            <p className="text-xs text-neutral-400 mt-1">
              {statusFilter ? "Try a different status filter." : "Trackers will appear here when created."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Cycle</th>
                  <th>Status</th>
                  <th>Trend</th>
                  <th>Completion</th>
                  <th>Overdue</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-neutral-900">
                      {t.employee?.name ?? `#${t.employee_id}`}
                    </td>
                    <td className="text-neutral-600 text-sm whitespace-nowrap">
                      {formatDate(t.cycle_start)} – {formatDate(t.cycle_end)}
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLS[t.status] ?? "bg-neutral-100"}`}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="text-sm text-neutral-600">
                      {TREND_LABELS[t.trend] ?? t.trend}
                    </td>
                    <td className="text-sm">
                      {t.assignment_completion_rate != null ? `${t.assignment_completion_rate}%` : "—"}
                    </td>
                    <td className="text-sm">{t.overdue_task_count}</td>
                    <td className="text-right">
                      <Link
                        href={`/hr/performance/${t.id}`}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        View profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
