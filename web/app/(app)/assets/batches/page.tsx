"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { assetCategoriesApi, assetsApi, type AssetAcquisitionBatch, type AssetCategory } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssetBatchesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AssetAcquisitionBatch[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [qty, setQty] = useState(2);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const r = await assetsApi.batches({ per_page: 50 });
    const payload = r.data as { data?: AssetAcquisitionBatch[] };
    setRows(Array.isArray(payload.data) ? payload.data : []);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
    assetCategoriesApi.list()
      .then((r) => {
        const list = r.data.data ?? [];
        setCategories(list);
        setCategory((current) => current || list[0]?.code || "it");
      })
      .catch(() => setCategory("it"));
  }, []);

  async function printLabels(id: number) {
    const templates = await fetch("/api/assets/labels/templates", {
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then((r) => r.json()) as { data?: { id: number }[] };
    const templateId = templates.data?.[0]?.id;
    if (!templateId) return false;
    await assetsApi.printBatchLabels(id, { template_id: templateId, json: true });
    return true;
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await assetsApi.createBatch({
        description,
        qty,
        category: category || "it",
        subcategory_code: "LT",
      });
      const id = created.data.data.id;
      await assetsApi.createBatchAssets(id, { name: description || "Asset", category: category || "it" });
      try {
        await printLabels(id);
      } catch {
        /* assets exist; labels can be printed from the row action */
      }
      setDescription("");
      await load();
    } catch {
      setError(t("assets.assignFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function printRow(id: number) {
    setPrinting(id);
    setError("");
    try {
      const ok = await printLabels(id);
      if (!ok) setError(t("assets.register.needTemplate"));
      await load();
    } catch {
      setError(t("assets.assignFailed"));
    } finally {
      setPrinting(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.batches.title"
        subtitle="assets.batches.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.batches.title") }]} />}
      />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <form onSubmit={create} className="card space-y-3 p-4" data-testid="batch-create-form">
        <label className="block text-sm">
          {t("assets.batches.qty")}
          <input
            className="form-input mt-1"
            type="number"
            min={1}
            max={500}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            data-testid="batch-qty"
          />
        </label>
        <label className="block text-sm">
          {t("assets.view.fieldCategory")}
          <select className="form-input mt-1" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="batch-category">
            {categories.map((c) => (
              <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
            ))}
            {categories.length === 0 && <option value={category || "it"}>{category || "it"}</option>}
          </select>
        </label>
        <label className="block text-sm">
          {t("common.reason")}
          <input
            className="form-input mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            data-testid="batch-description"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={busy} data-testid="batch-create">
          {busy ? t("common.loading") : t("assets.batches.create")}
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>{t("common.reason")}</th>
              <th>{t("assets.batches.qty")}</th>
              <th>{t("assets.view.fieldStatus")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-testid={`batch-row-${row.reference}`}>
                <td className="font-mono text-xs">{row.reference}</td>
                <td>{row.description || "—"}</td>
                <td>{row.progress?.created ?? row.qty}</td>
                <td>{row.status}</td>
                <td className="text-right space-x-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={printing === row.id}
                    data-testid={`batch-print-${row.id}`}
                    onClick={() => void printRow(row.id)}
                  >
                    {t("assets.batches.printLabels")}
                  </button>
                  <Link className="btn-secondary text-xs" href={`/assets/handovers/new?batchId=${row.id}`}>
                    {t("assets.handover.create")}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}><EmptyState icon="inventory_2" title="assets.batches.empty" /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
