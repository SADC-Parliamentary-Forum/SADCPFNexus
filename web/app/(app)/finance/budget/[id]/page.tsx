"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { financeApi, type Budget, type BudgetLine } from "@/lib/api";
import { formatCurrency as formatMoney } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(spent: number, allocated: number): number {
  if (allocated <= 0) return 0;
  return Math.min((spent / allocated) * 100, 100);
}

function varianceConfig(line: BudgetLine): { barColor: string; textColor: string; label: string; labelCls: string } {
  const allocated = toNumber(line.amount_allocated);
  const spent = toNumber(line.amount_spent);
  if (allocated > 0 && spent > allocated) {
    return { barColor: "bg-red-500", textColor: "text-red-600", label: "finance.budget.detail.overspent", labelCls: "bg-red-100 text-red-700" };
  }
  const ratio = allocated > 0 ? spent / allocated : 0;
  if (ratio >= 0.9) {
    return { barColor: "bg-amber-500", textColor: "text-amber-600", label: "finance.budget.detail.nearLimit", labelCls: "bg-amber-100 text-amber-700" };
  }
  return { barColor: "bg-green-500", textColor: "text-green-600", label: "finance.budget.detail.healthy", labelCls: "bg-green-100 text-green-700" };
}

/** Horizontal CSS-only bar chart showing expenditure per budget line */
function ExpenditureChart({ lines, currency }: { lines: BudgetLine[]; currency: string }) {
  const { t } = useI18n();
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
                  title={t("finance.budget.detail.allocationTip", { amount: formatMoney(allocated, currency) })}
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
            {t("finance.budget.detail.allocationLine")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-green-500" />
            {t("finance.budget.detail.healthy")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-amber-500" />
            {t("finance.budget.detail.nearLimit")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-red-500" />
            {t("finance.budget.detail.overspent")}
          </span>
        </div>
        <div className="w-28 text-xs text-neutral-400">{t("finance.budget.detail.spent")}</div>
      </div>
    </div>
  );
}

export default function BudgetDetailPage() {
  const { t } = useI18n();
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
          setError(t("finance.budget.detail.recordNotFound"));
          setBudget(null);
          return;
        }
        setBudget(item as Budget);
      })
      .catch(() => {
        setError(t("finance.budget.detail.loadFailed"));
        setBudget(null);
      })
      .finally(() => setLoading(false));
  }, [id, router, t]);

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
      <div className="w-full min-w-0 space-y-4 animate-pulse">
        <div className="h-5 w-48 rounded bg-neutral-100" />
        <div className="h-9 w-72 rounded bg-neutral-100" />
        <div className="card h-56" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || t("finance.budget.detail.notFound")}
        </div>
        <Link href="/finance/budget" className="btn-secondary inline-flex">
          {t("finance.budget.detail.backToBudgets")}
        </Link>
      </div>
    );
  }

  const budgetPct = pct(totalSpent, toNumber(budget.total_amount));
  const budgetBarColor = budgetPct >= 90 ? "bg-red-500" : budgetPct >= 70 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={budget.name}
        subtitle={`${budget.type === "core" ? t("finance.budget.detail.coreBudget") : t("finance.budget.detail.projectBudget")} · ${budget.year} · ${budget.currency}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.finance", href: "/finance" },
              { label: "finance.budget.budgets", href: "/finance/budget" },
              { label: budget.name },
            ]}
          />
        }
        actions={<Link href="/finance/budget" className="btn-secondary">{t("finance.budget.detail.backToList")}</Link>}
      />

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-neutral-500">{t("finance.budget.detail.totalBudget")}</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatMoney(toNumber(budget.total_amount), budget.currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">{t("finance.budget.detail.totalAllocated")}</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatMoney(totalAllocated, budget.currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">{t("finance.budget.detail.totalSpent")}</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatMoney(totalSpent, budget.currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">{t("finance.budget.detail.remaining")}</p>
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
            <h3 className="text-sm font-semibold text-neutral-900">{t("finance.budget.detail.overall")}</h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {overspentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 font-medium">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                {t("finance.budget.detail.overspentCount", { count: overspentCount })}
              </span>
            )}
            {nearLimitCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-medium">
                <span className="material-symbols-outlined text-[12px]">error_outline</span>
                {t("finance.budget.detail.nearLimitCount", { count: nearLimitCount })}
              </span>
            )}
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${budgetBarColor}`} style={{ width: `${budgetPct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
          <span>{t("finance.budget.detail.amountSpent", { amount: formatMoney(totalSpent, budget.currency) })}</span>
          <span className="font-bold">{t("finance.budget.detail.utilized", { pct: budgetPct.toFixed(1) })}</span>
          <span>{t("finance.budget.detail.amountTotal", { amount: formatMoney(toNumber(budget.total_amount), budget.currency) })}</span>
        </div>
      </div>

      {/* Expenditure breakdown chart */}
      {lines.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">bar_chart</span>
            <h3 className="text-sm font-semibold text-neutral-900">{t("finance.budget.detail.breakdown")}</h3>
            <span className="text-xs text-neutral-400 ml-1">{t("finance.budget.detail.breakdownHint")}</span>
          </div>
          <ExpenditureChart lines={lines} currency={budget.currency} />
        </div>
      )}

      {/* Variance analysis table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">table_chart</span>
            <h2 className="text-sm font-semibold text-neutral-800">{t("finance.budget.detail.variance")}</h2>
          </div>
          <span className="text-xs text-neutral-500">{t("finance.budget.detail.linesCount", { count: lines.length })}</span>
        </div>
        {lines.length === 0 ? (
          <EmptyState icon="table_chart" title="finance.budget.detail.noLines" className="py-10 min-h-0" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left">{t("finance.budget.detail.col.category")}</th>
                  <th className="text-left">{t("finance.budget.detail.col.account")}</th>
                  <th className="text-right">{t("finance.budget.detail.col.allocated")}</th>
                  <th className="text-right">{t("finance.budget.detail.spent")}</th>
                  <th className="text-right">{t("finance.budget.detail.remaining")}</th>
                  <th className="text-center">{t("finance.budget.detail.col.utilization")}</th>
                  <th className="text-center">{t("finance.budget.col.status")}</th>
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
                          {t(vc.label)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50/70">
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-neutral-700">{t("finance.budget.detail.totals")}</td>
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
