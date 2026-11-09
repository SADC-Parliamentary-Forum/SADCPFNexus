"use client";

import { useState, useEffect } from "react";
import { assetCategoriesApi, type AssetCategory } from "@/lib/api";
import { canManageAssets, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssetCategoriesPage() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; code: string; sort_order: number; useful_life_years: string }>({
    name: "",
    code: "",
    sort_order: 0,
    useful_life_years: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useI18n();

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
      .catch(() => setError(t("assets.categories.loadFailed")))
      .finally(() => setLoading(false));
  }, [allowed, t]);

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
          useful_life_years: form.useful_life_years === "" ? null : Number(form.useful_life_years),
        });
        toast("success", t("assets.categories.toast.updated"));
      } else {
        await assetCategoriesApi.create({
          name,
          code,
          sort_order: form.sort_order,
          useful_life_years: form.useful_life_years === "" ? undefined : Number(form.useful_life_years),
        });
        toast("success", t("assets.categories.toast.created"));
      }
      const res = await assetCategoriesApi.list();
      setCategories(res.data.data ?? []);
      setEditId(null);
      setForm({ name: "", code: "", sort_order: 0, useful_life_years: "" });
      setShowForm(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || t("assets.categories.saveFailed"));
      toast("error", msg || t("assets.categories.saveFailed"));
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
      useful_life_years: cat.useful_life_years ? String(cat.useful_life_years) : "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", code: "", sort_order: 0, useful_life_years: "" });
  };

  const handleDelete = async (id: number, name: string) => {
    if (
      !(await confirm({
        title: t("assets.categories.deleteTitle"),
        message: t("assets.categories.deleteConfirm", { name }),
        variant: "danger",
      }))
    )
      return;
    try {
      await assetCategoriesApi.delete(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast("success", t("assets.categories.toast.deleted"));
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast("error", msg || t("assets.categories.deleteFailed"));
    }
  };

  if (allowed === null || allowed === false) {
    return null;
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("assets.categories.title")}
        subtitle={t("assets.categories.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.assets", href: "/assets" },
              { label: "assets.categories.breadcrumb" },
            ]}
          />
        }
        actions={
          <button
            type="button"
            onClick={() => {
              setShowForm(!showForm);
              setEditId(null);
              setForm({ name: "", code: "", sort_order: 0, useful_life_years: "" });
            }}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-[18px]">
              {showForm && !editId ? "close" : "add"}
            </span>
            {showForm && !editId ? t("common.cancel") : t("assets.categories.new")}
          </button>
        }
      />

      {showForm && (
        <div className="card border-primary/20 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">
                {editId ? "edit" : "category"}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {editId ? t("assets.categories.edit") : t("assets.categories.new")}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="asset-cat-name" className="block text-xs font-semibold text-neutral-700">
                {t("assets.categories.name")} <span className="text-red-500">*</span>
              </label>
              <input
                id="asset-cat-name"
                className="form-input"
                placeholder={t("assets.categories.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="asset-cat-code" className="block text-xs font-semibold text-neutral-700">
                {t("assets.categories.code")} <span className="text-red-500">*</span>
              </label>
              <input
                id="asset-cat-code"
                className="form-input font-mono"
                placeholder={t("assets.categories.codePlaceholder")}
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }))
                }
              />
              {editId && (
                <p className="text-xs text-neutral-400">{t("assets.categories.codeHint")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="asset-cat-sort" className="block text-xs font-semibold text-neutral-700">{t("assets.categories.sortOrder")}</label>
              <input
                id="asset-cat-sort"
                type="number"
                min={0}
                className="form-input"
                value={form.sort_order}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="asset-cat-life" className="block text-xs font-semibold text-neutral-700">{t("assets.categories.usefulLife")}</label>
              <input
                id="asset-cat-life"
                type="number"
                min={1}
                max={80}
                className="form-input"
                placeholder={t("assets.categories.lifePlaceholder")}
                value={form.useful_life_years}
                onChange={(e) => setForm((p) => ({ ...p, useful_life_years: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancelForm} className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">close</span>
              {t("common.cancel")}
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
              {saving ? t("assets.categories.saving") : editId ? t("assets.categories.update") : t("assets.categories.create")}
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
            <h3 className="text-sm font-semibold text-neutral-900">{t("assets.categories.all")}</h3>
          </div>
          <span className="badge-muted">{t("assets.categories.total", { count: categories.length })}</span>
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
          <EmptyState
            icon="category"
            title={t("assets.categories.empty")}
            description={t("assets.categories.emptyHint")}
            action={
              <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
                <span className="material-symbols-outlined text-[16px]">add</span>
                {t("assets.categories.new")}
              </button>
            }
          />
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
                    <p className="text-xs font-mono text-neutral-500">
                      {cat.code}
                      {cat.useful_life_years ? ` ${t("assets.categories.lifeYears", { years: cat.useful_life_years })}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label={t("common.edit")}
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="p-2 rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={t("common.delete")}
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
