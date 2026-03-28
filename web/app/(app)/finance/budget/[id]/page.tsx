"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { financeApi, type Budget, type BudgetLine } from "@/lib/api";

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(spent: number, allocated: number): number {
  if (allocated <= 0) return 0;
  return Math.min((spent / allocated) * 100, 100);
}

function varianceConfig(line: BudgetLine): { barColor: string; textColor: string; label: string; labelCls: string } {
  const allocated = toNumber(line.amount_allocated);
  const spent = toNumber(line.amount_spent);
  if (allocated > 0 && spent > allocated) {
    return { barColor: "bg-red-500", textColor: "text-red-600", label: "Overspent", labelCls: "bg-red-100 text-red-700" };
  }
  const ratio = allocated > 0 ? spent / allocated : 0;
  if (ratio >= 0.9) {
    return { barColor: "bg-amber-500", textColor: "text-amber-600", label: "Near limit", labelCls: "bg-amber-100 text-amber-700" };
  }
  return { barColor: "bg-green-500", textColor: "text-green-600", label: "Healthy", labelCls: "bg-green-100 text-green-700" };
}

/** Horizontal CSS-only bar chart showing expenditure per budget line */
function ExpenditureChart({ lines, currency }: { lines: BudgetLine[]; currency: string }) {
  const maxSpent = Math.max(...lines.map((l) => toNumber(l.amount_spent)), 1);

  return (
    <div className="space-y-2">
      {lines.map((line) => {
        const spent = toNumber(line.amount_spent);
        const allocated = toNumber(line.amount_allocated);
        const width = (spent / maxSpent) * 100;
        const { barColor } = varianceConfig(line);
        return (
          <div key={line.id} className="flex items-center gap-3">
            <div className="w-32 text-xs text-neutral-600 truncate shrink-0 text-right" title={line.category}>
              {line.category}
            </div>
            <div className="flex-1 h-5 bg-neutral-100 rounded overflow-hidden relative">
              <div
                className={`h-full rounded ${barColor} transition-all`}
                style={{ width: `${width}%` }}
              />
              {allocated > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-neutral-400/60"
                  style={{ left: `${(allocated / (maxSpent === 0 ? 1 : maxSpent)) * 100}%` }}
                  title={`Allocation: ${formatMoney(allocated, currency)}`}
                />
              )}
            </div>
            <div className="w-28 text-xs font-medium text-neutral-700 shrink-0">
              {formatMoney(spent, currency)}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3 pt-1">
        <div className="w-32" />
        <div className="flex-1 flex items-center gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-neutral-400/60" />
            Allocation line
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-green-500" />
            Healthy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-amber-500" />
            Near limit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-red-500" />
            Overspent
          </span>
        </div>
        <div className="w-28 text-xs text-neutral-400">Spent</div>
      </div>
    </div>
  );
}

export default function BudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) {
      router.replace("/finance/budget");
      return;
    }

    setLoading(true);
    setError("");
    financeApi
      .getBudget(id)
      .then((res) => {
        const payload = res.data;
        const item = payload && typeof payload === "object" && "data" in payload ? payload.data : null;
        if (!item) {
          setError("Budget record was not found.");
          setBudget(null);
          return;
        }
        setBudget(item as Budget);
      })
      .catch(() => {
        setError("Failed to load budget details.");
        setBudget(null);
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const lines: BudgetLine[] = useMemo(() => budget?.lines ?? [], [budget]);
  const totalAllocated = useMemo(() => lines.reduce((acc, line) => acc + toNumber(line.amount_allocated), 0), [lines]);
  const totalSpent = useMemo(() => lines.reduce((acc, line) => acc + toNumber(line.amount_spent), 0), [lines]);
  const totalRemaining = useMemo(() => lines.reduce((acc, line) => acc + toNumber(line.amount_remaining), 0), [lines]);
  const overallPct = useMemo(() => pct(totalSpent, totalAllocated), [totalSpent, totalAllocated]);

  const overspentCount = useMemo(
    () => lines.filter((l) => toNumber(l.amount_spent) > toNumber(l.amount_allocated) && toNumber(l.amount_allocated) > 0).length,
    [lines]
  );
  const nearLimitCount = useMemo(
    () => lines.filter((l) => {
      const a = toNumber(l.amount_allocated);
      const s = toNumber(l.amount_spent);
      if (a <= 0) return false;
      const r = s / a;
      return r >= 0.9 && s <= a;
    }).length,
    [lines]
  );

  if (loading) {
    return (
      <div className="max-w-5xl space-y-4 animate-pulse">
        <div className="h-5 w-48 rounded bg-neutral-100" />
        <div className="h-9 w-72 rounded bg-neutral-100" />
        <div className="card h-56" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Budget was not found."}
        </div>
        <Link href="/finance/budget" className="btn-secondary inline-flex">
          Back to Budgets
        </Link>
      </div>
    );
  }

  const budgetPct = pct(totalSpent, toNumber(budget.total_amount));
  const budgetBarColor = budgetPct >= 90 ? "bg-red-500" : budgetPct >= 70 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/finance" className="hover:text-primary transition-colors">Finance</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/finance/budget" className="hover:text-primary transition-colors">Budgets</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{budget.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{budget.name}</h1>
          <p className="page-subtitle">
            {budget.type === "core" ? "Core budget" : "Project budget"} · {budget.year} · {budget.currency}
          </p>
        </div>
        <Link href="/finance/budget" className="btn-secondary">Back to list</Link>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Total budget</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatMoney(toNumber(budget.total_amount), budget.currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Total allocated (lines)</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatMoney(totalAllocated, budget.currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Total spent</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatMoney(totalSpent, budget.currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Remaining</p>
          <p className={`mt-1 text-sm font-bold ${totalRemaining < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatMoney(totalRemaining, budget.currency)}
          </p>
        </div>
      </div>

      {/* Overall utilization bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">data_usage</span>
            <h3 className="text-sm font-semibold text-neutral-900">Overall Budget Utilization</h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {overspentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 font-medium">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                {overspentCount} overspent
              </span>
            )}
            {nearLimitCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-medium">
                <span className="material-symbols-outlined text-[12px]">error_outline</span>
                {nearLimitCount} near limit
              </span>
            )}
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${budgetBarColor}`} style={{ width: `${budgetPct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
          <span>{formatMoney(totalSpent, budget.currency)} spent</span>
          <span className="font-bold">{budgetPct.toFixed(1)}% utilized</span>
          <span>{formatMoney(toNumber(budget.total_amount), budget.currency)} total</span>
        </div>
      </div>

      {/* Expenditure breakdown chart */}
      {lines.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">bar_chart</span>
            <h3 className="text-sm font-semibold text-neutral-900">Expenditure Breakdown</h3>
            <span className="text-xs text-neutral-400 ml-1">(spent vs. allocation)</span>
          </div>
          <ExpenditureChart lines={lines} currency={budget.currency} />
        </div>
      )}

      {/* Variance analysis table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">table_chart</span>
            <h2 className="text-sm font-semibold text-neutral-800">Variance Analysis</h2>
          </div>
          <span className="text-xs text-neutral-500">{lines.length} lines</span>
        </div>
        {lines.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-500">No budget lines available for this budget.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Category</th>
                  <th className="text-left">Account</th>
                  <th className="text-right">Allocated</th>
                  <th className="text-right">Spent</th>
                  <th className="text-right">Remaining</th>
                  <th className="text-center">Utilization</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((line) => {
                  const allocated = toNumber(line.amount_allocated);
                  const spent = toNumber(line.amount_spent);
                  const remaining = toNumber(line.amount_remaining);
                  const usedPct = pct(spent, allocated);
                  const vc = varianceConfig(line);
                  return (
                    <tr key={line.id} className="hover:bg-neutral-50/50">
                      <td>
                        <div className="font-medium text-neutral-900">{line.category}</div>
                        {line.description && (
                          <div className="text-xs text-neutral-400 mt-0.5">{line.description}</div>
                        )}
                      </td>
                      <td className="text-neutral-500 text-xs font-mono">{line.account_code || "—"}</td>
                      <td className="text-right font-medium text-neutral-700">{formatMoney(allocated, budget.currency)}</td>
                      <td className={`text-right font-medium ${vc.textColor}`}>{formatMoney(spent, budget.currency)}</td>
                      <td className={`text-right font-medium ${remaining < 0 ? "text-red-600" : "text-neutral-700"}`}>
                        {remaining < 0 ? `(${formatMoney(Math.abs(remaining), budget.currency)})` : formatMoney(remaining, budget.currency)}
                      </td>
                      <td className="text-center">
                        {allocated > 0 ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${vc.barColor}`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${vc.textColor}`}>{usedPct.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${vc.labelCls}`}>
                          {vc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50/70">
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-neutral-700">Totals</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-neutral-900">{formatMoney(totalAllocated, budget.currency)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-neutral-900">{formatMoney(totalSpent, budget.currency)}</td>
                  <td className={`px-4 py-3 text-right text-sm font-semibold ${totalRemaining < 0 ? "text-red-600" : "text-neutral-900"}`}>
                    {totalRemaining < 0 ? `(${formatMoney(Math.abs(totalRemaining), budget.currency)})` : formatMoney(totalRemaining, budget.currency)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
