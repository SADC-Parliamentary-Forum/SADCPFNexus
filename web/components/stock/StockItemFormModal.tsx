"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  stockCategoriesApi,
  stockItemsApi,
  stockLocationsApi,
  stockUnitsApi,
  type StockCategory,
  type StockItem,
  type StockItemInput,
} from "@/lib/api";
import { canConfigureStockCatalogue, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import Link from "next/link";

interface ApiError {
  response?: { data?: { message?: string; errors?: Record<string, string[]> } };
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiError;
  const errors = e?.response?.data?.errors;
  if (errors) {
    const first = Object.values(errors)[0];
    if (first?.[0]) return first[0];
  }
  return e?.response?.data?.message || fallback;
}

function slugCode(name: string, max = 32): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (slug || "item").slice(0, max);
}

export function StockItemFormModal({
  categories: initialCategories = [],
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const editing = !!item;
  const canConfigure = useMemo(() => canConfigureStockCatalogue(getStoredUser()), []);

  const categoriesQuery = useQuery({
    queryKey: ["stock-categories"],
    queryFn: () => stockCategoriesApi.list().then((r) => r.data.data ?? []),
    initialData: initialCategories.length > 0 ? initialCategories : undefined,
  });
  const unitsQuery = useQuery({
    queryKey: ["stock-units"],
    queryFn: () => stockUnitsApi.list().then((r) => r.data.data ?? []),
  });
  const locationsQuery = useQuery({
    queryKey: ["stock-locations"],
    queryFn: () => stockLocationsApi.list().then((r) => r.data.data ?? []),
  });

  const categories = categoriesQuery.data ?? [];
  const units = (unitsQuery.data ?? []).filter((u) => u.is_active !== false);

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
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [savingCatalogue, setSavingCatalogue] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCatalogue(true);
    try {
      const res = await stockCategoriesApi.create({ name, code: slugCode(name) });
      await queryClient.invalidateQueries({ queryKey: ["stock-categories"] });
      set("stock_category_id", String(res.data.data.id));
      setNewCategoryName("");
      setAddingCategory(false);
      toast("success", t("stock.categoryCreated"));
    } catch (err: unknown) {
      const msg = errorMessage(err, t("stock.categoryCreateFailed"));
      setError(msg);
      toast("error", msg);
    } finally {
      setSavingCatalogue(false);
    }
  };

  const handleCreateUnit = async () => {
    const code = slugCode(newUnitCode || newUnitName);
    const name = newUnitName.trim() || newUnitCode.trim();
    if (!code || !name) return;
    setSavingCatalogue(true);
    try {
      const res = await stockUnitsApi.create({ code, name });
      await queryClient.invalidateQueries({ queryKey: ["stock-units"] });
      set("stock_unit_id", String(res.data.data.id));
      set("unit", res.data.data.code);
      setNewUnitCode("");
      setNewUnitName("");
      setAddingUnit(false);
      toast("success", t("stock.unitCreated"));
    } catch (err: unknown) {
      const msg = errorMessage(err, t("stock.unitCreateFailed"));
      setError(msg);
      toast("error", msg);
    } finally {
      setSavingCatalogue(false);
    }
  };

  const handleSave = async () => {
    if (!form.item_code.trim() || !form.name.trim()) {
      setError("Item code and name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const selectedUnit = units.find((u) => String(u.id) === form.stock_unit_id);
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
      const msg = errorMessage(err, "Failed to save stock item.");
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
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600" aria-label={t("common.close")}>
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor="stock-item-category" className="block text-xs font-semibold text-neutral-700">{t("stock.category")}</label>
                {canConfigure && (
                  <button
                    type="button"
                    data-testid="stock-add-category"
                    className="btn-secondary text-xs"
                    onClick={() => setAddingCategory((v) => !v)}
                  >
                    {t("stock.addCategory")}
                  </button>
                )}
              </div>
              <select
                id="stock-item-category"
                data-testid="stock-item-category-select"
                className="form-input"
                value={form.stock_category_id}
                onChange={(e) => set("stock_category_id", e.target.value)}
              >
                <option value="">{t("stock.uncategorised")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {canConfigure && addingCategory && (
                <div className="mt-2 flex gap-2">
                  <input
                    data-testid="stock-new-category-name"
                    className="form-input text-sm"
                    placeholder={t("stock.categoryName")}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    aria-label={t("stock.categoryName")}
                  />
                  <button
                    type="button"
                    className="btn-primary text-xs px-3"
                    disabled={savingCatalogue || !newCategoryName.trim()}
                    onClick={() => void handleCreateCategory()}
                  >
                    {t("stock.saveCategory")}
                  </button>
                </div>
              )}
              {categories.length === 0 && (
                <p className="text-xs text-neutral-400 mt-1">
                  {t("stock.noCategoriesHint")}{" "}
                  {canConfigure && (
                    <Link href="/stock/categories" className="btn-secondary text-xs">{t("stock.manageCategories")}</Link>
                  )}
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor="stock-item-unit" className="block text-xs font-semibold text-neutral-700">{t("stock.unitOfMeasure")}</label>
                {canConfigure && (
                  <button
                    type="button"
                    data-testid="stock-add-unit"
                    className="btn-secondary text-xs"
                    onClick={() => setAddingUnit((v) => !v)}
                  >
                    {t("stock.addUnit")}
                  </button>
                )}
              </div>
              <select
                id="stock-item-unit"
                data-testid="stock-item-unit-select"
                className="form-input"
                value={form.stock_unit_id}
                onChange={(e) => set("stock_unit_id", e.target.value)}
              >
                <option value="">{t("stock.selectUnit")}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                ))}
              </select>
              {canConfigure && addingUnit && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    data-testid="stock-new-unit-code"
                    className="form-input text-sm font-mono"
                    placeholder={t("stock.unitCode")}
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    aria-label={t("stock.unitCode")}
                  />
                  <input
                    data-testid="stock-new-unit-name"
                    className="form-input text-sm"
                    placeholder={t("stock.unitName")}
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    aria-label={t("stock.unitName")}
                  />
                  <button
                    type="button"
                    className="btn-primary text-xs px-3 col-span-2"
                    disabled={savingCatalogue || !(newUnitCode.trim() || newUnitName.trim())}
                    onClick={() => void handleCreateUnit()}
                  >
                    {t("stock.saveUnit")}
                  </button>
                </div>
              )}
              {units.length === 0 && (
                <p className="text-xs text-neutral-400 mt-1">
                  {t("stock.noUnitsHint")}{" "}
                  {canConfigure && (
                    <Link href="/stock/units" className="btn-secondary text-xs">{t("stock.manageUnits")}</Link>
                  )}
                </p>
              )}
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
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? "Saving…" : editing ? "Update Item" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
