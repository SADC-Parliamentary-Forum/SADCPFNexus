"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  travelApi,
  leaveApi,
  programmeApi,
  reportsApi,
  assetCategoriesApi,
  type TravelRequest,
  type LeaveRequest,
  type Programme,
  type Asset,
  type AssetCategory,
} from "@/lib/api";
import { formatDateTable, formatDateRangeTable } from "@/lib/utils";

type ReportKey = "travel" | "leave" | "budget" | "programme" | "assets";

interface DateRange { from: string; to: string }

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function csvBlob(header: string, rows: string[][]): Blob {
  const lines = [header, ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  return new Blob([lines], { type: "text/csv;charset=utf-8;" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [openCard, setOpenCard] = useState<ReportKey | null>(null);
  const [range, setRange] = useState<Record<ReportKey, DateRange & { category?: string }>>({
    travel:    { from: "2026-01-01", to: "2026-03-31" },
    leave:     { from: "2026-01-01", to: "2026-03-31" },
    budget:    { from: "", to: "" },
    programme: { from: "", to: "" },
    assets:    { from: "", to: "", category: "" },
  });

  const [travelRows, setTravelRows] = useState<TravelRequest[] | null>(null);
  const [leaveRows,  setLeaveRows]  = useState<LeaveRequest[]   | null>(null);
  const [budgetRows, setBudgetRows] = useState<Programme[]       | null>(null);
  const [progRows,   setProgRows]   = useState<Programme[]       | null>(null);
  const [assetRows,  setAssetRows]  = useState<Asset[]            | null>(null);
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([]);
  const [loading,    setLoading]    = useState<ReportKey | null>(null);
  const [exportingAssetsPdf, setExportingAssetsPdf] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (openCard === "assets") {
      assetCategoriesApi.list().then((r) => setAssetCategories(r.data.data ?? [])).catch(() => {});
    }
  }, [openCard]);

  const toggle = (key: ReportKey) => {
    setOpenCard(openCard === key ? null : key);
    setError(null);
  };

  const generate = (key: ReportKey) => {
    setLoading(key);
    setError(null);
    const r = range[key];

    if (key === "travel") {
      travelApi.list({ ...(r.from && { from: r.from }), ...(r.to && { to: r.to }), per_page: 200 })
        .then((res) => setTravelRows((res.data as any).data))
        .catch(() => setError("Failed to load travel data."))
        .finally(() => setLoading(null));
    } else if (key === "leave") {
      leaveApi.list({ ...(r.from && { from: r.from }), ...(r.to && { to: r.to }), per_page: 200 })
        .then((res) => setLeaveRows((res.data as any).data))
        .catch(() => setError("Failed to load leave data."))
        .finally(() => setLoading(null));
    } else if (key === "budget" || key === "programme") {
      programmeApi.list({ per_page: 100 })
        .then((res) => {
          if (key === "budget") setBudgetRows((res.data as any).data);
          else setProgRows((res.data as any).data);
        })
        .catch(() => setError("Failed to load programme data."))
        .finally(() => setLoading(null));
    } else if (key === "assets") {
      const r = range.assets;
      reportsApi.assets({
        period_from: r.from || undefined,
        period_to: r.to || undefined,
        category: r.category || undefined,
        per_page: 100,
      })
        .then((res) => setAssetRows((res.data as { data?: Asset[] }).data ?? []))
        .catch(() => setError("Failed to load asset data."))
        .finally(() => setLoading(null));
    }
  };

  const exportTravel = () => {
    if (!travelRows) return;
    downloadBlob(csvBlob(
      "Reference,Purpose,Destination,Departure,Return,Currency,DSA,Status",
      travelRows.map((t) => [t.reference_number, t.purpose, t.destination_country, t.departure_date, t.return_date, t.currency, String(t.estimated_dsa), t.status])
    ), "travel-report.csv");
  };

  const exportLeave = () => {
    if (!leaveRows) return;
    downloadBlob(csvBlob(
      "Reference,Staff,Type,From,To,Days,Status",
      leaveRows.map((l) => [l.reference_number, l.requester?.name ?? "", l.leave_type, l.start_date, l.end_date, String(l.days_requested), l.status])
    ), "leave-report.csv");
  };

  const exportBudget = () => {
    if (!budgetRows) return;
    const rows: string[][] = [];
    for (const p of budgetRows) {
      for (const bl of p.budget_lines ?? []) {
        rows.push([p.reference_number, p.title, bl.category, bl.description, String(bl.amount), String(bl.actual_spent), bl.funding_source]);
      }
    }
    downloadBlob(csvBlob("Programme,Title,Category,Description,Budgeted,Actual Spent,Funding Source", rows), "budget-utilisation.csv");
  };

  const exportProg = () => {
    if (!progRows) return;
    downloadBlob(csvBlob(
      "Reference,Title,Status,Funding Source,Budget,Currency,Start,End",
      progRows.map((p) => [p.reference_number, p.title, p.status, p.funding_source ?? "", String(p.total_budget), p.primary_currency, p.start_date ?? "", p.end_date ?? ""])
    ), "programme-progress.csv");
  };

  const exportAssetsCsv = () => {
    if (!assetRows) return;
    downloadBlob(csvBlob(
      "Code,Name,Category,Status,Age,Value",
      assetRows.map((a) => [
        a.asset_code,
        a.name,
        a.category,
        a.status,
        a.age_display ?? "",
        a.current_value != null ? String(a.current_value) : a.value != null ? String(a.value) : "",
      ])
    ), "assets-report.csv");
  };

  const exportAssetsPdf = async () => {
    if (!assetRows || assetRows.length === 0) return;
    setExportingAssetsPdf(true);
    try {
      const qrBase64: string[] = [];
      for (const asset of assetRows) {
        try {
          const r = await api.get<Blob>(`/assets/${asset.id}/qr`, { responseType: "blob" });
          qrBase64.push(await blobToBase64(r.data));
        } catch {
          qrBase64.push("");
        }
      }
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("Asset Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated ${new Date().toLocaleDateString()} – ${assetRows.length} item(s)`, 14, 22);
      const headers = ["Code", "Name", "Category", "Status", "QR"];
      const body = assetRows.map((a) => [a.asset_code, a.name, a.category, a.status, ""]);
      autoTable(doc, {
        head: [headers],
        body,
        startY: 28,
        didDrawCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { x: number; y: number; width: number; height: number } }) => {
          if (data.section === "body" && data.column.index === 4 && data.row.index < qrBase64.length) {
            const img = qrBase64[data.row.index];
            if (img) {
              const cell = data.cell;
              const size = Math.min(18, cell.width - 2, cell.height - 2);
              doc.addImage(img, "PNG", cell.x + 2, cell.y + 2, size, size);
            }
          }
        },
        styles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 45 }, 2: { cellWidth: 25 }, 3: { cellWidth: 28 }, 4: { cellWidth: 22 } },
      });
      doc.save(`assets-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setError("Failed to export PDF.");
    } finally {
      setExportingAssetsPdf(false);
    }
  };

  const cards: { key: ReportKey; title: string; desc: string; icon: string; color: string; bg: string }[] = [
    { key: "travel",    title: "Travel Summary",        desc: "Mission reports, DSA usage, and travel analytics.",        icon: "flight_takeoff",   color: "text-primary",    bg: "bg-primary/10" },
    { key: "leave",     title: "Leave Summary",         desc: "Leave applications by type, status, and staff member.",    icon: "event_available",  color: "text-green-600",  bg: "bg-green-50"   },
    { key: "assets",    title: "Assets",                desc: "Asset register with category and date filters; export with QR codes.", icon: "inventory_2",  color: "text-teal-600",   bg: "bg-teal-50"    },
    { key: "budget",    title: "Budget Utilisation",    desc: "Programme budget lines — budgeted vs. actual expenditure.", icon: "account_balance",  color: "text-amber-600",  bg: "bg-amber-50"   },
    { key: "programme", title: "Programme Progress",    desc: "Status breakdown and timeline for all PIF programmes.",   icon: "account_tree",     color: "text-purple-600", bg: "bg-purple-50"  },
  ];

  const isLoading = (key: ReportKey) => loading === key;
  const hasData = (key: ReportKey) => {
    if (key === "travel")    return travelRows !== null;
    if (key === "leave")     return leaveRows !== null;
    if (key === "budget")    return budgetRows !== null;
    if (key === "programme") return progRows !== null;
    if (key === "assets")    return assetRows !== null;
    return false;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Generate and export analytics across travel, leave, finance, and programmes.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {cards.map((c) => (
          <div key={c.key} className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg}`}>
                  <span className={`material-symbols-outlined ${c.color}`} style={{ fontSize: "22px", fontVariationSettings: "'FILL' 0" }}>{c.icon}</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">{c.title}</h2>
                  <p className="text-xs text-neutral-500">{c.desc}</p>
                </div>
              </div>
              <button type="button" onClick={() => toggle(c.key)} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">{openCard === c.key ? "expand_less" : "tune"}</span>
                {openCard === c.key ? "Close" : "Generate"}
              </button>
            </div>

            {openCard === c.key && (
              <div className="border-t border-neutral-100 px-5 py-4 space-y-4">
                {/* Date range (travel, leave, assets) */}
                {(c.key === "travel" || c.key === "leave" || c.key === "assets") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 mb-1">From</label>
                      <input type="date" className="form-input text-sm"
                        value={range[c.key].from}
                        onChange={(e) => setRange((prev) => ({ ...prev, [c.key]: { ...prev[c.key], from: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 mb-1">To</label>
                      <input type="date" className="form-input text-sm"
                        value={range[c.key].to}
                        onChange={(e) => setRange((prev) => ({ ...prev, [c.key]: { ...prev[c.key], to: e.target.value } }))}
                      />
                    </div>
                    {c.key === "assets" && (
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">Category</label>
                        <select
                          className="form-input text-sm"
                          value={range.assets.category ?? ""}
                          onChange={(e) => setRange((prev) => ({ ...prev, assets: { ...prev.assets, category: e.target.value } }))}
                        >
                          <option value="">All categories</option>
                          {assetCategories.map((cat) => (
                            <option key={cat.id} value={cat.code}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => generate(c.key)}
                    disabled={isLoading(c.key)}
                    className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isLoading(c.key) ? (
                      <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                    )}
                    {isLoading(c.key) ? "Loading…" : "Generate Report"}
                  </button>
                  {hasData(c.key) && (
                    <>
                      <button
                        type="button"
                        onClick={
                          c.key === "travel" ? exportTravel
                          : c.key === "leave" ? exportLeave
                          : c.key === "budget" ? exportBudget
                          : c.key === "programme" ? exportProg
                          : exportAssetsCsv
                        }
                        className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[15px]">download</span>
                        Export CSV
                      </button>
                      {c.key === "assets" && (
                        <button
                          type="button"
                          onClick={exportAssetsPdf}
                          disabled={exportingAssetsPdf}
                          className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {exportingAssetsPdf ? (
                            <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
                          )}
                          Export PDF
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Preview table — Travel */}
                {c.key === "travel" && travelRows !== null && (
                  <div className="overflow-x-auto rounded-lg border border-neutral-100">
                    <table className="data-table text-xs">
                      <thead><tr><th>Reference</th><th>Purpose</th><th>Destination</th><th>Dates</th><th>DSA</th><th>Status</th></tr></thead>
                      <tbody>
                        {travelRows.slice(0, 10).map((t) => (
                          <tr key={t.id}>
                            <td className="font-mono">{t.reference_number}</td>
                            <td className="max-w-[120px] truncate">{t.purpose}</td>
                            <td>{t.destination_country}</td>
                            <td className="whitespace-nowrap text-[11px] text-neutral-500 tabular-nums">{formatDateRangeTable(t.departure_date, t.return_date)}</td>
                            <td>{t.currency} {t.estimated_dsa.toLocaleString()}</td>
                            <td><span className="badge badge-muted capitalize">{t.status}</span></td>
                          </tr>
                        ))}
                        {travelRows.length === 0 && (
                          <tr><td colSpan={6} className="py-4 text-center text-neutral-400">No records in this period.</td></tr>
                        )}
                      </tbody>
                    </table>
                    {travelRows.length > 10 && <p className="px-4 py-2 text-xs text-neutral-400">Showing 10 of {travelRows.length} · Export CSV for full data</p>}
                  </div>
                )}

                {/* Preview table — Leave */}
                {c.key === "leave" && leaveRows !== null && (
                  <div className="overflow-x-auto rounded-lg border border-neutral-100">
                    <table className="data-table text-xs">
                      <thead><tr><th>Reference</th><th>Staff</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr></thead>
                      <tbody>
                        {leaveRows.slice(0, 10).map((l) => (
                          <tr key={l.id}>
                            <td className="font-mono">{l.reference_number}</td>
                            <td>{l.requester?.name ?? "—"}</td>
                            <td className="capitalize">{l.leave_type}</td>
                            <td className="text-[11px] text-neutral-500 tabular-nums">{formatDateTable(l.start_date)}</td>
                            <td className="text-[11px] text-neutral-500 tabular-nums">{formatDateTable(l.end_date)}</td>
                            <td>{l.days_requested}</td>
                            <td><span className="badge badge-muted capitalize">{l.status}</span></td>
                          </tr>
                        ))}
                        {leaveRows.length === 0 && (
                          <tr><td colSpan={7} className="py-4 text-center text-neutral-400">No records found.</td></tr>
                        )}
                      </tbody>
                    </table>
                    {leaveRows.length > 10 && <p className="px-4 py-2 text-xs text-neutral-400">Showing 10 of {leaveRows.length} · Export CSV for full data</p>}
                  </div>
                )}

                {/* Budget utilisation */}
                {c.key === "budget" && budgetRows !== null && (
                  <div className="space-y-3">
                    {budgetRows.map((p) => {
                      const totalBudget = (p.budget_lines ?? []).reduce((s, bl) => s + Number(bl.amount), 0);
                      const totalSpent  = (p.budget_lines ?? []).reduce((s, bl) => s + Number(bl.actual_spent), 0);
                      const pct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
                      return (
                        <div key={p.id} className="rounded-lg border border-neutral-100 px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-neutral-800">{p.reference_number} — {p.title}</span>
                            <span className="text-xs text-neutral-500">{pct}% utilised</span>
                          </div>
                          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-green-500"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-1">
                            {p.primary_currency} {totalSpent.toLocaleString()} spent of {totalBudget.toLocaleString()} budgeted
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Preview table — Assets */}
                {c.key === "assets" && assetRows !== null && (
                  <div className="overflow-x-auto rounded-lg border border-neutral-100">
                    <table className="data-table text-xs">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Age</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetRows.slice(0, 10).map((a) => (
                          <tr key={a.id}>
                            <td className="font-mono">{a.asset_code}</td>
                            <td className="max-w-[120px] truncate">{a.name}</td>
                            <td className="capitalize">{a.category}</td>
                            <td><span className="badge badge-muted capitalize">{a.status}</span></td>
                            <td className="text-neutral-500">{a.age_display ?? "—"}</td>
                            <td className="tabular-nums">
                              {a.current_value != null ? Number(a.current_value).toLocaleString("en-US", { minimumFractionDigits: 2 }) : a.value != null ? Number(a.value).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                            </td>
                          </tr>
                        ))}
                        {assetRows.length === 0 && (
                          <tr><td colSpan={6} className="py-4 text-center text-neutral-400">No assets in this period.</td></tr>
                        )}
                      </tbody>
                    </table>
                    {assetRows.length > 10 && (
                      <p className="px-4 py-2 text-xs text-neutral-400">Showing 10 of {assetRows.length} · Export CSV/PDF for full data</p>
                    )}
                  </div>
                )}

                {/* Programme progress */}
                {c.key === "programme" && progRows !== null && (
                  <div className="overflow-x-auto rounded-lg border border-neutral-100">
                    <table className="data-table text-xs">
                      <thead><tr><th>Code</th><th>Title</th><th>Status</th><th>Funding</th><th>Budget</th><th>End Date</th></tr></thead>
                      <tbody>
                        {progRows.map((p) => (
                          <tr key={p.id}>
                            <td className="font-mono">{p.reference_number}</td>
                            <td className="max-w-[160px] truncate font-medium">{p.title}</td>
                            <td><span className="badge badge-muted capitalize">{p.status.replace(/_/g, " ")}</span></td>
                            <td>{p.funding_source ?? "—"}</td>
                            <td>{p.primary_currency} {Number(p.total_budget).toLocaleString()}</td>
                            <td className="text-[11px] text-neutral-500 tabular-nums">{formatDateTable(p.end_date)}</td>
                          </tr>
                        ))}
                        {progRows.length === 0 && (
                          <tr><td colSpan={6} className="py-4 text-center text-neutral-400">No programmes found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
