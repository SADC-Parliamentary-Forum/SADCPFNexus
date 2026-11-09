"use client";

import { useState, useEffect, useCallback } from "react";
import { stockItemsApi, type StockItem } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { StockMovementModal } from "@/components/stock/StockMovementModal";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LowStockPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canIssue, setCanIssue] = useState(false);
  const [movementItem, setMovementItem] = useState<StockItem | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    stockItemsApi
      .list({ low_stock: 1, per_page: 100 })
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => setError(t("stock.lowStock.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
  }, [load]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.lowStock.title")}
        subtitle={t("stock.lowStock.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.common.stock"), href: "/stock" }, { label: t("stock.lowStock.title") }]} />}
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>{error}
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[18px]">production_quantity_limits</span>
              <h3 className="text-sm font-semibold text-neutral-900">{t("stock.lowStock.needingReorder")}</h3>
            </div>
            <span className="badge badge-warning">{t("stock.categories.itemCount", { count: items.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-semibold text-neutral-500">
                  <th className="px-4 py-3">{t("stock.common.item")}</th>
                  <th className="px-4 py-3">{t("stock.common.category")}</th>
                  <th className="px-4 py-3 text-right">{t("stock.common.balance")}</th>
                  <th className="px-4 py-3 text-right">{t("stock.common.reorderLevel")}</th>
                  <th className="px-4 py-3">{t("stock.common.location")}</th>
                  {canIssue && <th className="px-4 py-3 text-right">{t("stock.common.actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{i.name}</p>
                      <p className="text-xs font-mono text-neutral-400">{i.item_code}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{i.category?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">{i.current_balance}</td>
                    <td className="px-4 py-3 text-right text-neutral-500">{i.reorder_level}</td>
                    <td className="px-4 py-3 text-neutral-500">{i.storage_location ?? "—"}</td>
                    {canIssue && (
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setMovementItem(i)} className="btn-secondary px-3 py-1.5 text-xs inline-flex">
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          {t("stock.lowStock.replenish")}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon="check_circle"
            title={t("stock.lowStock.healthyTitle")}
            description={t("stock.lowStock.healthyHint")}
          />
        </div>
      )}

      {movementItem && (
        <StockMovementModal items={[movementItem]} presetItem={movementItem} onClose={() => setMovementItem(null)} onSaved={() => { setMovementItem(null); load(); }} />
      )}
    </div>
  );
}
