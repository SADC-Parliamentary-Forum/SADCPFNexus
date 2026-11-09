"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeDataQualityReport } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const SEVERITY_LABEL: Record<string, string> = {
  error: "mande.dataQuality.severity.error",
  warning: "mande.dataQuality.severity.warning",
};

const GRADE_LABEL: Record<string, string> = {
  Excellent: "mande.dataQuality.grade.excellent",
  Good: "mande.dataQuality.grade.good",
  "Needs attention": "mande.dataQuality.grade.needsAttention",
  Critical: "mande.dataQuality.grade.critical",
};

const SEVERITY: Record<string, string> = {
  error: "badge-danger",
  warning: "badge-warning",
};

const GRADE_COLOR: Record<string, string> = {
  Excellent: "text-green-700",
  Good: "text-teal-700",
  "Needs attention": "text-amber-700",
  Critical: "text-red-700",
};

export default function MandeDataQualityPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["mande", "data-quality"],
    queryFn: () => mandeApi.getDataQuality().then((r) => r.data.data as MeDataQualityReport),
    staleTime: 15_000,
  });

  function downloadRemediation() {
    if (!data) return;
    exportToCsv(
      "mande-data-quality-remediation",
      data.issues.map((i) => ({
        severity: i.severity,
        code: i.code,
        reference: i.reference ?? "",
        title: i.title ?? "",
        message: i.message,
        remediation: i.remediation ?? "",
        url: i.url ?? "",
      })),
      [
        { key: "severity", header: t("mande.dataQuality.severity") },
        { key: "code", header: t("fleet.col.code") },
        { key: "reference", header: t("correspondence.col.reference") },
        { key: "title", header: t("mande.col.title") },
        { key: "message", header: t("mande.dataQuality.message") },
        { key: "remediation", header: t("mande.dataQuality.suggestedAction") },
        { key: "url", header: t("mande.dataQuality.link") },
      ]
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("mande.dataQuality.title")}
        subtitle={t("mande.dataQuality.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.dataQuality.title") }]} />}
      />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
            disabled={!data?.issues.length}
            onClick={downloadRemediation}
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            {t("mande.dataQuality.remediationCsv")}
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-1.5 text-sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            {t("mande.dataQuality.rescan")}
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.dataQuality.loadFailed")}
        </div>
      )}

      {isLoading || !data ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("mande.dataQuality.scanning")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="card px-4 py-4 col-span-2 sm:col-span-1">
              <p className={`text-2xl font-bold ${GRADE_COLOR[data.grade] ?? "text-neutral-900"}`}>
                {data.score}
              </p>
              <p className="text-[11px] text-neutral-500">{t("mande.dataQuality.score")}</p>
              <p className="text-xs font-medium mt-1">{GRADE_LABEL[data.grade] ? t(GRADE_LABEL[data.grade]) : data.grade}</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-neutral-900">{data.summary.total}</p>
              <p className="text-[11px] text-neutral-500">{t("mande.dataQuality.totalIssues")}</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-red-600">{data.summary.error}</p>
              <p className="text-[11px] text-neutral-500">{t("mande.dataQuality.errors")}</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-amber-600">{data.summary.warning}</p>
              <p className="text-[11px] text-neutral-500">{t("mande.dataQuality.warnings")}</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-neutral-900">{data.score_breakdown.length}</p>
              <p className="text-[11px] text-neutral-500">{t("mande.dataQuality.impactGroups")}</p>
            </div>
          </div>

          {data.score_breakdown.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100">
                <h2 className="text-sm font-semibold text-neutral-800">{t("mande.dataQuality.breakdown")}</h2>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("fleet.col.code")}</th>
                    <th>{t("mande.dataQuality.count")}</th>
                    <th>{t("mande.dataQuality.impact")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.score_breakdown.map((b) => (
                    <tr key={b.code}>
                      <td className="font-mono text-xs">{b.code}</td>
                      <td className="text-xs">{b.count}</td>
                      <td className="text-xs">−{b.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-800">{t("mande.dataQuality.issues")}</h2>
            </div>
            {data.issues.length === 0 ? (
              <EmptyState icon="verified" title={t("mande.dataQuality.noIssues")} />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("mande.dataQuality.severity")}</th>
                    <th>{t("fleet.col.code")}</th>
                    <th>{t("correspondence.col.reference")}</th>
                    <th>{t("mande.dataQuality.messageRemediation")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.issues.map((issue, i) => (
                    <tr key={`${issue.code}-${issue.entity_id}-${i}`}>
                      <td>
                        <span className={SEVERITY[issue.severity] ?? "badge-muted"}>{SEVERITY_LABEL[issue.severity] ? t(SEVERITY_LABEL[issue.severity]) : issue.severity}</span>
                      </td>
                      <td className="font-mono text-xs">{issue.code}</td>
                      <td className="text-xs">
                        <div className="font-mono">{issue.reference ?? "—"}</div>
                        <div className="text-neutral-500 truncate max-w-[220px]">{issue.title}</div>
                      </td>
                      <td className="text-sm">
                        <div>{issue.message}</div>
                        {issue.remediation && (
                          <div className="text-xs text-neutral-500 mt-1">{issue.remediation}</div>
                        )}
                      </td>
                      <td>
                        {issue.url ? (
                          <Link href={issue.url} className="btn-secondary text-xs py-1 px-2">
                            {t("common.open")}
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
