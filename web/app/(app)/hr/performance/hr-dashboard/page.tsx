"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { performanceTrackerApi, type PerformanceTracker } from "@/lib/api";
import { cn } from "@/lib/utils";

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

const TREND_LABELS: Record<string, { label: string; icon: string; cls: string }> = {
  improving: { label: "Improving", icon: "trending_up", cls: "text-green-600" },
  stable: { label: "Stable", icon: "trending_flat", cls: "text-neutral-500" },
  declining: { label: "Declining", icon: "trending_down", cls: "text-red-600" },
  inconsistent: { label: "Inconsistent", icon: "shuffle", cls: "text-amber-600" },
  insufficient_data: { label: "Insufficient Data", icon: "help_outline", cls: "text-neutral-400" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Initials({ name }: { name: string }) {
  const parts = name.split(" ").filter(Boolean);
  const init = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return <>{init || "?"}</>;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_CLS[status] ?? "bg-neutral-100 text-neutral-700 border-neutral-200")}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

type DashboardSection = "overview" | "watchlist" | "at-risk" | "probation" | "dev-actions" | "trends";

const SECTIONS: { id: DashboardSection; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "insights" },
  { id: "watchlist", label: "Watchlist", icon: "warning" },
  { id: "at-risk", label: "At Risk / Critical", icon: "crisis_alert" },
  { id: "probation", label: "Probation Review", icon: "pending_actions" },
  { id: "dev-actions", label: "Development Actions", icon: "emoji_events" },
  { id: "trends", label: "Trends", icon: "area_chart" },
];

export default function HrPerformanceDashboardPage() {
  const router = useRouter();
  const [section, setSection] = useState<DashboardSection>("overview");
  const [overview, setOverview] = useState<{
    status_counts: Record<string, number>;
    watchlist: PerformanceTracker[];
    attention_required: PerformanceTracker[];
  } | null>(null);
  const [allTrackers, setAllTrackers] = useState<PerformanceTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, listRes] = await Promise.all([
        performanceTrackerApi.overview(),
        performanceTrackerApi.list({ per_page: 200 }),
      ]);
      setOverview(overviewRes.data);
      const listData = (listRes.data as { data?: PerformanceTracker[] }).data ?? [];
      setAllTrackers(Array.isArray(listData) ? listData : []);
    } catch {
      setError("Failed to load HR performance dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const watchlistTrackers = allTrackers.filter((t) => t.status === "watchlist");
  const atRiskTrackers = allTrackers.filter(
    (t) => t.status === "at_risk" || t.status === "critical_review_required"
  );
  const probationTrackers = allTrackers.filter((t) => t.probation_flag);
  const hrAttentionTrackers = allTrackers.filter((t) => t.hr_attention_required);
  const decliningTrackers = allTrackers.filter((t) => t.trend === "declining");
  const devActionTrackers = allTrackers.filter((t) => (t.active_development_action_count ?? 0) > 0);
  const warningTrackers = allTrackers.filter((t) => t.active_warning_flag);

  const total = allTrackers.length;
  const statusCounts = overview?.status_counts ?? {};
  const excellentStrong = (statusCounts.excellent ?? 0) + (statusCounts.strong ?? 0);
  const satisfactory = statusCounts.satisfactory ?? 0;
  const watchlistCount = statusCounts.watchlist ?? 0;
  const atRiskCount = (statusCounts.at_risk ?? 0) + (statusCounts.critical_review_required ?? 0);

  const avgCompletion = allTrackers.length > 0
    ? allTrackers.reduce((acc, t) => acc + (t.assignment_completion_rate ?? 0), 0) / allTrackers.length
    : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <button onClick={() => router.push("/hr")} className="hover:text-neutral-600">HR</button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <button onClick={() => router.push("/hr/performance")} className="hover:text-neutral-600">Performance Tracker</button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">HR Monitoring Dashboard</span>
          </nav>
          <h1 className="page-title">HR Performance Monitoring</h1>
          <p className="page-subtitle">Institution-wide performance intelligence, watchlist monitoring, and pre-appraisal evidence overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/hr/performance/team" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
            <span className="material-symbols-outlined text-[18px]">group</span>
            Team View
          </Link>
          <Link href="/hr/performance" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
            All Trackers
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
          <button onClick={load} className="ml-auto text-red-700 font-semibold hover:underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-neutral-500 gap-2">
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
          <span>Loading dashboard…</span>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "Total Tracked", value: total, icon: "group", color: "text-primary", bg: "bg-primary/10" },
              { label: "Excellent / Strong", value: excellentStrong, icon: "emoji_events", color: "text-green-600", bg: "bg-green-50" },
              { label: "Satisfactory", value: satisfactory, icon: "check_circle", color: "text-neutral-600", bg: "bg-neutral-100" },
              { label: "Watchlist", value: watchlistCount, icon: "warning", color: "text-amber-600", bg: "bg-amber-50" },
              { label: "At Risk / Critical", value: atRiskCount, icon: "crisis_alert", color: "text-red-600", bg: "bg-red-50" },
              { label: "Avg Completion", value: `${Math.round(avgCompletion)}%`, icon: "donut_large", color: "text-purple-600", bg: "bg-purple-50" },
            ].map((stat) => (
              <div key={stat.label} className="card p-4">
                <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                  <span className={`material-symbols-outlined text-[20px] ${stat.color}`}>{stat.icon}</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Alert row */}
          {(warningTrackers.length > 0 || probationTrackers.length > 0 || hrAttentionTrackers.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Active Warnings", count: warningTrackers.length, icon: "flag", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                { label: "Probation Active", count: probationTrackers.length, icon: "pending_actions", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                { label: "HR Attention Required", count: hrAttentionTrackers.length, icon: "notifications_active", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
              ].filter((a) => a.count > 0).map((alert) => (
                <div key={alert.label} className={`rounded-xl border ${alert.border} ${alert.bg} px-4 py-3 flex items-center gap-3`}>
                  <span className={`material-symbols-outlined ${alert.color} text-[22px]`}>{alert.icon}</span>
                  <div>
                    <p className={`text-lg font-bold ${alert.color}`}>{alert.count}</p>
                    <p className="text-xs text-neutral-600">{alert.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section navigation */}
          <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  section === s.id
                    ? "border-primary text-primary"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Overview section */}
          {section === "overview" && (
            <div className="space-y-4">
              <div className="card overflow-hidden">
                <div className="card-header">
                  <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-neutral-400">bar_chart</span>
                    Performance Status Distribution
                  </h3>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {["excellent", "strong", "satisfactory", "watchlist", "at_risk", "critical_review_required"].map((status) => {
                      const count = statusCounts[status] ?? 0;
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className="text-xs text-neutral-600 w-40 shrink-0">{STATUS_LABELS[status]}</span>
                          <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                status === "excellent" ? "bg-green-500" :
                                status === "strong" ? "bg-primary" :
                                status === "satisfactory" ? "bg-neutral-400" :
                                status === "watchlist" ? "bg-amber-400" :
                                "bg-red-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-neutral-700 w-16 text-right">{count} <span className="text-xs text-neutral-400 font-normal">({Math.round(pct)}%)</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Declining performers */}
                <div className="card overflow-hidden">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-red-500">trending_down</span>
                      Declining Trend
                    </h3>
                    <span className="badge badge-danger">{decliningTrackers.length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {decliningTrackers.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-neutral-400 text-center">None currently declining.</p>
                    ) : (
                      decliningTrackers.slice(0, 10).map((t) => (
                        <Link key={t.id} href={`/hr/performance/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                          <span className="text-sm font-medium text-neutral-900">{t.employee?.name ?? `#${t.employee_id}`}</span>
                          <StatusBadge status={t.status} />
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                {/* Improving performers */}
                <div className="card overflow-hidden">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-green-500">trending_up</span>
                      Improving Trend
                    </h3>
                    <span className="badge badge-success">{allTrackers.filter((t) => t.trend === "improving").length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {allTrackers.filter((t) => t.trend === "improving").length === 0 ? (
                      <p className="px-4 py-6 text-sm text-neutral-400 text-center">No improving trend data.</p>
                    ) : (
                      allTrackers.filter((t) => t.trend === "improving").slice(0, 10).map((t) => (
                        <Link key={t.id} href={`/hr/performance/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                          <span className="text-sm font-medium text-neutral-900">{t.employee?.name ?? `#${t.employee_id}`}</span>
                          <StatusBadge status={t.status} />
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Watchlist section */}
          {section === "watchlist" && (
            <TrackerTable
              trackers={watchlistTrackers}
              emptyIcon="warning"
              emptyMessage="No employees currently on the watchlist."
              emptyNote="Watchlist status is assigned when performance monitoring flags concern."
            />
          )}

          {/* At Risk section */}
          {section === "at-risk" && (
            <div className="space-y-4">
              {atRiskTrackers.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">crisis_alert</span>
                  <strong>{atRiskTrackers.length} employee{atRiskTrackers.length > 1 ? "s" : ""}</strong>&nbsp;at risk or requiring critical review. Immediate supervisor and HR follow-up recommended.
                </div>
              )}
              <TrackerTable
                trackers={atRiskTrackers}
                emptyIcon="crisis_alert"
                emptyMessage="No at-risk employees."
                emptyNote="Employees flagged at-risk or critical review required will appear here."
              />
            </div>
          )}

          {/* Probation section */}
          {section === "probation" && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500">Employees currently on probation or awaiting confirmation review. Tracker data provides pre-review evidence.</p>
              <TrackerTable
                trackers={probationTrackers}
                emptyIcon="pending_actions"
                emptyMessage="No active probation cases."
                emptyNote="Employees on probation with active performance trackers will appear here."
              />
            </div>
          )}

          {/* Development Actions section */}
          {section === "dev-actions" && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500">Employees with open development actions from prior appraisals or performance plans. <strong>{devActionTrackers.length}</strong> active.</p>
              <div className="card overflow-hidden">
                <div className="card-header">
                  <h3 className="text-sm font-semibold text-neutral-900">Open development actions</h3>
                  <span className="badge badge-warning">{devActionTrackers.length}</span>
                </div>
                {devActionTrackers.length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-neutral-200">emoji_events</span>
                    <p className="mt-3 text-sm text-neutral-400">No open development actions.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Status</th>
                          <th>Trend</th>
                          <th>Open Dev. Actions</th>
                          <th>Completion Rate</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devActionTrackers.map((t) => {
                          const trendConf = TREND_LABELS[t.trend] ?? { label: t.trend, icon: "trending_flat", cls: "text-neutral-500" };
                          return (
                            <tr key={t.id}>
                              <td className="font-medium text-neutral-900">{t.employee?.name ?? `#${t.employee_id}`}</td>
                              <td><StatusBadge status={t.status} /></td>
                              <td>
                                <span className={`flex items-center gap-1 text-xs font-medium ${trendConf.cls}`}>
                                  <span className="material-symbols-outlined text-[14px]">{trendConf.icon}</span>
                                  {trendConf.label}
                                </span>
                              </td>
                              <td>
                                <span className="font-bold text-amber-700 text-sm">{t.active_development_action_count}</span>
                              </td>
                              <td className="text-sm">
                                {t.assignment_completion_rate != null ? `${t.assignment_completion_rate}%` : "—"}
                              </td>
                              <td className="text-right">
                                <Link href={`/hr/performance/${t.id}`} className="text-sm font-semibold text-primary hover:underline">
                                  View profile
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trends section */}
          {section === "trends" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Recognition leaders */}
                <div className="card overflow-hidden">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-green-500">star</span>
                      Commendations &amp; Recognition
                    </h3>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {allTrackers
                      .filter((t) => (t.commendation_count ?? 0) > 0)
                      .sort((a, b) => (b.commendation_count ?? 0) - (a.commendation_count ?? 0))
                      .slice(0, 10)
                      .map((t) => (
                        <Link key={t.id} href={`/hr/performance/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                          <span className="text-sm font-medium text-neutral-900">{t.employee?.name ?? `#${t.employee_id}`}</span>
                          <span className="flex items-center gap-1 text-xs text-green-700 font-semibold">
                            <span className="material-symbols-outlined text-[14px]">star</span>
                            {t.commendation_count}
                          </span>
                        </Link>
                      ))}
                    {allTrackers.filter((t) => (t.commendation_count ?? 0) > 0).length === 0 && (
                      <p className="px-4 py-6 text-sm text-neutral-400 text-center">No commendations recorded.</p>
                    )}
                  </div>
                </div>

                {/* Disciplinary matters */}
                <div className="card overflow-hidden">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-red-500">gavel</span>
                      Active Warnings / Conduct
                    </h3>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {warningTrackers.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-neutral-400 text-center">No active warnings.</p>
                    ) : (
                      warningTrackers.slice(0, 10).map((t) => (
                        <Link key={t.id} href={`/hr/performance/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                          <span className="text-sm font-medium text-neutral-900">{t.employee?.name ?? `#${t.employee_id}`}</span>
                          <span className="badge badge-danger text-xs">Warning active</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Trend summary table */}
              <div className="card overflow-hidden">
                <div className="card-header">
                  <h3 className="text-sm font-semibold text-neutral-900">Trend distribution</h3>
                </div>
                <div className="p-4 flex flex-wrap gap-4">
                  {["improving", "stable", "declining", "inconsistent", "insufficient_data"].map((trend) => {
                    const count = allTrackers.filter((t) => t.trend === trend).length;
                    const conf = TREND_LABELS[trend];
                    return (
                      <div key={trend} className="flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3 min-w-[140px]">
                        <span className={`material-symbols-outlined text-[20px] ${conf?.cls ?? "text-neutral-500"}`}>{conf?.icon ?? "trending_flat"}</span>
                        <div>
                          <p className={`text-sm font-bold ${conf?.cls ?? "text-neutral-700"}`}>{count}</p>
                          <p className="text-xs text-neutral-500">{conf?.label ?? trend}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrackerTable({
  trackers,
  emptyIcon,
  emptyMessage,
  emptyNote,
}: {
  trackers: PerformanceTracker[];
  emptyIcon: string;
  emptyMessage: string;
  emptyNote?: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-neutral-900">Employees</h3>
        <span className="badge badge-muted">{trackers.length}</span>
      </div>
      {trackers.length === 0 ? (
        <div className="py-16 text-center">
          <span className={`material-symbols-outlined text-4xl text-neutral-200`}>{emptyIcon}</span>
          <p className="mt-3 text-sm text-neutral-500">{emptyMessage}</p>
          {emptyNote && <p className="text-xs text-neutral-400 mt-1">{emptyNote}</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th>Trend</th>
                <th>Completion</th>
                <th>Overdue</th>
                <th>Dev. Actions</th>
                <th>Warning</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {trackers.map((t) => {
                const trendConf = TREND_LABELS[t.trend] ?? { label: t.trend, icon: "trending_flat", cls: "text-neutral-500" };
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            <Initials name={t.employee?.name ?? ""} />
                          </span>
                        </div>
                        <span className="font-medium text-neutral-900">{t.employee?.name ?? `#${t.employee_id}`}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>
                      <span className={`flex items-center gap-1 text-xs font-medium ${trendConf.cls}`}>
                        <span className="material-symbols-outlined text-[14px]">{trendConf.icon}</span>
                        {trendConf.label}
                      </span>
                    </td>
                    <td className="text-sm">
                      {t.assignment_completion_rate != null ? `${t.assignment_completion_rate}%` : "—"}
                    </td>
                    <td className="text-sm">
                      {(t.overdue_task_count ?? 0) > 0 ? (
                        <span className="text-red-600 font-semibold">{t.overdue_task_count}</span>
                      ) : (
                        <span className="text-neutral-400">0</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {(t.active_development_action_count ?? 0) > 0 ? (
                        <span className="text-amber-700 font-semibold">{t.active_development_action_count}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td>
                      {t.active_warning_flag ? (
                        <span className="badge badge-danger text-xs">Yes</span>
                      ) : (
                        <span className="text-neutral-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link href={`/hr/performance/${t.id}`} className="text-sm font-semibold text-primary hover:underline">
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
    </div>
  );
}
