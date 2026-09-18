"use client";

import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { contractsApi, type ContractAnalytics } from "@/lib/api";

function Bars({ rows, currency = false }: { rows: { label: string; value: number; count: number }[]; currency?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-neutral-400 p-4">No data.</p>;
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
  const { data, isLoading } = useQuery({
    queryKey: ["contract-analytics"],
    queryFn: () => contractsApi.analytics().then((r) => r.data.data),
  });
  const a: ContractAnalytics | undefined = data;

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Contract Analytics"
        subtitle="Portfolio value, creation trend, expiry forecast, amendments and performance"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Analytics" }]} />}
      />

      {isLoading || !a ? (
        <div className="card p-6 text-sm text-neutral-500">Loading analytics…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ["Total contracts", a.totals.contracts],
              ["Active", a.totals.active],
              ["Current value", a.totals.current_value.toLocaleString()],
              ["Avg execution (days)", a.avg_execution_turnaround_days ?? "—"],
              ["Amendments / contract", a.amendment_frequency.avg_per_contract],
              ["On-time deliverables", `${a.on_time_deliverable_rate.rate}%`],
              ["Supplier score (avg)", a.supplier_performance.average_overall ?? "—"],
              ["Supplier evaluations", a.supplier_performance.evaluations],
            ] as [string, string | number][]).map(([label, val]) => (
              <div key={label} className="card p-4">
                <p className="text-2xl font-bold text-neutral-900">{val}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Value by department</div>
              <Bars rows={a.value_by_department} currency />
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Value by type</div>
              <Bars rows={a.value_by_type} currency />
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Value by donor</div>
              <Bars rows={a.value_by_donor} currency />
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Expiry forecast</div>
              <table className="data-table">
                <thead><tr><th>Window</th><th className="text-right">Contracts</th><th className="text-right">Value</th></tr></thead>
                <tbody>
                  {a.expiry_forecast.map((b) => (
                    <tr key={b.bucket}><td className="text-sm">{b.bucket}</td><td className="text-right text-sm">{b.count}</td><td className="text-right text-sm">{b.value.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Monthly contract creation (last 12 months)</div>
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
