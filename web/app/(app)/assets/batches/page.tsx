"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  assetCategoriesApi,
  assetsApi,
  type AssetAcquisitionBatch,
  type AssetCategory,
  type AssetSubcategory,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchField } from "@/components/ui/SearchField";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Created = { id: number; reference: string; count: number; labelsPrinted: boolean };

export default function AssetBatchesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AssetAcquisitionBatch[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [subcategories, setSubcategories] = useState<AssetSubcategory[]>([]);

  // Form
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState(1);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [printNow, setPrintNow] = useState(true);

  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  async function load(term: string) {
    setLoadingRows(true);
    try {
      const r = await assetsApi.batches({ per_page: 50, ...(term ? { search: term } : {}) });
      const payload = r.data as { data?: AssetAcquisitionBatch[] };
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    const term = search.trim();
    const timer = setTimeout(() => void load(term), term ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    assetCategoriesApi.list()
      .then((r) => {
        const list = r.data.data ?? [];
        setCategories(list);
        setCategory((current) => current || list[0]?.code || "");
      })
      .catch(() => setCategories([]));
  }, []);

  // Subcategories drive the tag number (e.g. PF/ICT/LT/0001), so load them per category.
  useEffect(() => {
    setSubcategory("");
    setSubcategories([]);
    const row = categories.find((c) => c.code === category);
    if (!row) return;
    assetCategoriesApi.subcategories(row.id)
      .then((r) => setSubcategories(r.data.data ?? []))
      .catch(() => setSubcategories([]));
  }, [category, categories]);

  async function firstTemplateId(): Promise<number | null> {
    const templates = await fetch("/api/assets/labels/templates", {
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then((r) => r.json()) as { data?: { id: number }[] };
    return templates.data?.[0]?.id ?? null;
  }

  async function printLabels(id: number): Promise<boolean> {
    const templateId = await firstTemplateId();
    if (!templateId) return false;
    await assetsApi.printBatchLabels(id, { template_id: templateId, json: true });
    return true;
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      const name = description.trim();
      const batch = await assetsApi.createBatch({
        description: name,
        name,
        qty,
        category: category || "it",
        subcategory_code: subcategory || undefined,
        unit_cost: unitCost === "" ? undefined : Number(unitCost),
        supplier_name: supplier.trim() || undefined,
        invoice_number: invoice.trim() || undefined,
        received_date: receivedDate || undefined,
      });
      const id = batch.data.data.id;
      await assetsApi.createBatchAssets(id, { name, category: category || "it", subcategory_code: subcategory || undefined });
      let labelsPrinted = false;
      if (printNow) {
        try {
          labelsPrinted = await printLabels(id);
        } catch {
          /* assets exist; labels can be printed from the row action */
        }
      }
      setCreated({ id, reference: batch.data.data.reference, count: qty, labelsPrinted });
      setDescription("");
      setQty(1);
      setUnitCost("");
      setSupplier("");
      setInvoice("");
      setReceivedDate("");
      await load(search.trim());
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.assignFailed")));
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
      await load(search.trim());
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.assignFailed")));
    } finally {
      setPrinting(null);
    }
  }

  const categoryLabel = (code?: string | null) => categories.find((c) => c.code === code)?.name ?? code ?? "—";

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.batches.title"
        subtitle="assets.batches.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ href: "/assets", label: "nav.assets" }, { label: "assets.batches.title" }]} />}
      />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {created ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900" data-testid="batch-created">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check_circle</span>
          <span className="flex-1">
            {t("assets.batches.createdNotice", { count: created.count, reference: created.reference })}
            {created.labelsPrinted ? ` ${t("assets.batches.labelsQueued")}` : ""}
          </span>
          <Link className="btn-primary px-3 py-1.5 text-xs" href={`/assets/handovers/new?batchId=${created.id}`}>{t("assets.batches.issueNow")}</Link>
        </div>
      ) : null}

      <form onSubmit={create} className="card space-y-4 p-4" data-testid="batch-create-form">
        <div>
          <h2 className="font-semibold">{t("assets.batches.receiveTitle")}</h2>
          <p className="text-sm text-neutral-600">{t("assets.batches.receiveHint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label htmlFor="batch-description-field" className="block text-sm sm:col-span-2">
            {t("assets.batches.itemName")} <span className="text-red-500">*</span>
            <input id="batch-description-field"
              className="form-input mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={255}
              placeholder={t("assets.batches.itemNamePlaceholder")}
              data-testid="batch-description"
            />
          </label>
          <label htmlFor="batch-qty-field" className="block text-sm">
            {t("assets.batches.qty")} <span className="text-red-500">*</span>
            <input id="batch-qty-field"
              className="form-input mt-1"
              type="number"
              min={1}
              max={500}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              required
              data-testid="batch-qty"
            />
          </label>
          <label htmlFor="batch-category-field" className="block text-sm">
            {t("assets.view.fieldCategory")}
            <select id="batch-category-field" className="form-input mt-1" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="batch-category">
              {categories.map((c) => (
                <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
              ))}
              {categories.length === 0 ? <option value="">—</option> : null}
            </select>
          </label>
          <label htmlFor="batch-subcategory-field" className="block text-sm">
            {t("assets.batches.subcategory")}
            <select id="batch-subcategory-field"
              className="form-input mt-1"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={subcategories.length === 0}
              data-testid="batch-subcategory"
            >
              <option value="">{subcategories.length === 0 ? t("assets.batches.noSubcategories") : t("assets.batches.anySubcategory")}</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
          </label>
        </div>

        <details className="rounded-lg border border-dashed border-neutral-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-primary">{t("assets.batches.purchaseDetails")}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label htmlFor="batch-unit-cost-field" className="block text-sm">
              {t("assets.batches.unitCost")}
              <input id="batch-unit-cost-field" className="form-input mt-1" type="number" min={0} step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} data-testid="batch-unit-cost" />
            </label>
            <label htmlFor="batch-supplier-field" className="block text-sm">
              {t("assets.batches.supplier")}
              <input id="batch-supplier-field" className="form-input mt-1" value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={255} data-testid="batch-supplier" />
            </label>
            <label htmlFor="batch-invoice-field" className="block text-sm">
              {t("assets.batches.invoice")}
              <input id="batch-invoice-field" className="form-input mt-1" value={invoice} onChange={(e) => setInvoice(e.target.value)} maxLength={64} data-testid="batch-invoice" />
            </label>
            <label htmlFor="batch-received-field" className="block text-sm">
              {t("assets.batches.receivedDate")}
              <input id="batch-received-field" className="form-input mt-1" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} data-testid="batch-received" />
            </label>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="batch-print-now-field" className="flex items-center gap-2 text-sm">
            <input id="batch-print-now-field" type="checkbox" checked={printNow} onChange={(e) => setPrintNow(e.target.checked)} data-testid="batch-print-now" />
            {t("assets.batches.printNow")}
          </label>
          <button type="submit" className="btn-primary" disabled={busy || !description.trim()} data-testid="batch-create">
            {busy ? t("common.loading") : t("assets.batches.createCount", { count: qty })}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{t("assets.batches.listTitle")}</h2>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("assets.batches.search")}
            testId="batch-search"
            className="w-full sm:w-80"
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("assets.batches.reference")}</th>
                <th>{t("assets.batches.itemName")}</th>
                <th>{t("assets.view.fieldCategory")}</th>
                <th>{t("assets.batches.progress")}</th>
                <th>{t("assets.view.fieldStatus")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const p = row.progress;
                return (
                  <tr key={row.id} data-testid={`batch-row-${row.reference}`}>
                    <td className="font-mono text-xs">{row.reference}</td>
                    <td>{row.description || "—"}</td>
                    <td>{categoryLabel(row.category)}</td>
                    <td className="text-xs text-neutral-600">
                      {p
                        ? t("assets.batches.progressValue", { created: p.created, assigned: p.assigned, available: p.still_available })
                        : row.qty}
                    </td>
                    <td>{row.status}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
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
                );
              })}
              {!loadingRows && rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {search.trim()
                      ? <p className="py-6 text-center text-sm text-neutral-500">{t("common.noResults")}</p>
                      : <EmptyState icon="inventory_2" title="assets.batches.empty" />}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
