"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditAnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "analytics"],
    queryFn: async () => (await auditApi.analytics()).data.data,
  });

  const rating = (data?.rating_distribution ?? {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ModulePageHeader
        title="Audit analytics"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Audit analytics" }]} />}
      />
        <Link href="/audit" className="text-sm underline">Dashboard</Link>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading analytics…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load analytics.</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["cycle_time_days_avg", "Avg cycle time (days)"],
              ["overdue_corrective_rate", "Overdue CA rate %"],
              ["plan_completion_pct", "Plan completion %"],
              ["open_findings", "Open findings"],
            ].map(([key, label]) => (
              <div key={key} className="border border-neutral-200 rounded-lg p-4 bg-white">
                <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
                <div className="text-2xl font-semibold mt-2">{String(data[key] ?? 0)}</div>
              </div>
            ))}
          </div>

          <div className="border border-neutral-200 rounded-lg p-4 bg-white">
            <h2 className="font-medium mb-3">Rating distribution</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.keys(rating).length === 0 && <span className="text-neutral-500">No findings yet.</span>}
              {Object.entries(rating).map(([k, v]) => (
                <span key={k} className="px-3 py-1 border rounded bg-neutral-50">
                  {k || "unset"}: <strong>{v}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="border border-neutral-200 rounded-lg p-4 bg-white overflow-x-auto">
            <h2 className="font-medium mb-3">Plan completion</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Plan</th>
                  <th className="p-2">FY</th>
                  <th className="p-2">Completion</th>
                  <th className="p-2">Engagements</th>
                </tr>
              </thead>
              <tbody>
                {((data.plans as Array<Record<string, unknown>>) ?? []).map((p) => (
                  <tr key={String(p.plan_id)} className="border-b">
                    <td className="p-2">{String(p.title)}</td>
                    <td className="p-2">{String(p.fiscal_year)}</td>
                    <td className="p-2">{String(p.completion_pct)}%</td>
                    <td className="p-2">{String(p.completed_engagements)}/{String(p.total_engagements)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
