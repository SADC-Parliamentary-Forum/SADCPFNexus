"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssignmentsCapacityPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments-capacity"],
    queryFn: () => assignmentsApi.capacity().then((r) => r.data.data),
  });

  const assignees = (data?.assignees ?? []) as Array<{
    user_id: number;
    name?: string;
    job_title?: string | null;
    open_count?: number;
    overdue_count?: number;
    load_score?: number;
    load_band?: string;
  }>;
  const summary = data?.summary ?? {};

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("assignments.capacity.title")}
        subtitle={t("assignments.capacity.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.assignments", href: "/assignments" },
              { label: t("assignments.calendar.capacity") },
            ]}
          />
        }
        actions={
          <>
            <Link href="/assignments/calendar" className="btn-secondary text-sm">{t("assignments.capacity.calendarIcs")}</Link>
            <Link href="/assignments/workload" className="btn-secondary text-sm">{t("assignments.capacity.workloadForecast")}</Link>
          </>
        }
      />

      {isLoading && <p className="text-sm text-neutral-500">{t("assignments.capacity.loading")}</p>}
      {isError && <p className="text-sm text-red-700">{t("assignments.capacity.loadFailed")}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{t("assignments.capacity.assignees")}</p>
          <p className="mt-1 text-2xl font-semibold">{summary.assignee_count ?? 0}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{t("assignments.capacity.open")}</p>
          <p className="mt-1 text-2xl font-semibold">{summary.open_total ?? 0}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{t("assignments.overdueBadge")}</p>
          <p className="mt-1 text-2xl font-semibold">{summary.overdue_total ?? 0}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">{t("assignments.capacity.assignee")}</th>
              <th className="px-4 py-3">{t("assignments.capacity.open")}</th>
              <th className="px-4 py-3">{t("assignments.overdueBadge")}</th>
              <th className="px-4 py-3">{t("assignments.capacity.load")}</th>
              <th className="px-4 py-3">{t("assignments.capacity.band")}</th>
            </tr>
          </thead>
          <tbody>
            {assignees.map((row) => (
              <tr key={row.user_id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-900">{row.name}</div>
                  {row.job_title && <div className="text-xs text-neutral-500">{row.job_title}</div>}
                </td>
                <td className="px-4 py-3">{row.open_count ?? 0}</td>
                <td className="px-4 py-3">{row.overdue_count ?? 0}</td>
                <td className="px-4 py-3">{row.load_score ?? 0}</td>
                <td className="px-4 py-3 capitalize">{row.load_band ?? "—"}</td>
              </tr>
            ))}
            {!isLoading && assignees.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon="groups" title={t("assignments.capacity.empty")} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
