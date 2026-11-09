"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { assignmentsApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssignmentsWorkloadPage() {
  const { t } = useI18n();
  const [weeks, setWeeks] = useState(4);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments-workload", weeks],
    queryFn: () => assignmentsApi.workloadForecast({ weeks }).then((r) => r.data.data),
  });

  const assignees = (data?.assignees ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
        title={t("assignments.capacity.workloadForecast")}
        subtitle={t("assignments.workload.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assignments.capacity.workloadForecast") }]} />}
      />
        <Link href="/assignments/capacity" className="btn-secondary text-sm">{t("assignments.workload.capacityBands")}</Link>
      </div>
      <label htmlFor="assignments-workload-weeks-setweeks-number-e-target-value" className="card inline-flex items-center gap-2 p-3 text-sm" data-testid="workload-weeks">
        {t("assignments.workload.weeks")}
        <select id="assignments-workload-weeks-setweeks-number-e-target-value" className="form-input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
          {[2, 4, 8, 12].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      {isLoading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
      {isError && <p className="text-sm text-red-700">{t("assignments.workload.loadFailed")}</p>}
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">{t("assignments.capacity.assignee")}</th><th className="p-2">{t("assignments.capacity.open")}</th><th className="p-2">{t("assignments.handover.colEstHours")}</th><th className="p-2">{t("assignments.workload.available")}</th><th className="p-2">{t("assignments.workload.util")}</th><th className="p-2">{t("assignments.capacity.band")}</th></tr></thead>
          <tbody>
            {assignees.map((a) => (
              <tr key={String(a.user_id)} className="border-t border-neutral-200">
                <td className="p-2">{String(a.name)}</td>
                <td className="p-2">{String(a.open_count)}</td>
                <td className="p-2">{String(a.estimated_hours_total)}</td>
                <td className="p-2">{String(a.available_hours)}</td>
                <td className="p-2">{String(a.utilization_pct)}</td>
                <td className="p-2">{String(a.load_band)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
