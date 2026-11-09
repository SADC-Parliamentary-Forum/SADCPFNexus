"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { RiskPageFrame } from "@/components/risk/RiskPageFrame";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { riskApi, type RiskMatrixData, type RiskDashboardData, type RiskCategory } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellBg(score: number): string {
  if (score >= 16) return "bg-red-500 text-white";
  if (score >= 11) return "bg-orange-400 text-white";
  if (score >= 6)  return "bg-yellow-300 text-neutral-900";
  return "bg-green-200 text-neutral-900";
}

function deptGrade(critical: number, overdueActions: number): { grade: string; cls: string } {
  if (critical === 0 && overdueActions === 0) return { grade: "A", cls: "badge-success" };
  if (critical <= 1 && overdueActions <= 2)   return { grade: "B", cls: "badge-warning" };
  if (critical <= 3)                          return { grade: "C", cls: "badge-warning" };
  return { grade: "D", cls: "badge-danger" };
}

const STATUS_LABELS: Record<string, string> = {
  draft: "risk.analytics.status.draft", submitted: "risk.analytics.status.submitted",
  reviewed: "risk.analytics.status.reviewed", approved: "risk.analytics.status.approved",
  monitoring: "risk.analytics.status.monitoring", escalated: "risk.analytics.status.escalated",
  closed: "risk.analytics.status.closed", archived: "risk.analytics.status.archived",
};

const CATEGORY_LABELS: Record<string, string> = {
  strategic: "risk.create.category.strategic", operational: "risk.create.category.operational",
  financial: "risk.create.category.financial", compliance: "risk.create.category.compliance",
  reputational: "risk.create.category.reputational", security: "risk.create.category.security",
  other: "risk.create.category.other",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-neutral-300", submitted: "bg-amber-400", reviewed: "bg-blue-400",
  approved: "bg-green-500", monitoring: "bg-teal-400", escalated: "bg-red-500",
  closed: "bg-neutral-400", archived: "bg-neutral-300",
};

const CATEGORY_ICONS: Record<string, string> = {
  strategic: "flag", operational: "settings", financial: "payments",
  compliance: "gavel", reputational: "verified_user", security: "security", other: "more_horiz",
};

const CATEGORY_COLORS: Record<string, string> = {
  strategic: "text-indigo-600", operational: "text-blue-600", financial: "text-green-600",
  compliance: "text-teal-600", reputational: "text-orange-600", security: "text-red-600", other: "text-neutral-500",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RiskAnalyticsPage() {
  const { t } = useI18n();
  const { data: matrix, isLoading: matrixLoading } = useQuery({
    queryKey: ["risk", "matrix", "analytics"],
    queryFn: () => riskApi.getMatrix().then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: dashboard } = useQuery({
    queryKey: ["risk", "dashboard", "analytics"],
    queryFn: () => riskApi.getDashboard().then((r) => r.data.data as RiskDashboardData),
    staleTime: 60_000,
  });

  const total     = matrix?.totals.total ?? 0;
  const open      = matrix?.totals.open ?? 0;
  const critical  = matrix?.by_risk_level?.critical ?? 0;
  const overdue   = matrix?.totals.overdue_actions ?? 0;

  function handleExport() {
    if (!dashboard?.by_department) return;
    const rows = dashboard.by_department.map((row) => {
      const { grade } = deptGrade(row.critical, row.overdue_actions);
      return {
        department: row.department_name,
        total: row.total,
        critical: row.critical,
        high: row.high,
        overdue_actions: row.overdue_actions,
        grade,
      };
    });
    exportToCsv("risk-analytics", rows, [
      { key: "department",     header: t("risk.analytics.department") },
      { key: "total",          header: t("risk.analytics.totalRisks") },
      { key: "critical",       header: t("risk.create.level.critical") },
      { key: "high",           header: t("risk.create.level.high") },
      { key: "overdue_actions",header: t("risk.analytics.overdueActions") },
      { key: "grade",          header: t("risk.analytics.grade") },
    ]);
  }

  return (
    <RiskPageFrame>
      {/* Header */}
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title={t("risk.analytics.pageTitle")}
        subtitle={t("risk.analytics.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "risk.hub", href: "/risk" }, { label: "risk.analytics.title" }]} />}
      />
        <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">download</span>
          {t("risk.analytics.exportCsv")}
        </button>
      </div>

      {/* Row 1: 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("risk.analytics.totalRisks"), value: matrixLoading ? "—" : total,    icon: "shield",        color: "text-primary",   bg: "bg-primary/10"  },
          { label: t("risk.analytics.openRisks"), value: matrixLoading ? "—" : open,     icon: "warning_amber", color: "text-amber-600", bg: "bg-amber-50"    },
          { label: t("risk.create.level.critical"), value: matrixLoading ? "—" : critical, icon: "crisis_alert",  color: "text-red-600",   bg: "bg-red-50"      },
          { label: t("risk.analytics.overdueActions"), value: matrixLoading ? "—" : overdue, icon: "assignment_late",color: "text-orange-600",bg: "bg-orange-50"  },
        ].map((kpi) => (
          <div key={kpi.label} className="card px-4 py-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
              <span className={`material-symbols-outlined text-[22px] ${kpi.color}`}>{kpi.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 leading-tight">{kpi.value}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Heatmap + Category breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Heatmap (col-span-2) */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-neutral-800 mb-1">{t("risk.analytics.heatmap")}</h2>
          <p className="text-xs text-neutral-500 mb-4">{t("risk.analytics.heatmapHint")}</p>
          <div className="flex gap-2">
            <div className="flex items-center justify-center w-5">
              <span className="text-[10px] text-neutral-400 -rotate-90 whitespace-nowrap">{t("risk.analytics.likelihoodAxis")}</span>
            </div>
            <div className="flex-1">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "22px repeat(5, 1fr)" }}>
                <div />
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="text-center text-[10px] text-neutral-400 font-medium pb-0.5">{i}</div>
                ))}
                {[5, 4, 3, 2, 1].map((l) => (
                  <React.Fragment key={l}>
                    <div className="flex items-center justify-center text-[10px] text-neutral-400 font-medium">{l}</div>
                    {[1, 2, 3, 4, 5].map((im) => {
                      const score = l * im;
                      const cell  = matrix?.cells.find((c) => c.likelihood === l && c.impact === im);
                      const count = cell?.count ?? 0;
                      return (
                        <div
                          key={`${l}-${im}`}
                          className={`aspect-square rounded flex items-center justify-center text-xs font-bold ${cellBg(score)}`}
                          title={`L${l}×I${im}=${score} (${count})`} /* i18n-ignore */
                        >
                          {count > 0 && count}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="text-center text-[10px] text-neutral-400 mt-1.5">{t("risk.analytics.impactAxis")}</div>
            </div>
          </div>
          <div className="flex gap-3 mt-4 flex-wrap">
            {[
              { label: t("risk.analytics.zoneLow"), bg: "bg-green-200"  },
              { label: t("risk.analytics.zoneMedium"), bg: "bg-yellow-300" },
              { label: t("risk.analytics.zoneHigh"), bg: "bg-orange-400" },
              { label: t("risk.analytics.zoneCritical"), bg: "bg-red-500"    },
            ].map((z) => (
              <div key={z.label} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded ${z.bg}`} />
                <span className="text-[11px] text-neutral-500">{z.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-4">{t("risk.analytics.byCategory")}</h2>
          {total === 0 ? (
            <EmptyState icon="category" title={t("risk.analytics.noData")} className="py-6 min-h-0" />
          ) : (
            <div className="space-y-3">
              {(Object.entries(matrix?.by_category ?? {}) as [RiskCategory, number][])
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => {
                  if (count === 0) return null;
                  const pct = Math.round((count / total) * 100);
                  const icon = CATEGORY_ICONS[cat] ?? "more_horiz";
                  const color = CATEGORY_COLORS[cat] ?? "text-neutral-500";
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`material-symbols-outlined text-[13px] ${color}`}>{icon}</span>
                          <span className="text-xs text-neutral-700 capitalize">{CATEGORY_LABELS[cat] ? t(CATEGORY_LABELS[cat]) : cat}</span>
                        </div>
                        <span className="text-xs font-semibold text-neutral-800">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Departmental Performance Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("risk.analytics.departmental")}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{t("risk.analytics.gradeLegend")}</p>
        </div>
        {!dashboard?.by_department?.length ? (
          <EmptyState icon="apartment" title={t("risk.analytics.noDepartmental")} className="py-6 min-h-0" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("risk.analytics.department")}</th>
                <th className="text-center">{t("risk.analytics.openRisks")}</th>
                <th className="text-center">{t("risk.create.level.critical")}</th>
                <th className="text-center">{t("risk.create.level.high")}</th>
                <th className="text-center">{t("risk.analytics.overdueActions")}</th>
                <th className="text-center">{t("risk.analytics.grade")}</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.by_department
                .sort((a, b) => b.critical - a.critical)
                .map((row) => {
                  const { grade, cls } = deptGrade(row.critical, row.overdue_actions);
                  return (
                    <tr key={row.department_id ?? "none"}>
                      <td className="font-medium text-neutral-800">{row.department_name}</td>
                      <td className="text-center text-sm">{row.total}</td>
                      <td className="text-center">
                        {row.critical > 0
                          ? <span className="text-sm font-semibold text-red-600">{row.critical}</span>
                          : <span className="text-sm text-neutral-300">—</span>}
                      </td>
                      <td className="text-center">
                        {row.high > 0
                          ? <span className="text-sm font-semibold text-orange-600">{row.high}</span>
                          : <span className="text-sm text-neutral-300">—</span>}
                      </td>
                      <td className="text-center">
                        {row.overdue_actions > 0
                          ? <span className="text-sm font-semibold text-red-600">{row.overdue_actions}</span>
                          : <span className="text-sm text-neutral-300">—</span>}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${cls} text-sm font-bold`}>{grade}</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      {/* Row 4: By Status horizontal bars */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-neutral-800 mb-4">{t("risk.analytics.byStatus")}</h2>
        {total === 0 ? (
          <EmptyState icon="stacked_bar_chart" title={t("risk.analytics.noData")} className="py-6 min-h-0" />
        ) : (
          <div className="space-y-3">
            {(Object.entries(matrix?.by_status ?? {}) as [string, number][])
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                if (count === 0) return null;
                const pct  = Math.round((count / total) * 100);
                const bar  = STATUS_COLORS[status] ?? "bg-neutral-300";
                const label = STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : status;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-xs text-neutral-600 w-24 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-3 rounded-full bg-neutral-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-neutral-700 w-8 text-right">{count}</span>
                    <span className="text-xs text-neutral-400 w-8">{pct}%</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </RiskPageFrame>
  );
}
