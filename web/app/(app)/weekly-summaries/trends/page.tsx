"use client";

import { useQuery } from "@tanstack/react-query";
import { weeklyReportsApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
}

export default function WeeklyTrendsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["weekly-trends"],
    queryFn: async () => (await weeklyReportsApi.trends()).data.data,
  });

  const payload = asRecord(data) ?? {};
  const summary = asRecord(payload.summary);
  const series = asRows(payload.series);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Weekly digest trends"
        subtitle="Completion rates and missing digests over time."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Weekly Summaries", href: "/weekly-summaries" },
              { label: "Weekly digest trends" },
            ]}
          />
        }
      />

      {isLoading ? (
        <div className="card space-y-3 p-6" aria-live="polite">
          <p className="text-sm text-neutral-500">Loading…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Failed to load trends."}
        </div>
      ) : null}

      {!isLoading && !isError && summary ? (
        <FormSection title="Snapshot" description="Current window totals for weekly digest completion." icon="monitoring">
          <LabelledRecord
            value={{
              completion_rate: summary.completion_rate != null ? `${summary.completion_rate}%` : "—",
              missing_or_late: summary.missing_or_late,
              total_reports: summary.total_reports,
            }}
          />
        </FormSection>
      ) : null}

      {!isLoading && !isError ? (
        <FormSection title="Weeks" description="One row per week in the trend window." icon="calendar_month">
          {series.length === 0 ? (
            <EmptyState
              icon="monitoring"
              title="No trend weeks yet"
              description="Trends appear after weekly digest periods have been recorded."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="p-2">Week</th>
                    <th className="p-2">Total</th>
                    <th className="p-2">Completed</th>
                    <th className="p-2">Missing/late</th>
                    <th className="p-2">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((row, index) => (
                    <tr key={String(row.week_start ?? index)} className="border-t border-neutral-200">
                      <td className="p-2">{labelledObjectCell(row.week_start)}</td>
                      <td className="p-2">{labelledObjectCell(row.total)}</td>
                      <td className="p-2">{labelledObjectCell(row.completed)}</td>
                      <td className="p-2">{labelledObjectCell(row.missing_or_late)}</td>
                      <td className="p-2">
                        {row.completion_rate != null && row.completion_rate !== ""
                          ? `${labelledObjectCell(row.completion_rate)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FormSection>
      ) : null}
    </div>
  );
}
