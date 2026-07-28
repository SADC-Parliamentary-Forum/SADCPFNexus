"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { stockItemsApi, stockCategoriesApi, type StockItem, type StockCategory } from "@/lib/api";
import { canManageStock, canIssueStock, getStoredUser } from "@/lib/auth";
import { StockItemFormModal } from "@/components/stock/StockItemFormModal";
import { StockMovementModal } from "@/components/stock/StockMovementModal";

function fmtMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StockItemsPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canIssue, setCanIssue] = useState(false);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");

  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [movementItem, setMovementItem] = useState<StockItem | null>(null);
  const [showMovement, setShowMovement] = useState(false);

  const loadItems = useCallback(() => {
    setLoading(true);
    setError(null);
    stockItemsApi
      .list({ per_page: 100 })
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => setError("Failed to load stock items."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    setCanManage(canManageStock(user));
    setCanIssue(canIssueStock(user));
    loadItems();
    stockCategoriesApi.list().then((res) => setCategories(res.data.data ?? [])).catch(() => {});
  }, [loadItems]);

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q);
    const matchCat = filterCategory === "all" || String(i.stock_category_id) === filterCategory;
    const matchStatus = filterStatus === "all" || i.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const lowStockCount = items.filter((i) => i.is_low_stock).length;
  const totalValue = items.reduce((sum, i) => sum + (Number(i.stock_value) || 0), 0);

  const openNew = () => { setEditItem(null); setShowItemForm(true); };
  const openEdit = (i: StockItem) => { setEditItem(i); setShowItemForm(true); };
  const openMovement = (i: StockItem | null) => { setMovementItem(i); setShowMovement(true); };

  const afterSave = () => { setShowItemForm(false); setEditItem(null); loadItems(); };
  const afterMovement = () => { setShowMovement(false); setMovementItem(null); loadItems(); };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Consumables / Stock</h1>
          <p className="page-subtitle">Track consumable stock items, balances and reorder levels — separate from fixed assets.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/stock/dashboard" className="btn-secondary">
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Dashboard
          </Link>
          <Link href="/stock/stocktakes" className="btn-secondary">
            <span className="material-symbols-outlined text-[18px]">fact_check</span>
            Stocktakes
          </Link>
          <Link href="/stock/reports" className="btn-secondary">
            <span className="material-symbols-outlined text-[18px]">summarize</span>
            Reports
          </Link>
          <Link href="/stock/movements" className="btn-secondary">
            <span className="material-symbols-outlined text-[18px]">swap_vert</span>
            Movements
          </Link>
          {canManage && (
            <Link href="/stock/categories" className="btn-secondary">
              <span className="material-symbols-outlined text-[18px]">category</span>
              Categories
            </Link>
          )}
          {canIssue && (
            <button type="button" onClick={() => openMovement(null)} className="btn-secondary">
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              Record Movement
            </button>
          )}
          {canManage && (
            <button type="button" onClick={openNew} className="btn-primary">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Item
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>{error}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Stock Items", count: items.length, icon: "inventory", color: "text-primary", bg: "bg-primary/10" },
            { label: "Low Stock", count: lowStockCount, icon: "production_quantity_limits", color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Stock Value", count: fmtMoney(totalValue), icon: "savings", color: "text-green-600", bg: "bg-green-50" },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="text-lg font-bold text-neutral-900 mt-0.5">{s.count}</p>
                </div>
                <div className={`h-9 w-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${s.color} text-[18px]`}>{s.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="card p-3 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Search</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-neutral-400 text-[18px]">search</span>
              <input className="form-input pl-8 text-sm" placeholder="Name or item code…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {categories.length > 0 && (
            <div className="min-w-[150px]">
              <label className="block text-xs font-semibold text-neutral-600 mb-1">Category</label>
              <select className="form-input text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="min-w-[130px]">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Status</label>
            <select className="form-input text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : filtered.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-semibold text-neutral-500">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Reorder</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtered.map((i) => (
                  <tr key={i.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-neutral-900">
                            <Link href={`/stock/${i.id}`} className="hover:text-primary hover:underline">{i.name}</Link>
                          </p>
                          <p className="text-xs font-mono text-neutral-400">{i.item_code}{i.unit ? ` · ${i.unit}` : ""}</p>
                        </div>
                        {i.is_low_stock && <span className="badge badge-warning">Low</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{i.category?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900">{i.current_balance}</td>
                    <td className="px-4 py-3 text-right text-neutral-500">{i.reorder_level || "—"}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{fmtMoney(i.unit_cost)}</td>
                    <td className="px-4 py-3 text-neutral-500">{i.storage_location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canIssue && (
                          <button type="button" onClick={() => openMovement(i)} className="p-2 rounded-lg text-neutral-500 hover:bg-primary/10 hover:text-primary" aria-label="Record movement" title="Record movement">
                            <span className="material-symbols-outlined text-[18px]">swap_vert</span>
                          </button>
                        )}
                        {canManage && (
                          <button type="button" onClick={() => openEdit(i)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Edit" title="Edit">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="card p-10 text-center">
          <span className="material-symbols-outlined text-3xl text-neutral-300">search_off</span>
          <p className="mt-2 text-sm font-semibold text-neutral-600">No items match your filters</p>
          <button type="button" onClick={() => { setSearch(""); setFilterCategory("all"); setFilterStatus("active"); }} className="mt-3 text-xs text-primary hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="card p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
            <span className="material-symbols-outlined text-4xl text-neutral-300">inventory</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-neutral-600">No stock items yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add consumable items to start tracking balances and reorder levels.</p>
          {canManage && (
            <button type="button" onClick={openNew} className="btn-primary mt-5 inline-flex">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Item
            </button>
          )}
        </div>
      )}

      {showItemForm && (
        <StockItemFormModal categories={categories} item={editItem} onClose={() => { setShowItemForm(false); setEditItem(null); }} onSaved={afterSave} />
      )}
      {showMovement && (
        <StockMovementModal items={items} presetItem={movementItem} onClose={() => { setShowMovement(false); setMovementItem(null); }} onSaved={afterMovement} />
      )}
    </div>
  );
}
