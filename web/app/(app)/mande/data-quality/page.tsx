"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeDataQualityReport } from "@/lib/api";

const SEVERITY: Record<string, string> = {
  error: "badge-danger",
  warning: "badge-warning",
};

export default function MandeDataQualityPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["mande", "data-quality"],
    queryFn: () => mandeApi.getDataQuality().then((r) => r.data.data as MeDataQualityReport),
    staleTime: 15_000,
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Data Quality</h1>
          <p className="page-subtitle">
            Scan for missing M&amp;E records, overdue submissions, missing evidence, and date issues.
          </p>
        </div>
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

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load data-quality scan.
        </div>
      )}

      {isLoading || !data ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">Scanning…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              <p className="text-2xl font-bold text-neutral-900">{Object.keys(data.summary.by_code).length}</p>
              <p className="text-[11px] text-neutral-500">Check types</p>
            </div>
          </div>

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
                    <th>Message</th>
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
                      <td className="text-sm">{issue.message}</td>
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
