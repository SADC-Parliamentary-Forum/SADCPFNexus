"use client";

import { useState, useEffect, useCallback } from "react";
import { stockItemsApi, stockCategoriesApi, type StockItem, type StockCategory } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { loadPdfLibs } from "@/lib/pdf-libs";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

function fmtMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StockReportsPage() {
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
      .catch(() => setError("Failed to load stock report."))
      .finally(() => setLoading(false));
  }, [filterCategory, lowOnly]);

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
    if (rows.length === 0) { setError("No data to export."); return; }
    exportToCsv(`stock-report-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { key: "item_code", header: "Item Code" },
      { key: "name", header: "Name" },
      { key: "category", header: "Category" },
      { key: "unit", header: "Unit" },
      { key: "current_balance", header: "Balance" },
      { key: "reorder_level", header: "Reorder Level" },
      { key: "low_stock", header: "Low Stock" },
      { key: "unit_cost", header: "Unit Cost" },
      { key: "stock_value", header: "Stock Value" },
      { key: "storage_location", header: "Location" },
      { key: "status", header: "Status" },
    ]);
  };

  const handlePdf = async () => {
    if (rows.length === 0) { setError("No data to export."); return; }
    setExportingPdf(true);
    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("Consumables / Stock Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated ${new Date().toLocaleDateString("en-GB")} – ${rows.length} item(s)`, 14, 22);
      autoTable(doc, {
        head: [["Item Code", "Name", "Category", "Balance", "Reorder", "Low", "Unit Cost", "Value", "Location"]],
        body: rows.map((r) => [r.item_code, r.name, r.category, r.current_balance, r.reorder_level, r.low_stock, r.unit_cost, r.stock_value, r.storage_location]),
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [29, 133, 237] },
      });
      doc.save(`stock-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setError("Failed to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <ModulePageHeader
        title="Stock Reports"
        subtitle="Consumables register report with CSV and PDF export."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Stock", href: "/stock" }, { label: "Reports" }]} />}
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={handleCsv} className="btn-secondary">
              <span className="material-symbols-outlined text-[18px]">download</span>Export CSV
            </button>
            <button type="button" onClick={handlePdf} disabled={exportingPdf} className="btn-secondary">
              {exportingPdf
                ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>}
              Export PDF
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
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Category</label>
          <select className="form-input text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700 mb-1.5 cursor-pointer">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="rounded border-neutral-300" />
          Low stock only
        </label>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : rows.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-semibold text-neutral-500">
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Reorder</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{i.item_code}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-900">{i.name}</span>
                      {i.is_low_stock && <span className="badge badge-warning ml-2">Low</span>}
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
        <div className="card p-16 text-center">
          <span className="material-symbols-outlined text-4xl text-neutral-300">summarize</span>
          <p className="mt-4 text-sm font-semibold text-neutral-600">No data for the selected filters</p>
        </div>
      )}
    </div>
  );
}
