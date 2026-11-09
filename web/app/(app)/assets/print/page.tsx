"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { assetCategoriesApi, assetsApi, type Asset, type AssetCategory } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import {
  chunkIds,
  collectPaginatedRows,
  parsePrintAssetIds,
  parsePrintListFilters,
  qrImagesFromBatch,
} from "@/lib/asset-register-print";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, string> = {
  pending: "assets.print.status.pending",
  active: "assets.print.status.active",
  assigned: "assets.print.status.assigned",
  available: "assets.print.status.available",
  service_due: "assets.print.status.service_due",
  loan_out: "assets.print.status.loan_out",
  retired: "assets.print.status.retired",
};

export default function AssetsPrintPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [qrBlobs, setQrBlobs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<AssetCategory[]>([]);
  const categoryLabel = (code?: string | null) => categoryRows.find((c) => c.code === code)?.name ?? code ?? "—";
  const printRef = useRef<HTMLDivElement>(null);
  const { t, localeTag } = useI18n();

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    assetCategoriesApi.list().then((r) => setCategoryRows(r.data.data ?? [])).catch(() => setCategoryRows([]));
    const wanted = parsePrintAssetIds(window.location.search);
    const filters = parsePrintListFilters(window.location.search);
    collectPaginatedRows((page) =>
      assetsApi.list({
        per_page: 100,
        page,
        ...(wanted.length === 0
          ? {
              status: filters.status,
              category: filters.category,
              search: filters.search,
            }
          : {}),
      }).then((res) => ({
        data: (res.data as { data?: Asset[]; last_page?: number }).data ?? [],
        last_page: (res.data as { last_page?: number }).last_page,
      })),
    )
      .then((data) => {
        const want = new Set(wanted);
        return want.size > 0 ? data.filter((asset) => want.has(asset.id)) : data;
      })
      .then(async (list) => {
        setAssets(list);
        const images: Record<number, string> = {};
        for (const chunk of chunkIds(list.map((asset) => asset.id))) {
          try {
            const res = await assetsApi.qrBatch(chunk);
            Object.assign(images, qrImagesFromBatch(res.data.data ?? []));
          } catch {
            // Keep any images already loaded if a later chunk fails.
          }
        }
        return images;
      })
      .then((images) => {
        setQrBlobs(images);
      })
      .catch(() => setError(t("assets.print.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-8 w-full min-w-0">
        <div className="flex items-center gap-2 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          <span className="text-sm">{t("assets.print.loading")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 w-full min-w-0">
        <p className="text-red-600">{error}</p>
        <Link href="/assets" className="text-primary mt-2 inline-block">{t("assets.print.back")}</Link>
      </div>
    );
  }

  return (
    <>
      <div className="no-print p-8 w-full min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/assets" className="text-sm text-neutral-500 hover:text-primary">{t("assets.print.backArrow")}</Link>
            <h1 className="text-xl font-bold text-neutral-900 mt-1">{t("assets.print.title")}</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {t("assets.print.summary", { count: assets.length })}
            </p>
          </div>
          <button type="button" onClick={handlePrint} className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">print</span>
            {t("common.print")}
          </button>
        </div>
      </div>

      <div ref={printRef} className="print-only p-8 w-full min-w-0">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">{t("assets.print.register")}</h2>
        <p className="text-sm text-neutral-500 mb-4">
          {t("assets.print.generated", { date: new Date().toLocaleDateString(localeTag), count: assets.length })}
        </p>
        <table className="register-print-table w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-2 pr-3 font-semibold text-neutral-700">{t("assets.print.code")}</th>
              <th className="text-left py-2 pr-3 font-semibold text-neutral-700">{t("assets.print.name")}</th>
              <th className="text-left py-2 pr-3 font-semibold text-neutral-700">{t("assets.print.category")}</th>
              <th className="text-left py-2 pr-3 font-semibold text-neutral-700">{t("assets.print.status")}</th>
              <th className="text-left py-2 font-semibold text-neutral-700">{t("assets.print.assignedTo")}</th>
              <th className="text-left py-2 font-semibold text-neutral-700 w-[12mm]">QR</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} className="border-b border-neutral-100">
                <td className="py-2 pr-3 font-mono text-neutral-700">{asset.asset_code}</td>
                <td className="py-2 pr-3 text-neutral-900">{asset.name}</td>
                <td className="py-2 pr-3 text-neutral-700">{categoryLabel(asset.category)}</td>
                <td className="py-2 pr-3 text-neutral-700">{statusConfig[asset.status] ? t(statusConfig[asset.status]) : asset.status}</td>
                <td className="py-2 pr-3 text-neutral-700">{asset.assigned_user?.name ?? "—"}</td>
                <td className="py-2">
                  {qrBlobs[asset.id] ? (
                    <img src={qrBlobs[asset.id]} alt="" className="h-12 w-12 object-contain" />
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        Intentionally NOT using the shared PrintButton (web/components/ui/PrintButton.tsx) print
        mechanism here. PrintButton hides layout chrome (header/nav/aside/buttons) around a single
        shared content tree. This page instead renders two structurally different views — an
        interactive on-screen summary and a separate print-formatted table (with QR images, a
        generated timestamp, and print-only pagination-friendly markup) — and swaps between them
        via visibility toggling. The visibility-hidden approach is required to fully suppress the
        on-screen view (including elements outside any single "main" container) while revealing
        only the dedicated print block.
      */}
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        .register-print-table {
          table-layout: fixed;
          width: 100%;
        }
        .register-print-table th,
        .register-print-table td {
          overflow: hidden;
          word-wrap: break-word;
          /* Full grid so rows (and their QR codes) can be cut apart cleanly. */
          border: 1px solid #9ca3af;
          padding-left: 6px;
          padding-right: 6px;
        }
        .register-print-table tr {
          break-inside: avoid;
        }
        @media print {
          body * { visibility: hidden; }
          .print-only,
          .print-only * { visibility: visible; }
          .print-only { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  );
}
