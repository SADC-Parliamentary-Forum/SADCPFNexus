"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { financeApi, type SalaryAdvanceRequest, type Payslip, type FinanceSummary, type Budget } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

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

function BudgetBar({ budget }: { budget: Budget }) {
  const total = Number(budget.total_amount) || 0;
  // Compute spent from lines if available, otherwise show 0
  const spent = budget.lines
    ? budget.lines.reduce((acc, l) => acc + Number(l.amount_spent), 0)
    : 0;
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;

  let barColor = "bg-green-500";
  let pctColor = "text-green-600";
  if (pct >= 90) { barColor = "bg-red-500"; pctColor = "text-red-600"; }
  else if (pct >= 70) { barColor = "bg-amber-500"; pctColor = "text-amber-600"; }

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${budget.type === "core" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
              {budget.type}
            </span>
            <span className="text-sm font-medium text-neutral-900 truncate">{budget.name}</span>
            <span className="text-xs text-neutral-400">{budget.year}</span>
          </div>
          <div className="flex items-center gap-3 text-xs ml-4 shrink-0">
            <span className="text-neutral-500">
              {budget.currency} {spent.toLocaleString()} / {total.toLocaleString()}
            </span>
            <span className={`font-bold ${pctColor}`}>{pct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <Link
        href={`/finance/budget/${budget.id}`}
        className="shrink-0 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
      </Link>
    </div>
  );
}

export default function FinancePage() {
  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detect admin/finance roles for conditional quick actions
  const user = typeof window !== "undefined" ? getStoredUser() : null;
  const isAdminOrFinance = user?.roles?.some((r: string) =>
    ["admin", "finance", "system_admin", "Finance Controller"].includes(r)
  ) ?? false;

  useEffect(() => {
    Promise.all([
      financeApi.listAdvances(),
      financeApi.listPayslips({ per_page: 5 }),
      financeApi.getSummary(),
    ])
      .then(([advRes, payslipRes, summaryRes]) => {
        setAdvances(getListData<SalaryAdvanceRequest>(advRes.data));
        setPayslips(getListData<Payslip>(payslipRes.data));
        setSummary(summaryRes.data);
      })
      .catch(() => setError("Failed to load finance data."))
      .finally(() => setLoading(false));

    financeApi.listBudgets({ per_page: 10 })
      .then((res) => setBudgets(getListData<Budget>(res.data)))
      .catch(() => {/* budgets optional */})
      .finally(() => setBudgetsLoading(false));
  }, []);

  const pendingCount = advances.filter((a) => a.status === "submitted" || a.status === "draft").length;
  const currency = summary?.currency ?? "NAD";
  const netStr = summary?.current_net_salary != null ? `${currency} ${Number(summary.current_net_salary).toLocaleString()}` : "—";
  const ytdStr = summary?.ytd_gross != null ? `${currency} ${Number(summary.ytd_gross).toLocaleString()}` : "—";

  const quickActions = [
    {
      label: "New Salary Advance",
      icon: "account_balance",
      href: "/finance/advances/create",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    {
      label: "View Budgets",
      icon: "pie_chart",
      href: "/finance/budget",
      color: "text-primary",
      bg: "bg-primary/5",
      border: "border-primary/20",
    },
    {
      label: "View Payslips",
      icon: "receipt_long",
      href: "/finance/payslips",
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    {
      label: "Imprest Requests",
      icon: "account_balance_wallet",
      href: "/imprest",
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-200",
    },
    ...(isAdminOrFinance
      ? [{
          label: "Upload Payslip",
          icon: "upload_file",
          href: "/admin/payslips",
          color: "text-neutral-600",
          bg: "bg-neutral-50",
          border: "border-neutral-200",
        }]
      : []),
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Finance</h1>
        <p className="page-subtitle">View your payslips, manage salary advances, and track budget utilization.</p>
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

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-neutral-400 text-[18px]">bolt</span>
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`flex flex-col items-center gap-2 rounded-xl border ${action.border} ${action.bg} px-3 py-4 text-center transition-all hover:shadow-sm hover:scale-[1.02]`}
            >
              <div className={`h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm`}>
                <span className={`material-symbols-outlined ${action.color} text-[20px]`}>{action.icon}</span>
              </div>
              <span className="text-xs font-medium text-neutral-700 leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Budget Utilization */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">pie_chart</span>
            <h3 className="text-sm font-semibold text-neutral-900">Budget Utilization</h3>
          </div>
          <Link href="/finance/budget" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
            Manage budgets
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
        {budgetsLoading ? (
          <div className="px-5 py-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-48 rounded bg-neutral-100" />
                  <div className="h-4 w-20 rounded bg-neutral-100" />
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : budgets.length > 0 ? (
          <div className="px-5 divide-y divide-neutral-50">
            {budgets.map((b) => (
              <BudgetBar key={b.id} budget={b} />
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">pie_chart</span>
            <p className="mt-3 text-sm text-neutral-400">No budgets configured yet.</p>
            <Link href="/finance/budget/upload" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <span className="material-symbols-outlined text-[14px]">upload_file</span>
              Upload a budget
            </Link>
          </div>
        )}
        {budgets.length > 0 && (
          <div className="px-5 py-3 border-t border-neutral-100 flex items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-green-500 inline-block" /> Healthy (&lt;70%)</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-amber-500 inline-block" /> Near limit (70–90%)</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-red-500 inline-block" /> Critical (&gt;90%)</span>
          </div>
        )}
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
                <div className="flex items-center gap-3">
                  <Link href={`/finance/payslips/${p.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-700">
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    View
                  </Link>
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
