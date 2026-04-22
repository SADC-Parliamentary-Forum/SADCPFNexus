"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { bcreApi, type BcreDashboard, type BalanceRegister } from "@/lib/api";

function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

const MODULE_LABELS: Record<string, string> = {
  salary_advance: "Salary Advance",
  imprest:        "Imprest",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active:   { label: "Active",   badge: "badge-success" },
  closed:   { label: "Closed",   badge: "badge-muted" },
  disputed: { label: "Disputed", badge: "badge-danger" },
  locked:   { label: "Locked",   badge: "badge-warning" },
};

function fmt(n: number) {
  return "NAD " + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BcreDashboardPage() {
  const [dashboard, setDashboard] = useState<BcreDashboard | null>(null);
  const [recentSA, setRecentSA]   = useState<BalanceRegister[]>([]);
  const [recentIMP, setRecentIMP] = useState<BalanceRegister[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      bcreApi.dashboard(),
      bcreApi.list({ module_type: "salary_advance", per_page: 5 }),
      bcreApi.list({ module_type: "imprest", per_page: 5 }),
    ])
      .then(([dashRes, saRes, impRes]) => {
        const d = (dashRes.data as any).data ?? dashRes.data;
        setDashboard(d);
        setRecentSA(getListData<BalanceRegister>(saRes.data));
        setRecentIMP(getListData<BalanceRegister>(impRes.data));
      })
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Balance Control & Reconciliation</h1>
          <p className="page-subtitle">Financial truth engine — controlled registers for advances and imprest</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance/balance-register/exceptions" className="btn-secondary text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-base">warning</span>
            Exceptions Queue
          </Link>
          <Link href="/finance/balance-register/registers" className="btn-primary text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-base">list</span>
            All Registers
          </Link>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1">
        <Link href="/finance" className="hover:text-primary">Finance</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">Balance Register</span>
      </nav>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-3 bg-neutral-200 rounded w-2/3 mb-3" />
              <div className="h-8 bg-neutral-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : dashboard ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5">
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Outstanding Balance</p>
              <p className="text-2xl font-bold text-neutral-900">{fmt(dashboard.total_outstanding_balance)}</p>
              <p className="text-xs text-neutral-400 mt-1">across all active registers</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Active Registers</p>
              <p className="text-2xl font-bold text-neutral-900">{dashboard.total_active_registers}</p>
              <p className="text-xs text-neutral-400 mt-1">
                {Object.entries(dashboard.registers_by_module).map(([m, c]) => `${MODULE_LABELS[m] ?? m}: ${c}`).join(" · ")}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Pending Verification</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold text-neutral-900">{dashboard.pending_verifications}</p>
                {dashboard.pending_verifications > 0 && (
                  <span className="badge-warning text-xs px-2 py-0.5 rounded-full">Action required</span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-1">transactions awaiting checker</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Disputed Registers</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold text-neutral-900">{dashboard.disputed_registers}</p>
                {dashboard.disputed_registers > 0 && (
                  <span className="badge-danger text-xs px-2 py-0.5 rounded-full">Needs resolution</span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-1">employee disputes open</p>
            </div>
          </div>

          {/* Module Tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Salary Advance */}
            <div className="card">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">payments</span>
                  <h2 className="font-semibold text-neutral-800">Salary Advance Registers</h2>
                </div>
                <Link href="/finance/balance-register/registers?module_type=salary_advance" className="text-xs text-primary hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-neutral-50">
                {recentSA.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-neutral-400 text-center">No salary advance registers yet.</p>
                ) : recentSA.map(reg => (
                  <Link key={reg.id} href={`/finance/balance-register/${reg.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{reg.reference_number}</p>
                      <p className="text-xs text-neutral-500">{reg.employee?.name ?? `Employee #${reg.employee_id}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-900">NAD {Number(reg.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <span className={`text-xs ${STATUS_CONFIG[reg.status]?.badge ?? "badge-muted"}`}>
                        {STATUS_CONFIG[reg.status]?.label ?? reg.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Imprest */}
            <div className="card">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">account_balance_wallet</span>
                  <h2 className="font-semibold text-neutral-800">Imprest Registers</h2>
                </div>
                <Link href="/finance/balance-register/registers?module_type=imprest" className="text-xs text-primary hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-neutral-50">
                {recentIMP.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-neutral-400 text-center">No imprest registers yet.</p>
                ) : recentIMP.map(reg => (
                  <Link key={reg.id} href={`/finance/balance-register/${reg.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{reg.reference_number}</p>
                      <p className="text-xs text-neutral-500">{reg.employee?.name ?? `Employee #${reg.employee_id}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-900">NAD {Number(reg.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <span className={`text-xs ${STATUS_CONFIG[reg.status]?.badge ?? "badge-muted"}`}>
                        {STATUS_CONFIG[reg.status]?.label ?? reg.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
