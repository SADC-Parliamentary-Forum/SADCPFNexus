"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { stockItemsApi, type StockItem } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { StockMovementModal } from "@/components/stock/StockMovementModal";

export default function LowStockPage() {
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
      .catch(() => setError("Failed to load low-stock items."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
  }, [load]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <Link href="/stock" className="hover:text-primary transition-colors">Consumables / Stock</Link>
          <span>/</span>
          <span className="text-neutral-700 font-medium">Low Stock / Reorder</span>
        </div>
        <h1 className="page-title">Low Stock / Reorder</h1>
        <p className="page-subtitle">Items at or below their reorder level — replenish to avoid stock-outs.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>{error}
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[18px]">production_quantity_limits</span>
              <h3 className="text-sm font-semibold text-neutral-900">Items needing reorder</h3>
            </div>
            <span className="badge badge-warning">{items.length} item(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-semibold text-neutral-500">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Reorder Level</th>
                  <th className="px-4 py-3">Location</th>
                  {canIssue && <th className="px-4 py-3 text-right">Actions</th>}
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
                          Replenish
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
        <div className="card p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 mx-auto">
            <span className="material-symbols-outlined text-4xl text-green-400">check_circle</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-neutral-600">All stock levels are healthy</p>
          <p className="text-xs text-neutral-400 mt-1">No items are at or below their reorder level.</p>
        </div>
      )}

      {movementItem && (
        <StockMovementModal items={[movementItem]} presetItem={movementItem} onClose={() => setMovementItem(null)} onSaved={() => { setMovementItem(null); load(); }} />
      )}
    </div>
  );
}
