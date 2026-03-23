"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { assetCategoriesApi, type AssetCategory } from "@/lib/api";
import { canManageAssets, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export default function AssetCategoriesPage() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; code: string; sort_order: number }>({
    name: "",
    code: "",
    sort_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    setAllowed(canManageAssets(getStoredUser()));
  }, []);

  useEffect(() => {
    if (allowed === false) {
      window.location.href = "/assets";
      return;
    }
    if (!allowed) return;
    assetCategoriesApi
      .list()
      .then((res) => setCategories(res.data.data ?? []))
      .catch(() => setError("Failed to load categories."))
      .finally(() => setLoading(false));
  }, [allowed]);

  const handleSave = async () => {
    const name = form.name.trim();
    const code = form.code.trim().toLowerCase().replace(/\s+/g, "_");
    if (!name || !code) return;
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await assetCategoriesApi.update(editId, {
          name,
          code,
          sort_order: form.sort_order,
        });
        toast("success", "Category updated");
      } else {
        await assetCategoriesApi.create({
          name,
          code,
          sort_order: form.sort_order,
        });
        toast("success", "Category created");
      }
      const res = await assetCategoriesApi.list();
      setCategories(res.data.data ?? []);
      setEditId(null);
      setForm({ name: "", code: "", sort_order: 0 });
      setShowForm(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "Failed to save category.");
      toast("error", msg || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat: AssetCategory) => {
    setEditId(cat.id);
    setForm({
      name: cat.name,
      code: cat.code,
      sort_order: cat.sort_order ?? 0,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", code: "", sort_order: 0 });
  };

  const handleDelete = async (id: number, name: string) => {
    if (
      !(await confirm({
        title: "Delete Category",
        message: `Are you sure you want to delete "${name}"? This is only allowed if no assets use this category.`,
        variant: "danger",
      }))
    )
      return;
    try {
      await assetCategoriesApi.delete(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast("success", "Category deleted");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast("error", msg || "Cannot delete category (may be in use).");
    }
  };

  if (allowed === null || allowed === false) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <Link href="/assets" className="hover:text-primary transition-colors">
              Assets
            </Link>
            <span>/</span>
            <span className="text-neutral-700 font-medium">Categories</span>
          </div>
          <h1 className="page-title">Asset Categories</h1>
          <p className="page-subtitle">Manage asset categories used when adding assets.</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditId(null);
            setForm({ name: "", code: "", sort_order: 0 });
          }}
          className="btn-primary"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showForm && !editId ? "close" : "add"}
          </span>
          {showForm && !editId ? "Cancel" : "New Category"}
        </button>
      </div>

      {showForm && (
        <div className="card border-primary/20 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">
                {editId ? "edit" : "category"}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {editId ? "Edit Category" : "New Category"}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                className="form-input"
                placeholder="e.g. IT Equipment"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                className="form-input font-mono"
                placeholder="e.g. it"
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }))
                }
                disabled={!!editId}
              />
              {editId && (
                <p className="text-xs text-neutral-400">Code cannot be changed when editing.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">Sort order</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={form.sort_order}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancelForm} className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">close</span>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.code.trim() || saving}
              className="btn-primary"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">
                  {editId ? "save" : "add"}
                </span>
              )}
              {saving ? "Saving…" : editId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500 text-[18px]">error_outline</span>
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">category</span>
            <h3 className="text-sm font-semibold text-neutral-900">All Categories</h3>
          </div>
          <span className="badge-muted">{categories.length} total</span>
        </div>

        {loading ? (
          <div className="divide-y divide-neutral-50">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-9 w-9 rounded-lg bg-neutral-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 bg-neutral-100 rounded" />
                  <div className="h-3 w-16 bg-neutral-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-neutral-300">category</span>
            </div>
            <p className="text-sm font-semibold text-neutral-500">No categories yet</p>
            <p className="text-xs text-neutral-400 mt-1">
              Create at least one category before adding assets.
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
              <span className="material-symbols-outlined text-[16px]">add</span>
              New Category
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-neutral-50/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      category
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{cat.name}</p>
                    <p className="text-xs font-mono text-neutral-500">{cat.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="Edit"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="p-2 rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
