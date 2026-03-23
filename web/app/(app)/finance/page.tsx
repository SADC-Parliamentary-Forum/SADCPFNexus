"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { financeApi, type SalaryAdvanceRequest, type Payslip, type FinanceSummary } from "@/lib/api";

const statusConfig: Record<string, { label: string; cls: string }> = {
  paid:      { label: "Paid",      cls: "badge-success" },
  pending:   { label: "Pending",   cls: "badge-warning" },
  approved:  { label: "Approved",  cls: "badge-success" },
  submitted: { label: "Submitted", cls: "badge-warning" },
  rejected:  { label: "Rejected",  cls: "badge-danger"  },
  draft:     { label: "Draft",     cls: "badge-muted"   },
};

function formatPeriod(p: Payslip): string {
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[p.period_month] ?? p.period_month} ${p.period_year}`;
}

export default function FinancePage() {
  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      financeApi.listAdvances(),
      financeApi.listPayslips({ per_page: 5 }),
      financeApi.getSummary(),
    ])
      .then(([advRes, payslipRes, summaryRes]) => {
        setAdvances(advRes.data.data ?? []);
        setPayslips(payslipRes.data.data ?? []);
        setSummary(summaryRes.data);
      })
      .catch(() => setError("Failed to load finance data."))
      .finally(() => setLoading(false));
  }, []);

  const pendingCount = advances.filter((a) => a.status === "submitted" || a.status === "draft").length;
  const currency = summary?.currency ?? "NAD";
  const netStr = summary?.current_net_salary != null ? `${currency} ${Number(summary.current_net_salary).toLocaleString()}` : "—";
  const ytdStr = summary?.ytd_gross != null ? `${currency} ${Number(summary.ytd_gross).toLocaleString()}` : "—";

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Finance</h1>
        <p className="page-subtitle">View your payslips and manage salary advance requests.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Current Net Salary", value: netStr,          icon: "payments",         color: "text-green-600", bg: "bg-green-50"  },
          { label: "Pending Advances",   value: String(pendingCount), icon: "account_balance",  color: "text-amber-600", bg: "bg-amber-50"  },
          { label: "YTD Gross",          value: ytdStr,           icon: "bar_chart",        color: "text-primary",   bg: "bg-primary/10"},
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{s.label}</p>
                <p className="text-xl font-bold text-neutral-900 mt-1">
                  {loading ? <span className="inline-block h-6 w-24 animate-pulse rounded bg-neutral-100" /> : s.value}
                </p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.color} text-[22px]`}>{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payslips */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">description</span>
            <h3 className="text-sm font-semibold text-neutral-900">Payslips</h3>
          </div>
          <Link href="/finance/payslips" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
            View all
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">Loading…</div>
        ) : payslips.length > 0 ? (
          <div className="divide-y divide-neutral-50">
            {payslips.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{formatPeriod(p)}</p>
                    <p className="text-xs text-neutral-400">Net: {p.currency} {Number(p.net_amount).toLocaleString()}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await financeApi.downloadPayslip(p.id);
                      const url = window.URL.createObjectURL(res.data);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `payslip-${p.period_year}-${String(p.period_month).padStart(2, "0")}.pdf`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } catch {
                      // no file
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">description</span>
            <p className="mt-3 text-sm text-neutral-400">No payslips available yet.</p>
          </div>
        )}
      </div>

      {/* Salary Advances */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">account_balance</span>
            <h3 className="text-sm font-semibold text-neutral-900">Salary Advances</h3>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/finance/advances" className="text-xs font-medium text-neutral-500 hover:text-neutral-700">View all</Link>
            <Link href="/finance/advances/create" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
              <span className="material-symbols-outlined text-[14px]">add</span>
              Request Advance
            </Link>
          </div>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">Loading…</div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {advances.map((adv) => {
              const s = statusConfig[adv.status] ?? { label: adv.status, cls: "badge-muted" };
              const requestedDate = adv.submitted_at ?? (adv as { created_at?: string }).created_at ?? "";
              return (
                <div key={adv.id} className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-600 text-[20px]">account_balance</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{adv.purpose}</p>
                      <p className="text-xs text-neutral-400 font-mono">{adv.reference_number}{requestedDate ? ` · ${new Date(requestedDate).toISOString().slice(0, 10)}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-neutral-900">{adv.currency} {adv.amount.toLocaleString()}</p>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                  </div>
                </div>
              );
            })}
            {advances.length === 0 && (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-4xl text-neutral-200">account_balance</span>
                <p className="mt-3 text-sm text-neutral-400">No salary advance requests.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
