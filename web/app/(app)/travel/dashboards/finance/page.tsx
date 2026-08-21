"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { travelApi } from "@/lib/api";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export default function TravelFinanceDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["travel", "dashboard", "finance"],
    queryFn: () => travelApi.dashboardFinance().then((r) => r.data.data as Record<string, any>),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title="Finance Travel Dashboard"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Travel", href: "/travel" }, { label: "Finance dashboard" }]} />}
      />
        <Link href="/travel/queues/finance" className="btn-primary">Finance queue</Link>
      </div>
      {isLoading && <p className="text-sm text-neutral-400">Loading…</p>}
      {isError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">Unable to load finance dashboard.</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="travel-finance-dashboard">
            <Stat label="DSA pending" value={data.dsa_pending ?? 0} />
            <Stat label="Funds confirmation" value={data.funds_confirmation_pending ?? 0} />
            <Stat label="Approved payments" value={data.approved_payments ?? 0} />
            <Stat label="Travel advances" value={data.travel_advances ?? 0} />
            <Stat label="Retirements" value={data.travel_retirements ?? 0} />
            <Stat label="Outstanding imprest" value={data.outstanding_imprest ?? 0} />
            <Stat label="Overdue retirement" value={data.overdue_retirement ?? 0} />
            <Stat label="DSA commitments" value={Number(data.commitments?.finance_dsa_total ?? 0).toLocaleString()} />
          </div>
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-2">Cost by programme</h2>
            {(data.cost_by_programme ?? []).length === 0 ? (
              <p className="text-sm text-neutral-400">No programme costs yet.</p>
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
