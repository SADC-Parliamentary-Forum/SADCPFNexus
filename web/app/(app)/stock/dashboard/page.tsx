"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { stockDashboardApi, type StockDashboard } from "@/lib/api";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { STOCK_HUB_CARDS } from "@/lib/hubs/stock";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function fmtMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StockDashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<StockDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stockDashboardApi
      .get()
      .then((res) => setData(res.data.data))
      .catch(() => setError(t("stock.dashboard.loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">{t("stock.dashboard.loading")}</p>;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const cards = [
    { label: t("stock.dashboard.activeItems"), value: data.active_items, href: "/stock" },
    { label: t("stock.dashboard.lowStock"), value: data.low_stock_count, href: "/stock/low-stock" },
    { label: t("stock.dashboard.stockValue"), value: fmtMoney(data.total_stock_value), href: "/stock/reports" },
    { label: t("stock.dashboard.issues30d"), value: data.issues_last_30_days, href: "/stock/movements" },
    { label: t("stock.dashboard.loss90d"), value: data.loss_movements_90d, href: "/stock/movements" },
    { label: t("stock.dashboard.openStocktakes"), value: data.open_stocktakes, href: "/stock/stocktakes" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.dashboard.title")}
        subtitle={t("stock.dashboard.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.dashboard.title") }]} />}
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
          <h2 className="font-semibold text-sm">{t("stock.dashboard.lowStockQueue")}</h2>
          <Link href="/stock/low-stock" className="btn-secondary text-xs py-1 px-2">{t("common.viewAll")}</Link>
        </div>
        {data.low_stock_items.length === 0 ? (
          <EmptyState icon="inventory_2" title={t("stock.dashboard.noLowStock")} className="py-8 min-h-0" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2">{t("stock.common.code")}</th>
                <th className="px-4 py-2">{t("stock.common.item")}</th>
                <th className="px-4 py-2">{t("stock.common.balance")}</th>
                <th className="px-4 py-2">{t("stock.common.reorder")}</th>
                <th className="px-4 py-2">{t("stock.common.location")}</th>
              </tr>
            </thead>
            <tbody>
              {data.low_stock_items.map((i) => (
                <tr key={i.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/stock/${i.id}`} className="font-medium text-primary">{i.item_code}</Link>
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
