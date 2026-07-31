"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export default function WeeklyTrendsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["weekly-trends"],
    queryFn: async () => (await api.get("/weekly-summaries/trends")).data.data,
  });

  const series = (data?.series ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Weekly digest trends"
        subtitle="Completion rates and missing digests over time."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Weekly digest trends" }]} />}
      />
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-700">Failed to load trends.</p>}
      {data && (
        <p className="text-sm text-neutral-600">
          Completion {data.summary?.completion_rate}% · Missing/late {data.summary?.missing_or_late} · Total {data.summary?.total_reports}
        </p>
      )}
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">Week</th><th className="p-2">Total</th><th className="p-2">Completed</th><th className="p-2">Missing/late</th><th className="p-2">Rate</th></tr></thead>
          <tbody>
            {series.map((s) => (
              <tr key={String(s.week_start)} className="border-t border-neutral-200">
                <td className="p-2">{String(s.week_start)}</td>
                <td className="p-2">{String(s.total)}</td>
                <td className="p-2">{String(s.completed)}</td>
                <td className="p-2">{String(s.missing_or_late)}</td>
                <td className="p-2">{String(s.completion_rate)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
