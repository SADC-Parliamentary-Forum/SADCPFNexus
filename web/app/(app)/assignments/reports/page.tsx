"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { assignmentsApi } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssignmentReportsPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments", "reports"],
    queryFn: () => assignmentsApi.reportsSummary().then((r) => r.data),
    staleTime: 30_000,
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("assignments.reports.title")}
        subtitle={t("assignments.reports.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assignments.reports.title") }]} />}
      />

      {isLoading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
      {isError && <p className="text-sm text-red-600">{t("assignments.reports.loadFailed")}</p>}

      {data && (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("assignments.reports.scoringPrefix")} <strong>{data.performance_scoring}</strong> {t("assignments.reports.scoringSuffix")}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["assignments.reports.total", data.stats.total],
              ["assignments.overdueBadge", data.stats.overdue],
              ["assignments.status.blocked", data.stats.blocked],
              ["assignments.reports.escalated", data.stats.escalated ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="card p-4">
                <p className="text-2xl font-bold text-neutral-900">{value as number}</p>
                <p className="text-xs text-neutral-500">{t(label as string)}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">{t("assignments.reports.bySource")}</h2>
              {Object.keys(data.by_source ?? {}).length === 0 ? (
                <EmptyState icon="hub" title={t("assignments.reports.noSource")} className="py-6 min-h-0" />
              ) : (
              <ul className="space-y-1 text-sm">
                {Object.entries(data.by_source ?? {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="font-mono">{v}</span>
                  </li>
                ))}
              </ul>
              )}
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">{t("assignments.reports.blockers")}</h2>
              <ul className="space-y-1 text-sm">
                {Object.entries(data.blockers ?? {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k || t("assignments.reports.unspecified")}</span>
                    <span className="font-mono">{v}</span>
                  </li>
                ))}
                {Object.keys(data.blockers ?? {}).length === 0 && (
                  <li className="text-neutral-500">{t("assignments.reports.noBlockers")}</li>
                )}
              </ul>
            </div>
          </div>

          <Link href="/assignments/register" className="btn-secondary inline-flex">
            {t("assignments.reports.openRegister")}
          </Link>
        </>
      )}
    </div>
  );
}
