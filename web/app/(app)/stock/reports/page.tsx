"use client";

import { useState, useEffect, useCallback } from "react";
import { stockItemsApi, stockCategoriesApi, type StockItem, type StockCategory } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { loadPdfLibs } from "@/lib/pdf-libs";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function fmtMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StockReportsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: { per_page: number; category_id?: number; low_stock?: number } = { per_page: 100 };
    if (filterCategory !== "all") params.category_id = Number(filterCategory);
    if (lowOnly) params.low_stock = 1;
    stockItemsApi
      .list(params)
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => setError(t("stock.reports.loadFailed")))
      .finally(() => setLoading(false));
  }, [filterCategory, lowOnly, t]);

  useEffect(() => {
    stockCategoriesApi.list().then((res) => setCategories(res.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = items.map((i) => ({
    item_code: i.item_code,
    name: i.name,
    category: i.category?.name ?? "",
    unit: i.unit ?? "",
    current_balance: i.current_balance,
    reorder_level: i.reorder_level,
    low_stock: i.is_low_stock ? "YES" : "no",
    unit_cost: fmtMoney(i.unit_cost),
    stock_value: fmtMoney(i.stock_value),
    storage_location: i.storage_location ?? "",
    status: i.status,
  }));

  const handleCsv = () => {
    if (rows.length === 0) { setError(t("stock.reports.noData")); return; }
    exportToCsv(`stock-report-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { key: "item_code", header: t("stock.common.itemCode") },
      { key: "name", header: t("stock.common.name") },
      { key: "category", header: t("stock.common.category") },
      { key: "unit", header: t("stock.reports.unit") },
      { key: "current_balance", header: t("stock.common.balance") },
      { key: "reorder_level", header: t("stock.common.reorderLevel") },
      { key: "low_stock", header: t("stock.reports.lowStock") },
      { key: "unit_cost", header: t("stock.common.unitCost") },
      { key: "stock_value", header: t("stock.dashboard.stockValue") },
      { key: "storage_location", header: t("stock.common.location") },
      { key: "status", header: t("stock.common.status") },
    ]);
  };

  const handlePdf = async () => {
    if (rows.length === 0) { setError(t("stock.reports.noData")); return; }
    setExportingPdf(true);
    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text(t("stock.reports.pdfTitle"), 14, 15);
      doc.setFontSize(10);
      doc.text(t("stock.reports.pdfGenerated", { date: new Date().toLocaleDateString("en-GB"), count: rows.length }), 14, 22);
      autoTable(doc, {
        head: [[t("stock.common.itemCode"), t("stock.common.name"), t("stock.common.category"), t("stock.common.balance"), t("stock.common.reorder"), t("stock.reports.low"), t("stock.common.unitCost"), t("stock.common.value"), t("stock.common.location")]],
        body: rows.map((r) => [r.item_code, r.name, r.category, r.current_balance, r.reorder_level, r.low_stock, r.unit_cost, r.stock_value, r.storage_location]),
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [29, 133, 237] },
      });
      doc.save(`stock-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setError(t("stock.reports.pdfFailed"));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.reports.title")}
        subtitle={t("stock.reports.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.common.stock"), href: "/stock" }, { label: t("stock.reports.crumb") }]} />}
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={handleCsv} className="btn-secondary">
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t("stock.reports.exportCsv")}
            </button>
            <button type="button" onClick={handlePdf} disabled={exportingPdf} className="btn-secondary">
              {exportingPdf
                ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>}
              {t("stock.reports.exportPdf")}
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>{error}
        </div>
      )}

      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div className="min-w-[180px]">
          <label htmlFor="stock-reports-category" className="block text-xs font-semibold text-neutral-600 mb-1">{t("stock.common.category")}</label>
          <select id="stock-reports-category" className="form-input text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">{t("stock.categories.all")}</option>
            {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>
        <label htmlFor="stock-reports-setlowonly-e-target-checked-classname-rounded-bo" className="flex items-center gap-2 text-sm text-neutral-700 mb-1.5 cursor-pointer">
          <input id="stock-reports-setlowonly-e-target-checked-classname-rounded-bo" type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="rounded border-neutral-300" />
          {t("stock.reports.lowOnly")}
        </label>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        </div>
      ) : rows.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-semibold text-neutral-500">
                  <th className="px-4 py-3">{t("stock.common.itemCode")}</th>
                  <th className="px-4 py-3">{t("stock.common.name")}</th>
                  <th className="px-4 py-3">{t("stock.common.category")}</th>
                  <th className="px-4 py-3 text-right">{t("stock.common.balance")}</th>
                  <th className="px-4 py-3 text-right">{t("stock.common.reorder")}</th>
                  <th className="px-4 py-3 text-right">{t("stock.common.unitCost")}</th>
                  <th className="px-4 py-3 text-right">{t("stock.common.value")}</th>
                  <th className="px-4 py-3">{t("stock.common.location")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{i.item_code}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-900">{i.name}</span>
                      {i.is_low_stock && <span className="badge badge-warning ml-2">{t("stock.reports.low")}</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{i.category?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900">{i.current_balance}</td>
                    <td className="px-4 py-3 text-right text-neutral-500">{i.reorder_level || "—"}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{fmtMoney(i.unit_cost) || "—"}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{fmtMoney(i.stock_value) || "—"}</td>
                    <td className="px-4 py-3 text-neutral-500">{i.storage_location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState icon="summarize" title={t("stock.reports.empty")} />
        </div>
      )}
    </div>
  );
}
