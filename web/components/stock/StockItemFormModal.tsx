"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { stockItemsApi, stockLocationsApi, stockUnitsApi, type StockCategory, type StockItem, type StockItemInput } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface ApiError {
  response?: { data?: { message?: string; errors?: Record<string, string[]> } };
}

function errorMessage(err: unknown): string {
  const e = err as ApiError;
  const errors = e?.response?.data?.errors;
  if (errors) {
    const first = Object.values(errors)[0];
    if (first?.[0]) return first[0];
  }
  return e?.response?.data?.message || "Failed to save stock item.";
}

export function StockItemFormModal({
  categories,
  item,
  onClose,
  onSaved,
}: {
  categories: StockCategory[];
  item?: StockItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const editing = !!item;
  const unitsQuery = useQuery({
    queryKey: ["stock-units"],
    queryFn: () => stockUnitsApi.list().then((r) => r.data.data ?? []),
  });
  const locationsQuery = useQuery({
    queryKey: ["stock-locations"],
    queryFn: () => stockLocationsApi.list().then((r) => r.data.data ?? []),
  });

  const [form, setForm] = useState({
    item_code: item?.item_code ?? "",
    name: item?.name ?? "",
    stock_category_id: item?.stock_category_id != null ? String(item.stock_category_id) : "",
    unit: item?.unit ?? "",
    stock_unit_id: item?.stock_unit_id != null ? String(item.stock_unit_id) : "",
    unit_cost: item?.unit_cost != null ? String(item.unit_cost) : "",
    opening_balance: "",
    reorder_level: item?.reorder_level != null ? String(item.reorder_level) : "0",
    storage_location: item?.storage_location ?? "",
    stock_location_id: item?.stock_location_id != null ? String(item.stock_location_id) : "",
    description: item?.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.item_code.trim() || !form.name.trim()) {
      setError("Item code and name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const selectedUnit = (unitsQuery.data ?? []).find((u) => String(u.id) === form.stock_unit_id);
    const selectedLoc = (locationsQuery.data ?? []).find((l) => String(l.id) === form.stock_location_id);
    const payload: StockItemInput = {
      item_code: form.item_code.trim(),
      name: form.name.trim(),
      stock_category_id: form.stock_category_id ? Number(form.stock_category_id) : null,
      unit: selectedUnit?.code || form.unit.trim() || null,
      stock_unit_id: form.stock_unit_id ? Number(form.stock_unit_id) : null,
      unit_cost: form.unit_cost !== "" ? Number(form.unit_cost) : null,
      reorder_level: form.reorder_level !== "" ? Number(form.reorder_level) : 0,
      storage_location: selectedLoc?.name || form.storage_location.trim() || null,
      stock_location_id: form.stock_location_id ? Number(form.stock_location_id) : null,
      description: form.description.trim() || null,
    };
    if (!editing && form.opening_balance !== "") {
      payload.opening_balance = Number(form.opening_balance);
    }
    try {
      if (editing) {
        await stockItemsApi.update(item!.id, payload);
        toast("success", "Stock item updated");
      } else {
        await stockItemsApi.create(payload);
        toast("success", "Stock item created");
      }
      onSaved();
    } catch (err: unknown) {
      const msg = errorMessage(err);
      setError(msg);
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">{editing ? "edit" : "add_box"}</span>
            </div>
            <h3 className="font-semibold text-neutral-900 text-sm">{editing ? "Edit Stock Item" : "New Stock Item"}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">error_outline</span>{error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Item Code *</label>
              <input className="form-input font-mono" placeholder="e.g. STK-A4-001" value={form.item_code} onChange={(e) => set("item_code", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Name *</label>
              <input className="form-input" placeholder="e.g. A4 Paper Ream" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Category</label>
              <select className="form-input" value={form.stock_category_id} onChange={(e) => set("stock_category_id", e.target.value)}>
                <option value="">Uncategorised</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Unit of Measure</label>
              <select className="form-input" value={form.stock_unit_id} onChange={(e) => set("stock_unit_id", e.target.value)}>
                <option value="">Select unit…</option>
                {(unitsQuery.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Unit Cost</label>
              <input type="number" min={0} step="0.01" className="form-input" placeholder="0.00" value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Reorder Level</label>
              <input type="number" min={0} className="form-input" placeholder="0" value={form.reorder_level} onChange={(e) => set("reorder_level", e.target.value)} />
            </div>
            {!editing && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Opening Balance</label>
                <input type="number" min={0} className="form-input" placeholder="0" value={form.opening_balance} onChange={(e) => set("opening_balance", e.target.value)} />
                <p className="text-xs text-neutral-400 mt-1">Recorded as an initial stock-in.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Storage Location</label>
              <select className="form-input" value={form.stock_location_id} onChange={(e) => set("stock_location_id", e.target.value)}>
                <option value="">Select location…</option>
                {(locationsQuery.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
              <textarea className="form-input" rows={2} placeholder="Optional notes" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? "Saving…" : editing ? "Update Item" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
