"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { financeApi, type Payslip } from "@/lib/api";

function formatPeriod(p: Payslip): string {
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[p.period_month] ?? p.period_month} ${p.period_year}`;
}

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    financeApi.listPayslips({ per_page: 50 })
      .then((res) => setPayslips((res.data as any).data ?? []))
      .catch(() => setError("Failed to load payslips."))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (p: Payslip) => {
    try {
      const res = await financeApi.downloadPayslip(p.id);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${p.period_year}-${String(p.period_month).padStart(2, "0")}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // No file available
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/finance" className="hover:text-primary transition-colors">Finance</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Payslips</span>
      </div>

      <div>
        <h1 className="page-title">Payslips</h1>
        <p className="page-subtitle">View and download your payslip history.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {loading ? (
        <div className="card divide-y divide-neutral-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-neutral-100" />
                <div>
                  <div className="h-3 w-24 bg-neutral-100 rounded mb-1.5" />
                  <div className="h-2.5 w-32 bg-neutral-100 rounded" />
                </div>
              </div>
              <div className="h-3 w-16 bg-neutral-100 rounded" />
            </div>
          ))}
        </div>
      ) : payslips.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-neutral-300">description</span>
          <p className="mt-3 text-sm text-neutral-500">No payslips available yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-neutral-400 text-[18px]">description</span>
              <h3 className="text-sm font-semibold text-neutral-900">Payslip History</h3>
            </div>
            <span className="text-xs text-neutral-400">{payslips.length} records</span>
          </div>
          <div className="divide-y divide-neutral-50">
            {payslips.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{formatPeriod(p)}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Gross: {p.currency} {Number(p.gross_amount).toLocaleString()} &nbsp;·&nbsp; Net: {p.currency} {Number(p.net_amount).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(p)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
