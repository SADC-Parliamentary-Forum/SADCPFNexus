"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeDashboardData } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { MANDE_HUB_CARDS } from "@/lib/hubs/mande";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { reviewStatusLabel } from "@/lib/mandeStatusLabels";

const STATUS_BADGE: Record<string, string> = {
  not_submitted: "badge-muted",
  submitted: "badge-warning",
  returned: "badge-danger",
  reviewed: "badge-primary",
  accepted: "badge-success",
  closed: "badge-muted",
};

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-600 w-40 truncate" title={label}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }} />
      </div>
      <span className="text-xs font-semibold text-neutral-700 w-8 text-right">{value}</span>
    </div>
  );
}

export default function MandeDashboardPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "dashboard"],
    queryFn: () => mandeApi.getDashboard().then((r) => r.data.data as MeDashboardData),
    staleTime: 30_000,
  });

  const k = data?.kpis;
  const maxGoal = Math.max(1, ...(data?.by_strategic_goal ?? []).map((g) => g.total));
  const maxArea = Math.max(1, ...(data?.by_thematic_area ?? []).map((a) => a.total));

  const KPIS = [
    { label: t("mande.dashboard.approvedPifs"), value: k?.approved_pifs ?? 0, icon: "account_tree", color: "text-primary", bg: "bg-primary/10" },
    { label: t("mande.dashboard.awaitingReport"), value: k?.awaiting_report ?? 0, icon: "pending_actions", color: "text-amber-600", bg: "bg-amber-50" },
    { label: t("correspondence.status.pendingReview"), value: k?.pending_review ?? 0, icon: "rate_review", color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: t("mande.dashboard.evidencePending"), value: k?.evidence_pending ?? 0, icon: "folder_open", color: "text-orange-600", bg: "bg-orange-50" },
    { label: t("mande.dashboard.overdueReports"), value: k?.overdue_reports ?? 0, icon: "event_busy", color: "text-red-600", bg: "bg-red-50" },
    { label: t("mande.dashboard.indicatorsUpdated"), value: k?.indicators_updated ?? 0, icon: "speed", color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title={t("mande.dashboard.title")}
        subtitle={t("mande.dashboard.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.dashboard.title") }]} />}
      />
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/mande/intake" className="btn-secondary flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">inbox</span>
            {t("mande.intake.crumb")}
          </Link>
          <Link href="/mande/data-quality" className="btn-secondary flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">fact_check</span>
            {t("mande.dataQuality.title")}
          </Link>
          <Link href="/mande/activity-reports" className="btn-secondary flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">description</span>
            {t("mande.dashboard.reports")}
          </Link>
          <Link href="/mande/activity-reports/create" className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("mande.create.title")}
          </Link>
        </div>
      </div>

      <ModuleHubCards cards={MANDE_HUB_CARDS} />

      {isError && <ErrorBanner message={t("mande.dashboard.loadFailed")} />}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="card px-4 py-4 flex flex-col gap-2">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${kpi.bg}`}>
              <span className={`material-symbols-outlined text-[20px] ${kpi.color}`}>{kpi.icon}</span>
            </div>
            <p className="text-2xl font-bold text-neutral-900 leading-none">{isLoading ? "—" : kpi.value}</p>
            <p className="text-[11px] text-neutral-500 leading-tight">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Activities by strategic goal */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">{t("mande.dashboard.byGoal")}</h2>
          <div className="space-y-2">
            {(data?.by_strategic_goal ?? []).map((g, i) => (
              <Bar key={i} label={g.goal_title} value={g.total} max={maxGoal} color="bg-indigo-400" />
            ))}
            {!isLoading && (data?.by_strategic_goal?.length ?? 0) === 0 && (
              <EmptyState icon="flag" title={t("mande.dashboard.noReports")} className="py-6 min-h-0" />
            )}
          </div>
        </div>

        {/* Activities by thematic area */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">{t("mande.dashboard.byArea")}</h2>
          <div className="space-y-2">
            {(data?.by_thematic_area ?? []).map((a, i) => (
              <Bar key={i} label={a.area_name} value={a.total} max={maxArea} color="bg-teal-400" />
            ))}
            {!isLoading && (data?.by_thematic_area?.length ?? 0) === 0 && (
              <EmptyState icon="category" title={t("mande.dashboard.noReports")} className="py-6 min-h-0" />
            )}
          </div>
        </div>
      </div>

      {/* Review queue */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("mande.dashboard.reviewQueue")}</h2>
          <Link href="/mande/review-queue" className="btn-secondary text-xs py-1 px-2">{t("common.viewAll")}</Link>
        </div>
        {(data?.review_queue?.length ?? 0) === 0 ? (
          <EmptyState icon="rate_review" title={t("mande.dashboard.noAwaiting")} className="py-8 min-h-0" />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>{t("correspondence.col.reference")}</th><th>{t("mande.col.activity")}</th><th>{t("mande.col.pif")}</th><th>{t("correspondence.col.status")}</th><th>{t("mande.col.submitted")}</th><th></th></tr>
            </thead>
            <tbody>
              {data!.review_queue.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.reference_number}</td>
                  <td className="font-medium text-neutral-900">{r.activity_title}</td>
                  <td className="text-xs text-neutral-500">{r.pif_number ?? "—"}</td>
                  <td><span className={`badge ${STATUS_BADGE[r.review_status] ?? "badge-muted"}`}>{reviewStatusLabel(t, r.review_status)}</span></td>
                  <td className="text-xs text-neutral-400">{r.submitted_at ? formatDateShort(r.submitted_at) : "—"}</td>
                  <td><Link href={`/mande/activity-reports/${r.id}`} className="btn-secondary text-xs py-1 px-2">{t("common.open")}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
