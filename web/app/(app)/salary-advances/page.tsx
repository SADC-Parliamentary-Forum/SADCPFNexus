"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { canManageSalaryAdvanceFinance, getStoredUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { formatSaCurrency, SA_STATUS_CONFIG } from "@/components/salary-advance/AdvanceQueueTable";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SalaryAdvanceEmployeeDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFinanceLink, setShowFinanceLink] = useState(false);
  const [summary, setSummary] = useState<{
    eligibility: {
      eligible: boolean;
      reason?: string;
      net_salary: number | null;
      max_eligible: number | null;
      exposure?: { outstanding_balance: number; blocked: boolean; reasons: string[] };
      policy?: { version: string; max_salary_percentage: number; recovery_rule: string };
      intended_recovery_payroll_date?: string;
    };
    current_request: SalaryAdvanceRequest | null;
    active_advance: { id: number; reference_number: string; status: string; amount: number } | null;
    history: SalaryAdvanceRequest[];
  } | null>(null);

  useEffect(() => {
    setShowFinanceLink(canManageSalaryAdvanceFinance(getStoredUser()));
    (async () => {
      try {
        const res = await financeApi.getSalaryAdvanceEmployeeSummary();
        setSummary(res.data.data);
      } catch {
        setError("Failed to load salary advance dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-neutral-100" />)}
      </div>
    );
  }

  const elig = summary?.eligibility;
  const current = summary?.current_request;
  const currentStatus = current ? (SA_STATUS_CONFIG[current.status] ?? { label: current.status, badge: "badge-muted" }) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Salary Advance Dashboard"
        subtitle="Eligibility, active requests, and recent history."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Salary Advances" }]} />}
        actions={
          <>
            {showFinanceLink ? (
              <Link href="/salary-advances/finance" className="btn-secondary text-sm">Finance dashboard</Link>
            ) : null}
            <Link href="/salary-advances/create" className="btn-primary text-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Apply for Salary Advance
            </Link>
          </>
        }
      />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">verified_user</span>
            <h2 className="text-sm font-semibold text-neutral-900">Eligibility</h2>
          </div>
          {elig ? (
            <>
              <p className={`text-sm font-semibold ${elig.eligible ? "text-emerald-700" : "text-amber-700"}`}>
                {elig.eligible ? "You are eligible to apply" : "Application currently blocked"}
              </p>
              <dl className="text-xs text-neutral-600 space-y-1.5">
                <div className="flex justify-between gap-3"><dt>Confirmed net</dt><dd className="font-medium text-neutral-900">{elig.net_salary != null ? formatSaCurrency(elig.net_salary) : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt>Max eligible (50%)</dt><dd className="font-medium text-neutral-900">{elig.max_eligible != null ? formatSaCurrency(elig.max_eligible) : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt>Outstanding</dt><dd className="font-medium text-neutral-900">{formatSaCurrency(elig.exposure?.outstanding_balance ?? 0)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Policy</dt><dd className="font-medium text-neutral-900">{elig.policy?.version ?? "—"} · {elig.policy?.recovery_rule ?? "full_eom"}</dd></div>
                {elig.intended_recovery_payroll_date && (
                  <div className="flex justify-between gap-3"><dt>Recovery payroll</dt><dd className="font-medium text-neutral-900">{formatDate(elig.intended_recovery_payroll_date)}</dd></div>
                )}
              </dl>
              {!elig.eligible && elig.exposure?.reasons?.length ? (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Reasons: {elig.exposure.reasons.join(", ").replaceAll("_", " ")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-neutral-500">Eligibility unavailable.</p>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">pending_actions</span>
            <h2 className="text-sm font-semibold text-neutral-900">Current request</h2>
          </div>
          {current && currentStatus ? (
            <>
              <p className="font-mono text-xs text-neutral-500">{current.reference_number}</p>
              <p className="text-lg font-semibold text-neutral-900">{formatSaCurrency(current.amount, current.currency)}</p>
              <span className={`badge text-xs ${currentStatus.badge}`}>{currentStatus.label}</span>
              <Link href={`/salary-advances/${current.id}`} className="text-xs font-medium text-primary hover:underline inline-block">
                Open request →
              </Link>
            </>
          ) : (
            <p className="text-sm text-neutral-500">No open request. You can apply if eligible.</p>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
            <h2 className="text-sm font-semibold text-neutral-900">Active advance</h2>
          </div>
          {summary?.active_advance ? (
            <>
              <p className="font-mono text-xs text-neutral-500">{summary.active_advance.reference_number}</p>
              <p className="text-lg font-semibold text-neutral-900">{formatSaCurrency(summary.active_advance.amount)}</p>
              <span className={`badge text-xs ${(SA_STATUS_CONFIG[summary.active_advance.status] ?? { badge: "badge-muted" }).badge}`}>
                {(SA_STATUS_CONFIG[summary.active_advance.status] ?? { label: summary.active_advance.status }).label}
              </span>
              <Link href={`/salary-advances/${summary.active_advance.id}`} className="text-xs font-medium text-primary hover:underline inline-block">
                View advance →
              </Link>
            </>
          ) : (
            <p className="text-sm text-neutral-500">No active advance on your account.</p>
          )}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">Recent history</h2>
          <Link href="/salary-advances/history" className="text-xs font-medium text-primary hover:underline">View all</Link>
        </div>
        {(summary?.history?.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">No closed or recovered advances yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {summary!.history.map((h) => {
              const sc = SA_STATUS_CONFIG[h.status] ?? { label: h.status, badge: "badge-muted" };
              return (
                <li key={h.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-neutral-500">{h.reference_number}</p>
                    <p className="text-sm font-medium text-neutral-900">{formatSaCurrency(h.amount, h.currency)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                    <Link href={`/salary-advances/${h.id}`} className="text-xs font-medium text-primary hover:underline">View</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
