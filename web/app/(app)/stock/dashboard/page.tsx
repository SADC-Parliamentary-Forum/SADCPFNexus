"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { stockDashboardApi, type StockDashboard } from "@/lib/api";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { STOCK_HUB_CARDS } from "@/lib/hubs/stock";

function fmtMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StockDashboardPage() {
  const [data, setData] = useState<StockDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stockDashboardApi
      .get()
      .then((res) => setData(res.data.data))
      .catch(() => setError("Failed to load stock dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Loading dashboard…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const cards = [
    { label: "Active items", value: data.active_items, href: "/stock" },
    { label: "Low stock", value: data.low_stock_count, href: "/stock/low-stock" },
    { label: "Stock value", value: fmtMoney(data.total_stock_value), href: "/stock/reports" },
    { label: "Issues (30d)", value: data.issues_last_30_days, href: "/stock/movements" },
    { label: "Loss / damage (90d)", value: data.loss_movements_90d, href: "/stock/movements" },
    { label: "Open stocktakes", value: data.open_stocktakes, href: "/stock/stocktakes" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <ModulePageHeader
        title="Consumables dashboard"
        subtitle="Stores KPIs for paper, toner, stationery and other consumables — separate from fixed assets."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Consumables dashboard" }]} />}
      />

      <ModuleHubCards cards={STOCK_HUB_CARDS} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-primary/40 transition">
            <p className="text-xs text-neutral-500 uppercase tracking-wide">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Low-stock queue</h2>
          <Link href="/stock/low-stock" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {data.low_stock_items.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No items below reorder level.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Balance</th>
                <th className="px-4 py-2">Reorder</th>
                <th className="px-4 py-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {data.low_stock_items.map((i) => (
                <tr key={i.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/stock/${i.id}`} className="text-primary hover:underline">{i.item_code}</Link>
                  </td>
                  <td className="px-4 py-2">{i.name}</td>
                  <td className="px-4 py-2 text-red-600 font-medium">{i.current_balance}</td>
                  <td className="px-4 py-2">{i.reorder_level}</td>
                  <td className="px-4 py-2 text-neutral-500">{i.location?.name ?? i.storage_location ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
