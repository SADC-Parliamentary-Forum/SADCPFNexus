"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { LIFECYCLE_HUB_CARDS } from "@/lib/hubs/lifecycle";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LifecycleDashboardPage() {
  const { t } = useI18n();
  const dashboardQuery = useQuery({
    queryKey: ["lifecycle", "dashboard"],
    queryFn: async () => (await lifecycleApi.dashboard()).data.data,
  });
  const casesQuery = useQuery({
    queryKey: ["lifecycle", "cases"],
    queryFn: async () => (await lifecycleApi.listCases()).data.data,
  });

  const stats = dashboardQuery.data;
  const cases = casesQuery.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.common.breadcrumb")}
        subtitle={t("lifecycle.hub.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("lifecycle.common.breadcrumb") }]} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          { key: "onboarding", label: t("lifecycle.hub.kpi.openOnboarding"), value: stats?.onboarding_open ?? 0, href: "/lifecycle/onboarding" },
          { key: "internal", label: t("lifecycle.hub.kpi.openInternal"), value: stats?.internal_open ?? 0, href: "/lifecycle/journeys" },
          { key: "separation", label: t("lifecycle.hub.kpi.openSeparation"), value: stats?.separation_open ?? 0, href: "/lifecycle/separation" },
          { key: "clearance", label: t("lifecycle.hub.kpi.awaitingClearance"), value: stats?.awaiting_clearance ?? 0, href: "/lifecycle/separation" },
          { key: "ready", label: t("lifecycle.hub.kpi.readyOnboarding"), value: stats?.ready_onboarding ?? 0, href: "/lifecycle/onboarding" },
        ].map((kpi) => (
          <Link key={kpi.key} href={kpi.href} className="card p-5 hover:shadow-elevated transition-all">
            <p className="text-2xl font-bold text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-500 mt-1">{kpi.label}</p>
          </Link>
        ))}
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-800">{t("lifecycle.hub.moreTools")}</summary>
        <div className="mt-4">
          <ModuleHubCards cards={LIFECYCLE_HUB_CARDS} />
        </div>
      </details>

      <FormSection title={t("lifecycle.hub.recent")} description={t("lifecycle.hub.recentHint")}>
        {casesQuery.isLoading ? <p className="text-sm text-neutral-500">{t("lifecycle.hub.loading")}</p> : null}
        {casesQuery.isError ? <p className="text-sm text-red-600">{t("lifecycle.hub.loadFailed")}</p> : null}
        {!casesQuery.isLoading && cases.length === 0 ? (
          <EmptyState title={t("lifecycle.hub.empty")} description={t("lifecycle.hub.emptyHint")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b">
                  <th className="py-2 pr-4">{t("lifecycle.common.reference")}</th>
                  <th className="py-2 pr-4">{t("lifecycle.common.type")}</th>
                  <th className="py-2 pr-4">{t("lifecycle.common.employee")}</th>
                  <th className="py-2 pr-4">{t("lifecycle.common.start")}</th>
                  <th className="py-2">{t("lifecycle.common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, 20).map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">
                      <Link href={`/lifecycle/cases/${row.id}`} className="text-primary font-medium">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 capitalize">{row.lifecycle_type}</td>
                    <td className="py-2 pr-4">{row.employee_name ?? "—"}</td>
                    <td className="py-2 pr-4">{row.start_date ? formatDateShort(row.start_date) : "—"}</td>
                    <td className="py-2 capitalize">{row.status.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>
    </div>
  );
}
