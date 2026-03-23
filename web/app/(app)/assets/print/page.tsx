"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { assetsApi, type Asset } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

const statusConfig: Record<string, string> = {
  active: "Active",
  service_due: "Service Due",
  loan_out: "Loan Out",
  retired: "Retired",
};

export default function AssetsPrintPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [qrBlobs, setQrBlobs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    assetsApi
      .list({ per_page: 100 })
      .then((res) => {
        const data = (res.data as { data?: Asset[] }).data ?? [];
        setAssets(data);
        return data;
      })
      .then((list) => {
        const blobs: Record<number, string> = {};
        const promises = list
          .filter((a) => a.qr_url || a.id)
          .map((asset) =>
            api
              .get<Blob>(`/assets/${asset.id}/qr`, { responseType: "blob" })
              .then((r) => {
                const url = URL.createObjectURL(r.data);
                blobs[asset.id] = url;
              })
              .catch(() => {})
          );
        return Promise.all(promises).then(() => blobs);
      })
      .then((blobs) => {
        setQrBlobs(blobs);
      })
      .catch(() => setError("Failed to load assets."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      Object.values(qrBlobs).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [qrBlobs]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          <span className="text-sm">Loading assets…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <p className="text-red-600">{error}</p>
        <Link href="/assets" className="text-primary mt-2 inline-block">Back to Assets</Link>
      </div>
    );
  }

  return (
    <>
      <div className="no-print p-8 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/assets" className="text-sm text-neutral-500 hover:text-primary">← Back to Assets</Link>
            <h1 className="text-xl font-bold text-neutral-900 mt-1">Asset Register – Print View</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {assets.length} asset(s). Click Print to print or save as PDF.
            </p>
          </div>
          <button type="button" onClick={handlePrint} className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print
          </button>
        </div>
      </div>

      <div ref={printRef} className="print-only p-8 max-w-5xl mx-auto">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">Asset Register</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Generated {new Date().toLocaleDateString()} – {assets.length} item(s)
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-2 pr-4 font-semibold text-neutral-700">Code</th>
              <th className="text-left py-2 pr-4 font-semibold text-neutral-700">Name</th>
              <th className="text-left py-2 pr-4 font-semibold text-neutral-700">Category</th>
              <th className="text-left py-2 pr-4 font-semibold text-neutral-700">Status</th>
              <th className="text-left py-2 pr-4 font-semibold text-neutral-700 w-20">QR</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-neutral-700">{asset.asset_code}</td>
                <td className="py-2 pr-4 text-neutral-900">{asset.name}</td>
                <td className="py-2 pr-4 capitalize text-neutral-700">{asset.category}</td>
                <td className="py-2 pr-4 text-neutral-700">{statusConfig[asset.status] ?? asset.status}</td>
                <td className="py-2 pr-4">
                  {qrBlobs[asset.id] ? (
                    <img src={qrBlobs[asset.id]} alt="" className="h-14 w-14 object-contain" />
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-only,
          .print-only * { visibility: visible; }
          .print-only { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  );
}
