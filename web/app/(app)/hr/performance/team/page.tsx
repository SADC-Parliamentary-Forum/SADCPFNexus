"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { performanceTrackerApi, type PerformanceTracker } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<
  PerformanceTracker["status"],
  { label: string; badge: string }
> = {
  excellent: { label: "hr.performance.status.excellent", badge: "badge-success" },
  strong: { label: "hr.performance.status.strong", badge: "badge-primary" },
  satisfactory: { label: "hr.performance.status.satisfactory", badge: "badge-muted" },
  watchlist: { label: "hr.performance.status.watchlist", badge: "badge-warning" },
  at_risk: { label: "hr.performance.status.at_risk", badge: "badge-danger" },
  critical_review_required: { label: "hr.performance.team.criticalReview", badge: "badge-danger" },
};

const TREND_CONFIG: Record<
  PerformanceTracker["trend"],
  { label: string; icon: string; className: string }
> = {
  improving: { label: "hr.performance.trend.improving", icon: "arrow_upward", className: "text-green-600" },
  stable: { label: "hr.performance.trend.stable", icon: "remove", className: "text-neutral-500" },
  declining: { label: "hr.performance.trend.declining", icon: "trending_down", className: "text-red-600" },
  inconsistent: { label: "hr.performance.trend.inconsistent", icon: "shuffle", className: "text-amber-600" },
  insufficient_data: { label: "hr.performance.trend.insufficient_data", icon: "help_outline", className: "text-neutral-400" },
};

function TeamMemberCard({ tracker }: { tracker: PerformanceTracker }) {
  const router = useRouter();
  const { t } = useI18n();
  const statusConf = STATUS_CONFIG[tracker.status];
  const trendConf = TREND_CONFIG[tracker.trend];

  const completionRate = tracker.assignment_completion_rate ?? 0;
  const updateCompliance = (tracker as unknown as Record<string, unknown>).update_compliance_score as number | null ?? null;
  const commendations = (tracker as unknown as Record<string, unknown>).commendation_count as number ?? 0;
  const workloadScore = (tracker as unknown as Record<string, unknown>).workload_score as number | null ?? null;

  return (
    <div
      className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/hr/performance/${tracker.id}`)}
    >
      {/* Employee header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
            {tracker.employee?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-semibold text-neutral-900 text-sm">
              {tracker.employee?.name ?? t("hr.performance.team.employeeNumber", { id: tracker.employee_id })}
            </p>
            <p className="text-xs text-neutral-400">{tracker.employee?.email}</p>
          </div>
        </div>
        <span className={cn("badge text-xs", statusConf.badge)}>{t(statusConf.label)}</span>
      </div>

      <div className="text-xs text-neutral-400 mb-3">
        {formatDateShort(tracker.cycle_start)} – {formatDateShort(tracker.cycle_end)}
      </div>

      {/* Completion progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>{t("hr.performance.team.taskCompletion")}</span>
          <span className="font-semibold text-neutral-700">{Math.round(completionRate)}%</span>
        </div>
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${completionRate >= 80 ? "bg-green-500" : completionRate >= 60 ? "bg-primary" : completionRate >= 40 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <div className="text-center p-2 bg-neutral-50 rounded-lg">
          <p className={cn("text-sm font-bold", tracker.overdue_task_count > 0 ? "text-red-600" : "text-neutral-700")}>
            {tracker.overdue_task_count}
          </p>
          <p className="text-[10px] text-neutral-500">{t("hr.performance.team.overdue")}</p>
        </div>
        <div className="text-center p-2 bg-neutral-50 rounded-lg">
          <p className="text-sm font-bold text-neutral-700">{tracker.timesheet_hours_logged ?? 0}h</p>
          <p className="text-[10px] text-neutral-500">{t("hr.performance.team.hours")}</p>
        </div>
        <div className="text-center p-2 bg-neutral-50 rounded-lg">
          <p className={cn("text-sm font-bold", commendations > 0 ? "text-green-600" : "text-neutral-400")}>
            {commendations}
          </p>
          <p className="text-[10px] text-neutral-500">{t("hr.performance.team.commend")}</p>
        </div>
        <div className="text-center p-2 bg-neutral-50 rounded-lg">
          <p className="text-sm font-bold text-neutral-700">
            {updateCompliance != null ? `${updateCompliance}/10` : "—"}
          </p>
          <p className="text-[10px] text-neutral-500">{t("hr.performance.team.updates")}</p>
        </div>
      </div>

      {/* Workload indicator */}
      {workloadScore != null && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-neutral-500">{t("hr.performance.team.workload")}</span>
          <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${workloadScore >= 8 ? "bg-amber-400" : "bg-primary"}`}
              style={{ width: `${(workloadScore / 10) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-neutral-600">{workloadScore}/10</span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between flex-wrap gap-1 pt-2 border-t border-neutral-50">
        <span className={cn("flex items-center gap-1 text-xs font-medium", trendConf.className)}>
          <span className="material-symbols-outlined text-[14px]">{trendConf.icon}</span>
          {t(trendConf.label)}
        </span>
        <div className="flex items-center gap-1">
          {tracker.active_warning_flag && <span className="badge badge-danger text-[10px] py-0.5 px-1.5">{t("hr.performance.team.warning")}</span>}
          {tracker.hr_attention_required && <span className="badge badge-warning text-[10px] py-0.5 px-1.5">{t("hr.performance.team.hr")}</span>}
          {tracker.management_attention_required && <span className="badge badge-warning text-[10px] py-0.5 px-1.5">{t("hr.performance.team.mgmt")}</span>}
          {commendations > 0 && <span className="badge badge-success text-[10px] py-0.5 px-1.5">★ {commendations}</span>}
        </div>
      </div>
    </div>
  );
}

export default function TeamPerformancePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [trackers, setTrackers] = useState<PerformanceTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await performanceTrackerApi.team();
        setTrackers(res.data.data);
      } catch {
        setError(t("hr.performance.team.loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  // Compute summary stats
  const total = trackers.length;
  const excellent = trackers.filter((tk) => tk.status === "excellent" || tk.status === "strong").length;
  const watchlist = trackers.filter((tk) => tk.status === "watchlist").length;
  const atRisk = trackers.filter((tk) => tk.status === "at_risk" || tk.status === "critical_review_required").length;
  const avgCompletion =
    trackers.length > 0
      ? trackers.reduce((acc, tk) => acc + (tk.assignment_completion_rate ?? 0), 0) / trackers.length
      : 0;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("hr.performance.team.title")}
        subtitle={t("hr.performance.team.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.performance.list.crumb", href: "/hr/performance" },
              { label: "hr.performance.team.crumb" },
            ]}
          />
        }
        actions={
          <>
          <button
            type="button"
            className={cn("btn-secondary flex items-center gap-2", viewMode === "cards" ? "bg-primary/10 text-primary border-primary/30" : "")}
            onClick={() => setViewMode("cards")}
            title={t("hr.performance.team.cardView")}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
          </button>
          <button
            type="button"
            className={cn("btn-secondary flex items-center gap-2", viewMode === "table" ? "bg-primary/10 text-primary border-primary/30" : "")}
            onClick={() => setViewMode("table")}
            title={t("hr.performance.team.tableView")}
          >
            <span className="material-symbols-outlined text-[18px]">table_rows</span>
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={() => router.push("/hr/performance/hr-dashboard")}
          >
            <span className="material-symbols-outlined text-[18px]">insights</span>
            {t("hr.performance.team.hrDashboard")}
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={() => router.push("/hr/performance")}
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {t("hr.performance.team.allTrackers")}
          </button>
          </>
        }
      />

      {/* Summary Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: t("hr.performance.team.members"), value: total, icon: "group", color: "text-blue-600", bg: "bg-blue-50" },
            { label: t("hr.performance.team.excellentStrong"), value: excellent, icon: "emoji_events", color: "text-green-600", bg: "bg-green-50" },
            { label: t("hr.performance.team.watchlist"), value: watchlist, icon: "warning", color: "text-amber-600", bg: "bg-amber-50" },
            { label: t("hr.performance.team.atRisk"), value: atRisk, icon: "crisis_alert", color: "text-red-600", bg: "bg-red-50" },
            { label: t("hr.performance.team.avgCompletion"), value: `${Math.round(avgCompletion)}%`, icon: "donut_large", color: "text-primary", bg: "bg-primary/10" },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2 flex-shrink-0", stat.bg)}>
                  <span className={cn("material-symbols-outlined text-[22px]", stat.color)}>{stat.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-800">{stat.value}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && <ErrorBanner message={error} />}

      {/* Table view */}
      {!loading && !error && viewMode === "table" && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-neutral-900">{t("hr.performance.team.tableTitle")}</h3>
          </div>
          {trackers.length === 0 ? (
            <EmptyState icon="group" title={t("hr.performance.team.noReports")} className="py-12 min-h-0" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("hr.performance.team.col.employee")}</th>
                    <th>{t("hr.performance.team.col.status")}</th>
                    <th>{t("hr.performance.team.col.trend")}</th>
                    <th>{t("hr.performance.team.col.completion")}</th>
                    <th>{t("hr.performance.team.overdue")}</th>
                    <th>{t("hr.performance.team.hours")}</th>
                    <th>{t("hr.performance.team.col.updateCompliance")}</th>
                    <th>{t("hr.performance.team.workload")}</th>
                    <th>{t("hr.performance.team.commend")}</th>
                    <th>{t("hr.performance.team.col.flags")}</th>
                    <th className="text-right">{t("hr.performance.team.col.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {trackers.map((tk) => {
                    const s = STATUS_CONFIG[tk.status];
                    const tr = TREND_CONFIG[tk.trend];
                    const updateCompliance = (tk as unknown as Record<string, unknown>).update_compliance_score as number | null ?? null;
                    const commendations = (tk as unknown as Record<string, unknown>).commendation_count as number ?? 0;
                    const workloadScore = (tk as unknown as Record<string, unknown>).workload_score as number | null ?? null;
                    return (
                      <tr key={tk.id}>
                        <td className="font-medium text-neutral-900">{tk.employee?.name ?? `#${tk.employee_id}`}</td>
                        <td><span className={cn("badge text-xs", s.badge)}>{t(s.label)}</span></td>
                        <td>
                          <span className={cn("flex items-center gap-1 text-xs font-medium", tr.className)}>
                            <span className="material-symbols-outlined text-[13px]">{tr.icon}</span>
                            {t(tr.label)}
                          </span>
                        </td>
                        <td className="text-sm">
                          {tk.assignment_completion_rate != null ? `${Math.round(tk.assignment_completion_rate)}%` : "—"}
                        </td>
                        <td className="text-sm">
                          {tk.overdue_task_count > 0 ? (
                            <span className="text-red-600 font-semibold">{tk.overdue_task_count}</span>
                          ) : <span className="text-neutral-400">0</span>}
                        </td>
                        <td className="text-sm text-neutral-600">{tk.timesheet_hours_logged ?? 0}h</td>
                        <td className="text-sm text-neutral-600">
                          {updateCompliance != null ? `${updateCompliance}/10` : "—"}
                        </td>
                        <td className="text-sm text-neutral-600">
                          {workloadScore != null ? `${workloadScore}/10` : "—"}
                        </td>
                        <td className="text-sm">
                          {commendations > 0 ? <span className="text-green-600 font-semibold">★ {commendations}</span> : <span className="text-neutral-300">—</span>}
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {tk.active_warning_flag && <span className="badge badge-danger text-[10px] py-0.5">{t("hr.performance.team.warning")}</span>}
                            {tk.hr_attention_required && <span className="badge badge-warning text-[10px] py-0.5">{t("hr.performance.team.hr")}</span>}
                          </div>
                        </td>
                        <td className="text-right">
                          <button type="button" className="btn-secondary text-xs" onClick={() => router.push(`/hr/performance/${tk.id}`)}>
                            {t("hr.performance.team.view")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cards grid */}
      {viewMode === "cards" && (loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-neutral-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-3 bg-neutral-100 rounded animate-pulse w-3/4" />
                </div>
              </div>
              <div className="h-16 bg-neutral-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : trackers.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="group"
            title={t("hr.performance.team.noReports")}
            description={t("hr.performance.team.noReportsHint")}
          />
        </div>
      ) : (
        <>
          {/* At-risk / watchlist section */}
          {(watchlist > 0 || atRisk > 0) && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>
                {t("hr.performance.team.needsAttention")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trackers
                  .filter((tk) => tk.status === "watchlist" || tk.status === "at_risk" || tk.status === "critical_review_required")
                  .map((tk) => <TeamMemberCard key={tk.id} tracker={tk} />)}
              </div>
            </div>
          )}

          {/* Rest of team */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">people</span>
              {t("hr.performance.team.allMembers")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trackers.map((tk) => <TeamMemberCard key={tk.id} tracker={tk} />)}
            </div>
          </div>
        </>
      ))}
    </div>
  );
}
