"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi, type LifecycleAnalytics, type LifecycleCaseSummary } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Journey rows; `label` is a catalog key translated where it renders. */
const TYPES: Array<{ key: string; label: string }> = [
  { key: "onboarding", label: "lifecycle.onboarding.crumb" },
  { key: "separation", label: "lifecycle.separation.crumb" },
  { key: "transfer", label: "lifecycle.journeys.filter.transfer" },
  { key: "promotion", label: "lifecycle.journeys.filter.promotion" },
  { key: "probation", label: "lifecycle.journeys.filter.probation" },
];

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function LifecycleReportsPage() {
  const { t } = useI18n();
  const analyticsQuery = useQuery({
    queryKey: ["lifecycle", "analytics"],
    queryFn: async () => (await lifecycleApi.analytics()).data.data,
  });
  const onboardingQuery = useQuery({
    queryKey: ["lifecycle", "reports", "onboarding"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "onboarding" })).data.data,
  });
  const separationQuery = useQuery({
    queryKey: ["lifecycle", "reports", "separation"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "separation" })).data.data,
  });
  const transferQuery = useQuery({
    queryKey: ["lifecycle", "reports", "transfer"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "transfer" })).data.data,
  });
  const promotionQuery = useQuery({
    queryKey: ["lifecycle", "reports", "promotion"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "promotion" })).data.data,
  });
  const probationQuery = useQuery({
    queryKey: ["lifecycle", "reports", "probation"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "probation" })).data.data,
  });

  const analytics: LifecycleAnalytics | undefined = analyticsQuery.data;
  const aging = analytics?.clearance_aging;

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.reports.title")}
        subtitle={t("lifecycle.reports.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" }, { label: t("lifecycle.reports.crumb") }]} />
        }
      />

      {analyticsQuery.isError ? (
        <p className="text-sm text-red-600">{t("lifecycle.reports.loadFailed")}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("lifecycle.reports.kpi.exceptions")} value={analytics?.exceptions_open ?? "—"} />
        <Kpi label={t("lifecycle.reports.kpi.aging0")} value={aging?.["0_7"] ?? "—"} />
        <Kpi label={t("lifecycle.reports.kpi.aging8")} value={aging?.["8_14"] ?? "—"} />
        <Kpi label={t("lifecycle.reports.kpi.aging15")} value={aging?.["15_plus"] ?? "—"} />
      </div>

      <FormSection title={t("lifecycle.reports.cycleTime")}>
        {analyticsQuery.isLoading ? <p className="text-sm text-neutral-500">{t("lifecycle.reports.loading")}</p> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-neutral-500">
                <th className="py-2 pr-4">{t("lifecycle.reports.col.journey")}</th>
                <th className="py-2 pr-4">{t("lifecycle.reports.col.open")}</th>
                <th className="py-2 pr-4">{t("lifecycle.reports.col.completed")}</th>
                <th className="py-2">{t("lifecycle.reports.col.avgCycle")}</th>
              </tr>
            </thead>
            <tbody>
              {TYPES.map((type) => {
                const row = analytics?.by_type[type.key];
                return (
                  <tr key={type.key} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-4">{t(type.label)}</td>
                    <td className="py-2 pr-4 tabular-nums">{row?.open ?? "—"}</td>
                    <td className="py-2 pr-4 tabular-nums">{row?.completed ?? "—"}</td>
                    <td className="py-2 tabular-nums">
                      {row?.avg_cycle_days == null ? "—" : row.avg_cycle_days}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormSection>

      <FormSection title={t("lifecycle.reports.bottlenecks")}>
        {(analytics?.bottlenecks ?? []).length === 0 && !analyticsQuery.isLoading ? (
          <EmptyState icon="pending_actions" title={t("lifecycle.reports.noBottlenecks")} className="py-6 min-h-0" />
        ) : (
          <ul className="space-y-2 text-sm">
            {(analytics?.bottlenecks ?? []).map((item) => (
              <li key={item.task_key} className="flex justify-between gap-4 border-b border-neutral-100 py-2 dark:border-neutral-800">
                <span>
                  {item.title}{" "}
                  <span className="text-neutral-500">{t("lifecycle.reports.openCount", { count: item.open_count })}</span>
                </span>
                <span className="tabular-nums text-neutral-600">{t("lifecycle.reports.days", { count: item.avg_age_days })}</span>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {([
        { key: "onboarding", title: t("lifecycle.reports.cases.onboarding"), rows: onboardingQuery.data ?? [], loading: onboardingQuery.isLoading },
        { key: "transfer", title: t("lifecycle.reports.cases.transfer"), rows: transferQuery.data ?? [], loading: transferQuery.isLoading },
        { key: "promotion", title: t("lifecycle.reports.cases.promotion"), rows: promotionQuery.data ?? [], loading: promotionQuery.isLoading },
        { key: "probation", title: t("lifecycle.reports.cases.probation"), rows: probationQuery.data ?? [], loading: probationQuery.isLoading },
        { key: "separation", title: t("lifecycle.reports.cases.separation"), rows: separationQuery.data ?? [], loading: separationQuery.isLoading },
      ] as Array<{ key: string; title: string; rows: LifecycleCaseSummary[]; loading: boolean }>).map((section) => (
        <FormSection key={section.key} title={section.title}>
          {section.loading ? <p className="text-sm text-neutral-500">{t("common.loading")}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b">
                  <th className="py-2 pr-4">{t("lifecycle.common.reference")}</th>
                  <th className="py-2 pr-4">{t("lifecycle.common.employee")}</th>
                  <th className="py-2 pr-4">{t("lifecycle.common.start")}</th>
                  <th className="py-2">{t("lifecycle.common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">
                      <Link href={`/lifecycle/cases/${row.id}`} className="text-primary">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{row.employee_name ?? "—"}</td>
                    <td className="py-2 pr-4">{row.start_date ? formatDateShort(row.start_date) : "—"}</td>
                    <td className="py-2 capitalize">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormSection>
      ))}
    </div>
  );
}
