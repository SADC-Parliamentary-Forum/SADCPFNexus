"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { loadPdfLibs } from "@/lib/pdf-libs";
import api from "@/lib/api";
import { assetsApi, assetRequestsApi, type Asset, type AssetRequest } from "@/lib/api";
import { canManageAssets, getStoredUser } from "@/lib/auth";

const statusConfig: Record<string, { label: string; cls: string }> = {
  active:       { label: "Active",       cls: "badge-success" },
  service_due:  { label: "Service Due",  cls: "badge-warning" },
  loan_out:     { label: "Loan Out",      cls: "badge-info" },
  retired:      { label: "Retired",       cls: "badge-muted" },
};

const requestStatusConfig: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "badge-warning" },
  approved: { label: "Approved", cls: "badge-success" },
  rejected: { label: "Rejected", cls: "badge-danger" },
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reqLoading, setReqLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"inventory" | "my-requests">("inventory");
  const [showRequestButton, setShowRequestButton] = useState(false);
  const [showAddAssetButton, setShowAddAssetButton] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      const res = await assetsApi.list({ per_page: 100 });
      const list: Asset[] = (res.data as { data?: Asset[] }).data ?? [];
      if (list.length === 0) {
        setError("No assets to export.");
        return;
      }
      const qrBase64: string[] = [];
      for (const asset of list) {
        try {
          const r = await api.get<Blob>(`/assets/${asset.id}/qr`, { responseType: "blob" });
          const b64 = await blobToBase64(r.data);
          qrBase64.push(b64);
        } catch {
          qrBase64.push("");
        }
      }
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("Asset Register", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated ${new Date().toLocaleDateString()} – ${list.length} item(s)`, 14, 22);
      const tableStart = 28;
      const headers = ["Code", "Name", "Category", "Status", "QR"];
      const body = list.map((a) => [
        a.asset_code,
        a.name,
        a.category,
        statusConfig[a.status]?.label ?? a.status,
        "",
      ]);
      autoTable(doc, {
        head: [headers],
        body,
        startY: tableStart,
        didDrawCell: (data: { section: string; column: { index: number }; row: { index: number }; cell?: { width: number; height: number; x: number; y: number } }) => {
          if (data.section === "body" && data.column.index === 4 && data.row.index < qrBase64.length) {
            const img = qrBase64[data.row.index];
            if (img && data.cell) {
              const cell = data.cell;
              const size = Math.min(18, cell.width - 2, cell.height - 2);
              doc.addImage(img, "PNG", cell.x + 2, cell.y + 2, size, size);
            }
          }
        },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 45 },
          2: { cellWidth: 25 },
          3: { cellWidth: 28 },
          4: { cellWidth: 22 },
        },
      });
      doc.save(`assets-register-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setError("Failed to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    setShowRequestButton(!!user);
    setShowAddAssetButton(canManageAssets(user));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    assetsApi
      .list({ per_page: 50 })
      .then((res) => setAssets((res.data as { data?: Asset[] }).data ?? []))
      .catch(() => setError("Failed to load assets."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setReqLoading(true);
    assetRequestsApi
      .list({ per_page: 20 })
      .then((res) => setRequests((res.data as { data?: AssetRequest[] }).data ?? []))
      .catch(() => {})
      .finally(() => setReqLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Assets &amp; Inventory</h1>
          <p className="page-subtitle">View inventory and submit asset requests.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(showAddAssetButton || showRequestButton) && (
            <>
              <Link href="/assets/print" className="btn-secondary" target="_blank" rel="noopener noreferrer">
                <span className="material-symbols-outlined text-[18px]">print</span>
                Print
              </Link>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="btn-secondary"
              >
                {exportingPdf ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                )}
                Export PDF
              </button>
            </>
          )}
          {showAddAssetButton && (
            <>
              <Link href="/assets/categories" className="btn-secondary">
                <span className="material-symbols-outlined text-[18px]">category</span>
                Categories
              </Link>
              <Link href="/assets/add" className="btn-primary">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Asset
              </Link>
            </>
          )}
          {showRequestButton && (
            <Link href="/assets/request" className="btn-primary">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Request Asset
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-neutral-200 pb-2">
        <button
          type="button"
          onClick={() => setView("inventory")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "inventory" ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
        >
          Inventory
        </button>
        <button
          type="button"
          onClick={() => setView("my-requests")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "my-requests" ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
        >
          My Requests ({requests.length})
        </button>
      </div>

      {view === "my-requests" ? (
        <>
          {reqLoading ? (
            <div className="card p-12 text-center">
              <div className="flex items-center justify-center gap-2 text-neutral-400">
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                <span className="text-sm">Loading…</span>
              </div>
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-3">
              {requests.map((req) => {
                const s = requestStatusConfig[req.status] ?? { label: req.status, cls: "badge-muted" };
                return (
                  <div key={req.id} className="card p-5 hover:shadow-elevated transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${s.cls}`}>{s.label}</span>
                          <span className="text-xs text-neutral-400">
                            {req.created_at ? new Date(req.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-700 whitespace-pre-wrap">{req.justification}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
                <span className="material-symbols-outlined text-4xl text-neutral-300">description</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-600">No asset requests yet</p>
              <p className="text-xs text-neutral-400 mt-1">Submit a request with a justification for managers to review.</p>
              <Link href="/assets/request" className="btn-primary mt-5 inline-flex">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Request Asset
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <div className="card p-12 text-center">
              <div className="flex items-center justify-center gap-2 text-neutral-400">
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                <span className="text-sm">Loading…</span>
              </div>
            </div>
          ) : assets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {assets.map((asset) => {
                const s = statusConfig[asset.status] ?? { label: asset.status, cls: "badge-muted" };
                return (
                  <div key={asset.id} className="card p-5 hover:shadow-elevated transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-neutral-400">{asset.asset_code}</span>
                            <span className={`badge ${s.cls}`}>{s.label}</span>
                          </div>
                          <p className="text-sm font-semibold text-neutral-900 mt-0.5 truncate">{asset.name}</p>
                          <p className="text-xs text-neutral-500 mt-1 capitalize">{asset.category}</p>
                          {(asset.current_value != null || asset.value != null) && (
                            <p className="text-xs text-neutral-500 mt-0.5">
                              Book value: {Number(asset.current_value ?? asset.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                          {asset.age_display && (
                            <p className="text-xs text-neutral-500 mt-0.5">Age: {asset.age_display}</p>
                          )}
                        </div>
                      </div>
                      {showAddAssetButton && (
                        <Link
                          href={`/assets/${asset.id}/edit`}
                          className="flex-shrink-0 p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-primary transition-colors"
                          aria-label="Edit asset"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
                <span className="material-symbols-outlined text-4xl text-neutral-300">inventory_2</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-600">No assets in inventory</p>
              <p className="text-xs text-neutral-400 mt-1">You can still request an asset; managers will process requests.</p>
              {showRequestButton && (
                <Link href="/assets/request" className="btn-primary mt-5 inline-flex">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Request Asset
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
