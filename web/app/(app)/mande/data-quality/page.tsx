"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeDataQualityReport } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";

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
        { key: "severity", header: "Severity" },
        { key: "code", header: "Code" },
        { key: "reference", header: "Reference" },
        { key: "title", header: "Title" },
        { key: "message", header: "Message" },
        { key: "remediation", header: "Suggested action" },
        { key: "url", header: "Link" },
      ]
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Data Quality"
        subtitle="Weighted score and remediation for missing M&amp;E records, overdue submissions, and evidence gaps."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Data Quality" }]} />}
      />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
            disabled={!data?.issues.length}
            onClick={downloadRemediation}
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Remediation CSV
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-1.5 text-sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Rescan
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load data-quality scan.
        </div>
      )}

      {isLoading || !data ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">Scanning…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="card px-4 py-4 col-span-2 sm:col-span-1">
              <p className={`text-2xl font-bold ${GRADE_COLOR[data.grade] ?? "text-neutral-900"}`}>
                {data.score}
              </p>
              <p className="text-[11px] text-neutral-500">Score</p>
              <p className="text-xs font-medium mt-1">{data.grade}</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-neutral-900">{data.summary.total}</p>
              <p className="text-[11px] text-neutral-500">Total issues</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-red-600">{data.summary.error}</p>
              <p className="text-[11px] text-neutral-500">Errors</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-amber-600">{data.summary.warning}</p>
              <p className="text-[11px] text-neutral-500">Warnings</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-neutral-900">{data.score_breakdown.length}</p>
              <p className="text-[11px] text-neutral-500">Impact groups</p>
            </div>
          </div>

          {data.score_breakdown.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100">
                <h2 className="text-sm font-semibold text-neutral-800">Score breakdown</h2>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Count</th>
                    <th>Impact</th>
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
              <h2 className="text-sm font-semibold text-neutral-800">Issues</h2>
            </div>
            {data.issues.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-neutral-400">No issues found.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Code</th>
                    <th>Reference</th>
                    <th>Message / remediation</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.issues.map((issue, i) => (
                    <tr key={`${issue.code}-${issue.entity_id}-${i}`}>
                      <td>
                        <span className={SEVERITY[issue.severity] ?? "badge-muted"}>{issue.severity}</span>
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
                          <Link href={issue.url} className="text-xs text-primary hover:underline">
                            Open
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
