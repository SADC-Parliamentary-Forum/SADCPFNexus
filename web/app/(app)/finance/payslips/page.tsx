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
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <Link href="/finance" className="hover:text-primary transition-colors">Finance</Link>
          <span>/</span>
          <span className="text-neutral-700 font-medium">Payslips</span>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Payslips</h2>
        <p className="text-sm text-neutral-500 mt-0.5">View and download your payslip history.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white border border-neutral-100 shadow-card px-5 py-12 text-center text-sm text-neutral-500">Loading…</div>
      ) : payslips.length === 0 ? (
        <div className="rounded-xl bg-white border border-neutral-100 shadow-card px-5 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-neutral-300">description</span>
          <p className="mt-3 text-sm text-neutral-500">No payslips yet.</p>
          <Link href="/finance" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Back to Finance</Link>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-neutral-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500">Period</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500">Gross</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500">Net</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500">Currency</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/50">
                    <td className="px-5 py-3 font-medium text-neutral-900">{formatPeriod(p)}</td>
                    <td className="px-5 py-3 text-right text-neutral-700">{Number(p.gross_amount).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-neutral-700">{Number(p.net_amount).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{p.currency}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownload(p)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Finance
        </Link>
      </div>
    </div>
  );
}
