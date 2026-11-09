"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { performanceTrackerApi, type PerformanceTracker } from "@/lib/api";
import { cn } from "@/lib/utils";
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

const TREND_LABELS: Record<string, { label: string; icon: string; cls: string }> = {
  improving: { label: "hr.performance.trend.improving", icon: "trending_up", cls: "text-green-600" },
  stable: { label: "hr.performance.trend.stable", icon: "trending_flat", cls: "text-neutral-500" },
  declining: { label: "hr.performance.trend.declining", icon: "trending_down", cls: "text-red-600" },
  inconsistent: { label: "hr.performance.trend.inconsistent", icon: "shuffle", cls: "text-amber-600" },
  insufficient_data: { label: "hr.performance.trend.insufficient_data", icon: "help_outline", cls: "text-neutral-400" },
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
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_CLS[status] ?? "bg-neutral-100 text-neutral-700 border-neutral-200")}>
      {STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : status}
    </span>
  );
}

type DashboardSection = "overview" | "watchlist" | "at-risk" | "probation" | "dev-actions" | "trends";

const SECTIONS: { id: DashboardSection; label: string; icon: string }[] = [
  { id: "overview", label: "hr.performance.dash.section.overview", icon: "insights" },
  { id: "watchlist", label: "hr.performance.dash.section.watchlist", icon: "warning" },
  { id: "at-risk", label: "hr.performance.dash.section.atRisk", icon: "crisis_alert" },
  { id: "probation", label: "hr.performance.dash.section.probation", icon: "pending_actions" },
  { id: "dev-actions", label: "hr.performance.dash.section.devActions", icon: "emoji_events" },
  { id: "trends", label: "hr.performance.dash.section.trends", icon: "area_chart" },
];

export default function HrPerformanceDashboardPage() {
  const [section, setSection] = useState<DashboardSection>("overview");
  const { t } = useI18n();
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
      setError(t("hr.performance.dash.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const watchlistTrackers = allTrackers.filter((tk) => tk.status === "watchlist");
  const atRiskTrackers = allTrackers.filter(
    (tk) => tk.status === "at_risk" || tk.status === "critical_review_required"
  );
  const probationTrackers = allTrackers.filter((tk) => tk.probation_flag);
  const hrAttentionTrackers = allTrackers.filter((tk) => tk.hr_attention_required);
  const decliningTrackers = allTrackers.filter((tk) => tk.trend === "declining");
  const devActionTrackers = allTrackers.filter((tk) => (tk.active_development_action_count ?? 0) > 0);
  const warningTrackers = allTrackers.filter((tk) => tk.active_warning_flag);

  const total = allTrackers.length;
  const statusCounts = overview?.status_counts ?? {};
  const excellentStrong = (statusCounts.excellent ?? 0) + (statusCounts.strong ?? 0);
  const satisfactory = statusCounts.satisfactory ?? 0;
  const watchlistCount = statusCounts.watchlist ?? 0;
  const atRiskCount = (statusCounts.at_risk ?? 0) + (statusCounts.critical_review_required ?? 0);

  const avgCompletion = allTrackers.length > 0
    ? allTrackers.reduce((acc, tk) => acc + (tk.assignment_completion_rate ?? 0), 0) / allTrackers.length
    : 0;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("hr.performance.dash.title")}
        subtitle={t("hr.performance.dash.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.performance.crumb", href: "/hr/performance" },
              { label: "hr.performance.dash.crumb" },
            ]}
          />
        }
        actions={
          <>
          <Link href="/hr/performance/team" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
            <span className="material-symbols-outlined text-[18px]">group</span>
            {t("hr.performance.dash.teamView")}
          </Link>
          <Link href="/hr/performance" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
            {t("hr.performance.dash.allTrackers")}
          </Link>
          </>
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
          <button type="button" onClick={load} className="ml-auto btn-secondary text-xs">{t("common.retry")}</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-neutral-500 gap-2">
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
          <span>{t("hr.performance.dash.loading")}</span>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: t("hr.performance.dash.kpi.total"), value: total, icon: "group", color: "text-primary", bg: "bg-primary/10" },
              { label: t("hr.performance.dash.kpi.excellentStrong"), value: excellentStrong, icon: "emoji_events", color: "text-green-600", bg: "bg-green-50" },
              { label: t("hr.performance.dash.kpi.satisfactory"), value: satisfactory, icon: "check_circle", color: "text-neutral-600", bg: "bg-neutral-100" },
              { label: t("hr.performance.dash.kpi.watchlist"), value: watchlistCount, icon: "warning", color: "text-amber-600", bg: "bg-amber-50" },
              { label: t("hr.performance.dash.kpi.atRisk"), value: atRiskCount, icon: "crisis_alert", color: "text-red-600", bg: "bg-red-50" },
              { label: t("hr.performance.dash.kpi.avgCompletion"), value: `${Math.round(avgCompletion)}%`, icon: "donut_large", color: "text-primary", bg: "bg-primary/10" },
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
                { label: t("hr.performance.dash.alert.warnings"), count: warningTrackers.length, icon: "flag", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                { label: t("hr.performance.dash.alert.probation"), count: probationTrackers.length, icon: "pending_actions", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                { label: t("hr.performance.dash.alert.hrAttention"), count: hrAttentionTrackers.length, icon: "notifications_active", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
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
                {t(s.label)}
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
                    {t("hr.performance.dash.distribution")}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {["excellent", "strong", "satisfactory", "watchlist", "at_risk", "critical_review_required"].map((status) => {
                      const count = statusCounts[status] ?? 0;
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className="text-xs text-neutral-600 w-40 shrink-0">{t(STATUS_LABELS[status])}</span>
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
                      {t("hr.performance.dash.declining")}
                    </h3>
                    <span className="badge badge-danger">{decliningTrackers.length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {decliningTrackers.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-neutral-400 text-center">{t("hr.performance.dash.noneDeclining")}</p>
                    ) : (
                      decliningTrackers.slice(0, 10).map((tk) => (
                        <Link key={tk.id} href={`/hr/performance/${tk.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                          <span className="text-sm font-medium text-neutral-900">{tk.employee?.name ?? `#${tk.employee_id}`}</span>
                          <StatusBadge status={tk.status} />
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
                      {t("hr.performance.dash.improving")}
                    </h3>
                    <span className="badge badge-success">{allTrackers.filter((tk) => tk.trend === "improving").length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {allTrackers.filter((tk) => tk.trend === "improving").length === 0 ? (
                      <EmptyState icon="trending_up" title={t("hr.performance.dash.noImproving")} className="py-6 min-h-0" />
                    ) : (
                      allTrackers.filter((tk) => tk.trend === "improving").slice(0, 10).map((tk) => (
                        <Link key={tk.id} href={`/hr/performance/${tk.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                          <span className="text-sm font-medium text-neutral-900">{tk.employee?.name ?? `#${tk.employee_id}`}</span>
                          <StatusBadge status={tk.status} />
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
              emptyMessage={t("hr.performance.dash.watchlistEmpty")}
              emptyNote={t("hr.performance.dash.watchlistNote")}
            />
          )}

          {/* At Risk section */}
          {section === "at-risk" && (
            <div className="space-y-4">
              {atRiskTrackers.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">crisis_alert</span>
                  <strong>{t(atRiskTrackers.length > 1 ? "hr.performance.dash.atRiskMany" : "hr.performance.dash.atRiskOne", { count: atRiskTrackers.length })}</strong>&nbsp;{t("hr.performance.dash.atRiskRest")}
                </div>
              )}
              <TrackerTable
                trackers={atRiskTrackers}
                emptyIcon="crisis_alert"
                emptyMessage={t("hr.performance.dash.atRiskEmpty")}
                emptyNote={t("hr.performance.dash.atRiskNote")}
              />
            </div>
          )}

          {/* Probation section */}
          {section === "probation" && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500">{t("hr.performance.dash.probationIntro")}</p>
              <TrackerTable
                trackers={probationTrackers}
                emptyIcon="pending_actions"
                emptyMessage={t("hr.performance.dash.probationEmpty")}
                emptyNote={t("hr.performance.dash.probationNote")}
              />
            </div>
          )}

          {/* Development Actions section */}
          {section === "dev-actions" && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500">{t("hr.performance.dash.devIntro")} <strong>{devActionTrackers.length}</strong> {t("hr.performance.dash.devActive")}</p>
              <div className="card overflow-hidden">
                <div className="card-header">
                  <h3 className="text-sm font-semibold text-neutral-900">{t("hr.performance.dash.devTitle")}</h3>
                  <span className="badge badge-warning">{devActionTrackers.length}</span>
                </div>
                {devActionTrackers.length === 0 ? (
                  <EmptyState icon="emoji_events" title={t("hr.performance.dash.devEmpty")} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t("hr.performance.dash.col.employee")}</th>
                          <th>{t("hr.performance.dash.col.status")}</th>
                          <th>{t("hr.performance.dash.col.trend")}</th>
                          <th>{t("hr.performance.dash.col.openDevActions")}</th>
                          <th>{t("hr.performance.dash.col.completionRate")}</th>
                          <th className="text-right">{t("hr.performance.dash.col.action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devActionTrackers.map((tk) => {
                          const trendConf = TREND_LABELS[tk.trend] ?? { label: tk.trend, icon: "trending_flat", cls: "text-neutral-500" };
                          return (
                            <tr key={tk.id}>
                              <td className="font-medium text-neutral-900">{tk.employee?.name ?? `#${tk.employee_id}`}</td>
                              <td><StatusBadge status={tk.status} /></td>
                              <td>
                                <span className={`flex items-center gap-1 text-xs font-medium ${trendConf.cls}`}>
                                  <span className="material-symbols-outlined text-[14px]">{trendConf.icon}</span>
                                  {t(trendConf.label)}
                                </span>
                              </td>
                              <td>
                                <span className="font-bold text-amber-700 text-sm">{tk.active_development_action_count}</span>
                              </td>
                              <td className="text-sm">
                                {tk.assignment_completion_rate != null ? `${tk.assignment_completion_rate}%` : "—"}
                              </td>
                              <td className="text-right">
                                <Link href={`/hr/performance/${tk.id}`} className="btn-secondary text-xs">
                                  {t("hr.performance.dash.viewProfile")}
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
                      {t("hr.performance.dash.commendations")}
                    </h3>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {allTrackers
                      .filter((tk) => (tk.commendation_count ?? 0) > 0)
                      .sort((a, b) => (b.commendation_count ?? 0) - (a.commendation_count ?? 0))
                      .slice(0, 10)
                      .map((tk) => (
                        <Link key={tk.id} href={`/hr/performance/${tk.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                          <span className="text-sm font-medium text-neutral-900">{tk.employee?.name ?? `#${tk.employee_id}`}</span>
                          <span className="flex items-center gap-1 text-xs text-green-700 font-semibold">
                            <span className="material-symbols-outlined text-[14px]">star</span>
                            {tk.commendation_count}
                          </span>
                        </Link>
                      ))}
                    {allTrackers.filter((tk) => (tk.commendation_count ?? 0) > 0).length === 0 && (
                      <EmptyState icon="star" title={t("hr.performance.dash.noCommendations")} className="py-6 min-h-0" />
                    )}
                  </div>
                </div>

                {/* Disciplinary matters */}
                <div className="card overflow-hidden">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-red-500">gavel</span>
                      {t("hr.performance.dash.warnings")}
                    </h3>
                  </div>
                  <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                    {warningTrackers.length === 0 ? (
                      <EmptyState icon="gavel" title={t("hr.performance.dash.noWarnings")} className="py-6 min-h-0" />
                    ) : (
                      warningTrackers.slice(0, 10).map((tk) => (
                        <Link key={tk.id} href={`/hr/performance/${tk.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                          <span className="text-sm font-medium text-neutral-900">{tk.employee?.name ?? `#${tk.employee_id}`}</span>
                          <span className="badge badge-danger text-xs">{t("hr.performance.dash.warningActive")}</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Trend summary table */}
              <div className="card overflow-hidden">
                <div className="card-header">
                  <h3 className="text-sm font-semibold text-neutral-900">{t("hr.performance.dash.trendDistribution")}</h3>
                </div>
                <div className="p-4 flex flex-wrap gap-4">
                  {["improving", "stable", "declining", "inconsistent", "insufficient_data"].map((trend) => {
                    const count = allTrackers.filter((tk) => tk.trend === trend).length;
                    const conf = TREND_LABELS[trend];
                    return (
                      <div key={trend} className="flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3 min-w-[140px]">
                        <span className={`material-symbols-outlined text-[20px] ${conf?.cls ?? "text-neutral-500"}`}>{conf?.icon ?? "trending_flat"}</span>
                        <div>
                          <p className={`text-sm font-bold ${conf?.cls ?? "text-neutral-700"}`}>{count}</p>
                          <p className="text-xs text-neutral-500">{conf ? t(conf.label) : trend}</p>
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
  const { t } = useI18n();
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-neutral-900">{t("hr.performance.dash.employees")}</h3>
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
                <th>{t("hr.performance.dash.col.employee")}</th>
                <th>{t("hr.performance.dash.col.status")}</th>
                <th>{t("hr.performance.dash.col.trend")}</th>
                <th>{t("hr.performance.dash.col.completion")}</th>
                <th>{t("hr.performance.dash.col.overdue")}</th>
                <th>{t("hr.performance.dash.col.devActions")}</th>
                <th>{t("hr.performance.dash.col.warning")}</th>
                <th className="text-right">{t("hr.performance.dash.col.action")}</th>
              </tr>
            </thead>
            <tbody>
              {trackers.map((tk) => {
                const trendConf = TREND_LABELS[tk.trend] ?? { label: tk.trend, icon: "trending_flat", cls: "text-neutral-500" };
                return (
                  <tr key={tk.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            <Initials name={tk.employee?.name ?? ""} />
                          </span>
                        </div>
                        <span className="font-medium text-neutral-900">{tk.employee?.name ?? `#${tk.employee_id}`}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={tk.status} /></td>
                    <td>
                      <span className={`flex items-center gap-1 text-xs font-medium ${trendConf.cls}`}>
                        <span className="material-symbols-outlined text-[14px]">{trendConf.icon}</span>
                        {t(trendConf.label)}
                      </span>
                    </td>
                    <td className="text-sm">
                      {tk.assignment_completion_rate != null ? `${tk.assignment_completion_rate}%` : "—"}
                    </td>
                    <td className="text-sm">
                      {(tk.overdue_task_count ?? 0) > 0 ? (
                        <span className="text-red-600 font-semibold">{tk.overdue_task_count}</span>
                      ) : (
                        <span className="text-neutral-400">0</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {(tk.active_development_action_count ?? 0) > 0 ? (
                        <span className="text-amber-700 font-semibold">{tk.active_development_action_count}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td>
                      {tk.active_warning_flag ? (
                        <span className="badge badge-danger text-xs">{t("hr.performance.dash.yes")}</span>
                      ) : (
                        <span className="text-neutral-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link href={`/hr/performance/${tk.id}`} className="btn-secondary text-xs">
                        {t("hr.performance.dash.view")}
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
