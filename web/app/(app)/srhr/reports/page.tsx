"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { researcherReportsApi, type ResearcherReport } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:              { label: "srhr.reportStatus.draft", cls: "badge-muted"    },
  submitted:          { label: "srhr.reportStatus.submitted", cls: "badge-primary"  },
  acknowledged:       { label: "srhr.reportStatus.acknowledged", cls: "badge-success"  },
  revision_requested: { label: "srhr.reportStatus.revision_requested", cls: "badge-warning"  },
  archived:           { label: "srhr.reportStatus.archived", cls: "badge-muted"    },
};

const typeLabel: Record<string, string> = {
  monthly:   "srhr.reportType.monthly",
  quarterly: "srhr.reportType.quarterly",
  annual:    "srhr.reportType.annual",
  ad_hoc:    "srhr.reportType.ad_hoc",
};

const FILTERS = [
  { label: "timesheet.import.filterAll", value: "" },
  { label: "srhr.reportStatus.draft", value: "draft" },
  { label: "srhr.reportStatus.submitted", value: "submitted" },
  { label: "srhr.reportStatus.acknowledged", value: "acknowledged" },
  { label: "srhr.reports.filterRevision", value: "revision_requested" },
];

export default function ResearcherReportsPage() {
  const { t } = useI18n();
  const [reports, setReports] = useState<ResearcherReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState("");
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    researcherReportsApi
      .list({ status: status || undefined, search: search || undefined, per_page: 20, page })
      .then((res) => {
        setReports(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
      })
      .finally(() => setLoading(false));
  }, [status, search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title="srhr.deployment.activityReports"
        subtitle="srhr.reports.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "srhr.deployment.activityReports" }]} />}
      />
        <Link href="/srhr/reports/new" className="btn-primary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add_notes</span>
          {t("srhr.submitReport")}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
              className={`filter-tab${status === f.value ? " active" : ""}`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">search</span>
          <input
            className="form-input pl-9 w-56"
            placeholder={t("srhr.search")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <p className="text-sm text-neutral-500">{t(total === 1 ? "srhr.reports.countOne" : "srhr.reports.countMany", { count: total })}</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("srhr.col.ref")}</th>
              <th>{t("srhr.reports.colTitle")}</th>
              <th>{t("srhr.col.researcher")}</th>
              <th>{t("srhr.col.parliament")}</th>
              <th>{t("srhr.col.type")}</th>
              <th>{t("srhr.reports.colPeriod")}</th>
              <th>{t("hr.timesheets.monthly.status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}><div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4" /></td>
                    ))}
                  </tr>
                ))
              : reports.length === 0
              ? (
                  <TableEmpty colSpan={8} title={t("srhr.reports.empty")} />
                )
              : reports.map((r) => (
                  <tr key={r.id}>
                    <td><span className="font-mono text-xs text-neutral-600">{r.reference_number}</span></td>
                    <td>
                      <p className="text-sm font-medium text-neutral-900 max-w-xs truncate">{r.title}</p>
                    </td>
                    <td className="text-sm text-neutral-700">{r.employee?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{r.parliament?.country_name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{typeLabel[r.report_type] ? t(typeLabel[r.report_type]) : r.report_type}</td>
                    <td className="text-sm text-neutral-500 whitespace-nowrap">
                      {formatDate(r.period_start)} – {formatDate(r.period_end)}
                    </td>
                    <td>
                      <span className={`badge ${statusConfig[r.status]?.cls ?? "badge-muted"}`}>
                        {statusConfig[r.status] ? t(statusConfig[r.status].label) : r.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/srhr/reports/${r.id}`} className="btn-secondary text-xs py-1 px-2">{t("hr.timesheets.team.view")}</Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn-secondary text-xs px-3 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</button>
          <span className="text-xs text-neutral-500">{t("common.pageOf", { page, total: lastPage })}</span>
          <button className="btn-secondary text-xs px-3 py-1.5" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</button>
        </div>
      )}
    </div>
  );
}
