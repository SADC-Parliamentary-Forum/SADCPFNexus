"use client";

import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { contractsApi, type ContractAnalytics } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function Bars({ rows, currency = false }: { rows: { label: string; value: number; count: number }[]; currency?: boolean }) {
  const { t } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-neutral-400 p-4">{t("contracts.analytics.noData")}</p>;
  return (
    <div className="space-y-2 p-4">
      {rows.slice(0, 8).map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-neutral-700 truncate max-w-[60%]">{r.label}</span>
            <span className="text-neutral-500">{currency ? r.value.toLocaleString() : r.count} {currency ? "" : ""}</span>
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
    <div className="space-y-6">
      <ModulePageHeader
        title="contracts.analytics.title"
        subtitle="contracts.analytics.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.contracts", href: "/contracts" }, { label: "contracts.analytics.crumb" }]} />}
      />

      {isLoading || !a ? (
        <div className="card p-6 text-sm text-neutral-500">{t("contracts.analytics.loading")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ["contracts.analytics.totalContracts", a.totals.contracts],
              ["contracts.status.active", a.totals.active],
              ["contracts.analytics.currentValue", a.totals.current_value.toLocaleString()],
              ["contracts.analytics.avgExecution", a.avg_execution_turnaround_days ?? "—"],
              ["contracts.analytics.amendmentsPer", a.amendment_frequency.avg_per_contract],
              ["contracts.analytics.onTime", `${a.on_time_deliverable_rate.rate}%`],
              ["contracts.analytics.supplierScore", a.supplier_performance.average_overall ?? "—"],
              ["contracts.analytics.supplierEvaluations", a.supplier_performance.evaluations],
            ] as [string, string | number][]).map(([label, val]) => (
              <div key={label} className="card p-4">
                <p className="text-2xl font-bold text-neutral-900">{val}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{t(label)}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.byDepartment")}</div>
              <Bars rows={a.value_by_department} currency />
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.byType")}</div>
              <Bars rows={a.value_by_type} currency />
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.byDonor")}</div>
              <Bars rows={a.value_by_donor} currency />
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.expiryForecast")}</div>
              <table className="data-table">
                <thead><tr><th>{t("contracts.analytics.window")}</th><th className="text-right">{t("nav.contracts")}</th><th className="text-right">{t("contracts.field.value")}</th></tr></thead>
                <tbody>
                  {a.expiry_forecast.map((b) => (
                    <tr key={b.bucket}><td className="text-sm">{b.bucket}</td><td className="text-right text-sm">{b.count}</td><td className="text-right text-sm">{b.value.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.analytics.monthly")}</div>
            <div className="flex items-end gap-1 p-4 h-40">
              {a.monthly_creation.map((m) => {
                const max = Math.max(1, ...a.monthly_creation.map((x) => x.count));
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div className="w-full bg-primary/70 rounded-t" style={{ height: `${Math.round((m.count / max) * 100)}%`, minHeight: m.count > 0 ? 4 : 0 }} title={`${m.month}: ${m.count}`} />
                    <span className="text-[9px] text-neutral-400 rotate-45 origin-left whitespace-nowrap">{m.month.slice(2)}</span>
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
