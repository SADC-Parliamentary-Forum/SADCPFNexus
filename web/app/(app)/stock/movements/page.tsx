"use client";

import { useState, useEffect, useCallback } from "react";
import { stockTransactionsApi, stockItemsApi, type StockTransaction, type StockItem } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { StockMovementModal } from "@/components/stock/StockMovementModal";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

const typeConfig: Record<string, { label: string; cls: string; icon: string }> = {
  in: { label: "Stock In", cls: "badge-success", icon: "south_west" },
  out: { label: "Stock Out", cls: "badge-danger", icon: "north_east" },
  adjustment: { label: "Adjustment", cls: "badge-info", icon: "tune" },
};

export default function StockMovementsPage() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [canIssue, setCanIssue] = useState(false);
  const [showMovement, setShowMovement] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = filterType === "all" ? { per_page: 100 } : { per_page: 100, type: filterType };
    stockTransactionsApi
      .list(params)
      .then((res) => setTransactions(res.data.data ?? []))
      .catch(() => setError("Failed to load stock movements."))
      .finally(() => setLoading(false));
  }, [filterType]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    stockItemsApi.list({ per_page: 100 }).then((res) => setItems(res.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const recipient = (t: StockTransaction): string =>
    t.issued_to_user?.name || t.issued_to_department?.name || t.issued_to_other || "—";

  return (
    <div className="space-y-6 max-w-6xl">
      <ModulePageHeader
        title="Stock Movements"
        subtitle="Stock-in receipts, stock-out issues and adjustments."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Stock", href: "/stock" }, { label: "Movements" }]} />}
        actions={
          canIssue ? (
            <button type="button" onClick={() => setShowMovement(true)} className="btn-primary">
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              Record Movement
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>{error}
        </div>
      )}

      <div className="card p-3 flex gap-2">
        {["all", "in", "out", "adjustment"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filterType === t ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            {t === "all" ? "All" : typeConfig[t]?.label ?? t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : transactions.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-semibold text-neutral-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Issued To</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {transactions.map((t) => {
                  const cfg = typeConfig[t.type] ?? { label: t.type, cls: "badge-muted", icon: "swap_vert" };
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{t.transaction_date}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">{t.item?.name ?? `#${t.stock_item_id}`}</p>
                        <p className="text-xs font-mono text-neutral-400">{t.item?.item_code}</p>
                      </td>
                      <td className="px-4 py-3"><span className={`badge ${cfg.cls}`}>{cfg.label}</span></td>
                      <td className={`px-4 py-3 text-right font-semibold ${t.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                        {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-700">{t.balance_after}</td>
                      <td className="px-4 py-3 text-neutral-600">{recipient(t)}</td>
                      <td className="px-4 py-3 text-neutral-500">{t.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-neutral-500">{t.recorder?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
            <span className="material-symbols-outlined text-4xl text-neutral-300">swap_vert</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-neutral-600">No movements recorded</p>
          <p className="text-xs text-neutral-400 mt-1">Stock-in and stock-out movements will appear here.</p>
        </div>
      )}

      {showMovement && (
        <StockMovementModal items={items} onClose={() => setShowMovement(false)} onSaved={() => { setShowMovement(false); load(); }} />
      )}
    </div>
  );
}
