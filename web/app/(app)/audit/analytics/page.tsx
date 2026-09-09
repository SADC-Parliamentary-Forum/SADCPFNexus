"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditTable } from "@/components/audit/AuditChrome";

export default function AuditAnalyticsPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "analytics"],
    queryFn: async () => (await auditApi.analytics()).data.data,
  });

  const rating = (data?.rating_distribution ?? {}) as Record<string, number>;

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ModulePageHeader
          title="audit.analytics.title"
          subtitle="audit.analytics.subtitle"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "audit.hub", href: "/audit" }, { label: "audit.analytics.title" }]} />}
        />
        <Link href="/audit" className="btn-secondary text-sm">{t("audit.hub")}</Link>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">{t("audit.loading")}</p>}
      {isError && <p className="text-sm text-red-600">{t("audit.loadError")}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["cycle_time_days_avg", "audit.analytics.cycle"],
              ["overdue_corrective_rate", "audit.analytics.overdue"],
              ["plan_completion_pct", "audit.analytics.planPct"],
              ["open_findings", "audit.analytics.openFindings"],
            ].map(([key, label]) => (
              <div key={key} className="card p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500">{t(label)}</div>
                <div className="mt-2 text-2xl font-semibold">{String(data[key] ?? 0)}</div>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("audit.analytics.ratingDist")}</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.keys(rating).length === 0 && <span className="text-neutral-500">{t("audit.analytics.noFindings")}</span>}
              {Object.entries(rating).map(([k, v]) => (
                <span key={k} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1">
                  {k || "unset"}: <strong>{v}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t("audit.analytics.planCompletion")}</h2>
            <AuditTable columns={["audit.col.plan", "audit.col.year", "audit.col.complete", "audit.col.engagements"]}>
              {((data.plans as Array<Record<string, unknown>>) ?? []).map((p) => (
                <tr key={String(p.plan_id)} className="border-b border-neutral-100">
                  <td className="px-3 py-2.5">{String(p.title)}</td>
                  <td className="px-3 py-2.5">{String(p.fiscal_year)}</td>
                  <td className="px-3 py-2.5">{String(p.completion_pct)}%</td>
                  <td className="px-3 py-2.5">{String(p.completed_engagements)}/{String(p.total_engagements)}</td>
                </tr>
              ))}
            </AuditTable>
          </div>
        </>
      )}
    </div>
  );
}
