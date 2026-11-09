"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { travelApi } from "@/lib/api";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export default function TravelFinanceDashboardPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["travel", "dashboard", "finance"],
    queryFn: () => travelApi.dashboardFinance().then((r) => r.data.data as Record<string, any>),
  });

  return (
    <div className="p-6 w-full min-w-0 space-y-5">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title={t("travel.financeDash.title")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.travel"), href: "/travel" }, { label: t("travel.financeDash.crumb") }]} />}
      />
        <Link href="/travel/queues/finance" className="btn-primary">{t("travel.financeDash.queue")}</Link>
      </div>
      {isLoading && <p className="text-sm text-neutral-400">{t("common.loading")}</p>}
      {isError && <ErrorBanner message={t("travel.financeDash.loadFailed")} />}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="travel-finance-dashboard">
            <Stat label={t("travel.financeDash.dsaPending")} value={data.dsa_pending ?? 0} />
            <Stat label={t("travel.financeDash.funds")} value={data.funds_confirmation_pending ?? 0} />
            <Stat label={t("travel.financeDash.approvedPayments")} value={data.approved_payments ?? 0} />
            <Stat label={t("travel.financeDash.advances")} value={data.travel_advances ?? 0} />
            <Stat label={t("travel.financeDash.retirements")} value={data.travel_retirements ?? 0} />
            <Stat label={t("travel.financeDash.outstandingImprest")} value={data.outstanding_imprest ?? 0} />
            <Stat label={t("travel.financeDash.overdueRetirement")} value={data.overdue_retirement ?? 0} />
            <Stat label={t("travel.financeDash.commitments")} value={Number(data.commitments?.finance_dsa_total ?? 0).toLocaleString()} />
          </div>
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-2">{t("travel.financeDash.costByProgramme")}</h2>
            {(data.cost_by_programme ?? []).length === 0 ? (
              <EmptyState icon="account_tree" title={t("travel.financeDash.noCosts")} className="py-6 min-h-0" />
            ) : (
              <ul className="text-sm space-y-1">
                {(data.cost_by_programme as any[]).slice(0, 8).map((row) => (
                  <li key={row.programme_id} className="flex justify-between gap-3">
                    <span>{row.programme_title || row.programme_reference || row.programme_id}</span>
                    <span>{Number(row.dsa_total).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
