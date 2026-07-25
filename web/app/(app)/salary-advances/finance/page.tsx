"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { financeApi } from "@/lib/api";
import { formatSaCurrency } from "@/components/salary-advance/AdvanceQueueTable";

const QUEUE_CARDS = [
  { key: "certify", label: "Pending certification", href: "/salary-advances/queues/certify", icon: "verified" },
  { key: "pending_approval", label: "Pending approval", href: "/salary-advances/pending-approval", icon: "fact_check" },
  { key: "payment", label: "Payment queue", href: "/salary-advances/queues/payment", icon: "account_balance" },
  { key: "recovery", label: "Recovery queue", href: "/salary-advances/queues/recovery", icon: "event_repeat" },
  { key: "reconciliation", label: "Reconciliation", href: "/salary-advances/reconciliation", icon: "compare_arrows" },
  { key: "outstanding", label: "Outstanding", href: "/salary-advances/outstanding", icon: "pending" },
] as const;

export default function SalaryAdvanceFinanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    queues: Record<string, number>;
    exposure: { total_outstanding_balance: number; outstanding_count: number };
    by_status: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await financeApi.getSalaryAdvanceDashboard();
        setData(res.data.data);
      } catch {
        setError("Failed to load finance salary advance dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
            <Link href="/salary-advances" className="hover:text-neutral-700">Salary Advances</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Finance</span>
          </div>
          <h1 className="page-title">Salary Advance Finance Dashboard</h1>
          <p className="page-subtitle">Queue volumes, outstanding exposure, and status mix.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/salary-advances/register" className="btn-secondary py-2 px-4 text-sm">Register</Link>
          <Link href="/salary-advances/reports" className="btn-secondary py-2 px-4 text-sm">Reports</Link>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">Total outstanding exposure</p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">
                {formatSaCurrency(data.exposure.total_outstanding_balance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">Open registers with balance</p>
              <p className="text-xl font-semibold text-neutral-900">{data.exposure.outstanding_count}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {QUEUE_CARDS.map((card) => (
              <Link key={card.key} href={card.href} className="card p-5 hover:border-primary/40 transition-colors group">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary">{card.icon}</span>
                  <h2 className="text-sm font-semibold text-neutral-900 group-hover:text-primary">{card.label}</h2>
                </div>
                <p className="text-3xl font-semibold text-neutral-900">{data.queues[card.key] ?? 0}</p>
              </Link>
            ))}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Applications by status</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.by_status).map(([status, count]) => (
                <span key={status} className="inline-flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-1.5 text-xs">
                  <span className="text-neutral-600 capitalize">{status.replaceAll("_", " ")}</span>
                  <span className="font-semibold text-neutral-900">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
