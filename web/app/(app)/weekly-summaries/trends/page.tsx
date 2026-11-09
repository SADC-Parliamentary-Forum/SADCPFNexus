"use client";

import { useQuery } from "@tanstack/react-query";
import { weeklyReportsApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["weekly-trends"],
    queryFn: async () => (await weeklyReportsApi.trends()).data.data,
  });

  const payload = asRecord(data) ?? {};
  const summary = asRecord(payload.summary);
  const series = asRows(payload.series);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="weeklySummaries.trends.title"
        subtitle="weeklySummaries.trends.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "weeklySummaries.crumb", href: "/weekly-summaries" },
              { label: "weeklySummaries.trends.title" },
            ]}
          />
        }
      />

      {isLoading ? (
        <div className="card space-y-3 p-6" aria-live="polite">
          <p className="text-sm text-neutral-500">{t("common.loading")}</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : t("weeklySummaries.trends.loadFailed")}
        </div>
      ) : null}

      {!isLoading && !isError && summary ? (
        <FormSection title="weeklySummaries.trends.snapshot" description="weeklySummaries.trends.snapshotHint" icon="monitoring">
          <LabelledRecord
            value={{
              [t("weeklySummaries.trends.field.completionRate")]: summary.completion_rate != null ? `${summary.completion_rate}%` : "—",
              [t("weeklySummaries.trends.field.missingOrLate")]: summary.missing_or_late,
              [t("weeklySummaries.trends.field.totalReports")]: summary.total_reports,
            }}
          />
        </FormSection>
      ) : null}

      {!isLoading && !isError ? (
        <FormSection title="weeklySummaries.trends.weeks" description="weeklySummaries.trends.weeksHint" icon="calendar_month">
          {series.length === 0 ? (
            <EmptyState
              icon="monitoring"
              title="weeklySummaries.trends.empty"
              description="weeklySummaries.trends.emptyHint"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="p-2">{t("weeklySummaries.trends.col.week")}</th>
                    <th className="p-2">{t("decisions.stat.total")}</th>
                    <th className="p-2">{t("weeklySummaries.trends.col.completed")}</th>
                    <th className="p-2">{t("weeklySummaries.trends.col.missingLate")}</th>
                    <th className="p-2">{t("weeklySummaries.trends.col.rate")}</th>
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
