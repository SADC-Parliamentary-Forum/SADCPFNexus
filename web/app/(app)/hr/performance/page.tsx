"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { performanceTrackerApi, type PerformanceTracker } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_LABELS: Record<string, string> = {
  excellent: "hr.performance.status.excellent",
  strong: "hr.performance.status.strong",
  satisfactory: "hr.performance.status.satisfactory",
  watchlist: "hr.performance.status.watchlist",
  at_risk: "hr.performance.status.at_risk",
  critical_review_required: "hr.performance.status.critical_review_required",
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
  improving: "hr.performance.trend.improving",
  stable: "hr.performance.trend.stable",
  declining: "hr.performance.trend.declining",
  inconsistent: "hr.performance.trend.inconsistent",
  insufficient_data: "hr.performance.trend.insufficient_data",
};

function formatDate(d: string, localeTag: string) {
  return new Date(d).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" });
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
  const { t, localeTag } = useI18n();

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
      setError(t("hr.performance.list.loadFailed"));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("hr.performance.list.title")}
        subtitle={t("hr.performance.list.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.hr", href: "/hr" }, { label: "hr.performance.list.crumb" }]} />}
        actions={
          <>
          <Link href="/hr/performance/team" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
            <span className="material-symbols-outlined text-[18px]">group</span>
            {t("hr.performance.list.myTeam")}
          </Link>
          <Link href="/hr/performance/hr-dashboard" className="btn-primary flex items-center gap-2 py-2 px-3 text-sm">
            <span className="material-symbols-outlined text-[18px]">insights</span>
            {t("hr.performance.list.hrDashboard")}
          </Link>
          </>
        }
      />

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
              {t("hr.performance.list.distribution")}
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
                      <span className="font-medium">{STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : status}</span>
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
                    <h3 className="text-sm font-semibold text-neutral-900">{t("hr.performance.list.watchlist")}</h3>
                    <span className="badge badge-warning">{overview.watchlist.length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {overview.watchlist.slice(0, 10).map((tr) => (
                      <Link
                        key={tr.id}
                        href={`/hr/performance/${tr.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors"
                      >
                        <span className="text-sm font-medium text-neutral-900">
                          {tr.employee?.name ?? t("hr.performance.list.employeeNumber", { id: tr.employee_id })}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CLS[tr.status] ?? ""}`}>
                          {STATUS_LABELS[tr.status] ? t(STATUS_LABELS[tr.status]) : tr.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {overview.attention_required?.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="card-header flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900">{t("hr.performance.list.attention")}</h3>
                    <span className="badge badge-danger">{overview.attention_required.length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {overview.attention_required.slice(0, 10).map((tr) => (
                      <Link
                        key={tr.id}
                        href={`/hr/performance/${tr.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors"
                      >
                        <span className="text-sm font-medium text-neutral-900">
                          {tr.employee?.name ?? t("hr.performance.list.employeeNumber", { id: tr.employee_id })}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatDate(tr.cycle_start, localeTag)} – {formatDate(tr.cycle_end, localeTag)}
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
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{t("hr.performance.list.status")}</span>
        <select
          className="form-input max-w-[200px] py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("hr.performance.list.all")}</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">{t("hr.performance.list.trackers")}</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">{t("common.loading")}</span>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="trending_up"
            title={t("hr.performance.list.empty")}
            description={statusFilter ? t("hr.performance.list.emptyFiltered") : t("hr.performance.list.emptyHint")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("hr.performance.list.col.employee")}</th>
                  <th>{t("hr.performance.list.col.cycle")}</th>
                  <th>{t("hr.performance.list.status")}</th>
                  <th>{t("hr.performance.list.col.trend")}</th>
                  <th>{t("hr.performance.list.col.completion")}</th>
                  <th>{t("hr.performance.list.col.overdue")}</th>
                  <th className="text-right">{t("hr.performance.list.col.action")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((tr) => (
                  <tr key={tr.id}>
                    <td className="font-medium text-neutral-900">
                      {tr.employee?.name ?? `#${tr.employee_id}`}
                    </td>
                    <td className="text-neutral-600 text-sm whitespace-nowrap">
                      {formatDate(tr.cycle_start, localeTag)} – {formatDate(tr.cycle_end, localeTag)}
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLS[tr.status] ?? "bg-neutral-100"}`}>
                        {STATUS_LABELS[tr.status] ? t(STATUS_LABELS[tr.status]) : tr.status}
                      </span>
                    </td>
                    <td className="text-sm text-neutral-600">
                      {TREND_LABELS[tr.trend] ? t(TREND_LABELS[tr.trend]) : tr.trend}
                    </td>
                    <td className="text-sm">
                      {tr.assignment_completion_rate != null ? `${tr.assignment_completion_rate}%` : "—"}
                    </td>
                    <td className="text-sm">{tr.overdue_task_count}</td>
                    <td className="text-right">
                      <Link
                        href={`/hr/performance/${tr.id}`}
                        className="btn-secondary text-xs"
                      >
                        {t("hr.performance.list.viewProfile")}
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
