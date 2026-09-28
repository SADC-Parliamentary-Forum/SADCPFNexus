"use client";

import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { contractsApi, type ContractAnalytics } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ContractSubNav, ContractTableWrap } from "@/components/contracts/ContractChrome";

function Bars({ rows, currency = false, empty }: { rows: { label: string; value: number; count: number }[]; currency?: boolean; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-neutral-400 p-4">{empty}</p>;
  return (
    <div className="space-y-2 p-4">
      {rows.slice(0, 8).map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-xs mb-0.5 gap-2">
            <span className="text-neutral-700 truncate min-w-0">{r.label}</span>
            <span className="text-neutral-500 whitespace-nowrap">{currency ? r.value.toLocaleString() : r.count}</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContractAnalyticsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["contract-analytics"],
    queryFn: () => contractsApi.analytics().then((r) => r.data.data),
  });
  const a: ContractAnalytics | undefined = data;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="contracts.analyticsTitle"
        subtitle="contracts.analyticsSubtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "contracts.title", href: "/contracts" }, { label: "contracts.analytics" }]} />}
      />
      <ContractSubNav />

      {isLoading || !a ? (
        <div className="card p-6 text-sm text-neutral-500">{t("contracts.analytics.loading")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              [t("contracts.analytics.total"), a.totals.contracts],
              [t("contracts.analytics.active"), a.totals.active],
              [t("contracts.analytics.currentValue"), a.totals.current_value.toLocaleString()],
              [t("contracts.analytics.avgExecution"), a.avg_execution_turnaround_days ?? "—"],
              [t("contracts.analytics.amendments"), a.amendment_frequency.avg_per_contract],
              [t("contracts.analytics.onTime"), `${a.on_time_deliverable_rate.rate}%`],
              [t("contracts.analytics.supplierScore"), a.supplier_performance.average_overall ?? "—"],
              [t("contracts.analytics.evaluations"), a.supplier_performance.evaluations],
            ] as [string, string | number][]).map(([label, val]) => (
              <div key={label} className="card p-4 min-w-0">
                <p className="text-2xl font-bold text-neutral-900 truncate">{val}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card overflow-hidden min-w-0">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.byDepartment")}</div>
              <Bars rows={a.value_by_department} currency empty={t("contracts.analytics.noData")} />
            </div>
            <div className="card overflow-hidden min-w-0">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.byType")}</div>
              <Bars rows={a.value_by_type} currency empty={t("contracts.analytics.noData")} />
            </div>
            <div className="card overflow-hidden min-w-0">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.byDonor")}</div>
              <Bars rows={a.value_by_donor} currency empty={t("contracts.analytics.noData")} />
            </div>
            <div className="card overflow-hidden min-w-0">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.expiryForecast")}</div>
              <ContractTableWrap>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("contracts.analytics.window")}</th>
                      <th className="text-right">{t("contracts.title")}</th>
                      <th className="text-right">{t("contracts.col.value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.expiry_forecast.map((b) => (
                      <tr key={b.bucket}>
                        <td className="text-sm">{b.bucket}</td>
                        <td className="text-right text-sm">{b.count}</td>
                        <td className="text-right text-sm whitespace-nowrap">{b.value.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ContractTableWrap>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.monthly")}</div>
            <div className="flex items-end gap-1 p-4 h-40 overflow-x-auto">
              {a.monthly_creation.map((m) => {
                const max = Math.max(1, ...a.monthly_creation.map((x) => x.count));
                return (
                  <div key={m.month} className="flex-1 min-w-[1.5rem] flex flex-col items-center justify-end gap-1">
                    <div className="w-full bg-primary/70 rounded-t" style={{ height: `${Math.round((m.count / max) * 100)}%`, minHeight: m.count > 0 ? 4 : 0 }} title={`${m.month}: ${m.count}`} />
                    <span className="text-[9px] text-neutral-400 whitespace-nowrap">{m.month.slice(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
