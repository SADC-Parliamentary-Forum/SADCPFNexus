"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect } from "react";
import Link from "next/link";
import { financeApi, type SalaryAdvanceRequest, type Payslip, type FinanceSummary, type Budget } from "@/lib/api";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { FINANCE_HUB_CARDS } from "@/lib/hubs/finance";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { TranslateVars } from "@/lib/i18n/messages";

type Translate = (key: string, vars?: TranslateVars) => string;

function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  paid:      { label: "finance.hub.status.paid",      cls: "badge-success" },
  pending:   { label: "finance.hub.status.pending",   cls: "badge-warning" },
  approved:  { label: "status.approved",  cls: "badge-success" },
  submitted: { label: "status.submitted", cls: "badge-warning" },
  rejected:  { label: "status.rejected",  cls: "badge-danger"  },
  draft:     { label: "status.draft",     cls: "badge-muted"   },
};

function formatPeriod(p: Payslip, t: Translate): string {
  const month = p.period_month >= 1 && p.period_month <= 12 ? t(`finance.monthShort.${p.period_month}`) : p.period_month;
  return `${month} ${p.period_year}`;
}

function safeIsoDay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function BudgetBar({ budget }: { budget: Budget }) {
  const { t } = useI18n();
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
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${budget.type === "core" ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300"}`}>
              {budget.type === "core" || budget.type === "project" ? t(`finance.budgetType.${budget.type}`) : budget.type}
            </span>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{budget.name}</span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">{budget.year}</span>
          </div>
          <div className="flex items-center gap-3 text-xs ml-4 shrink-0">
            <span className="text-neutral-500 dark:text-neutral-400">
              {budget.currency} {spent.toLocaleString()} / {total.toLocaleString()}
            </span>
            <span className={`font-bold ${pctColor}`}>{pct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-700/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <Link
        href={`/finance/budget/${budget.id}`}
        aria-label={t("finance.hub.openBudget", { name: budget.name })}
        className="shrink-0 inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
      </Link>
    </div>
  );
}

export default function FinancePage() {
  const { error: toastError } = useToast();
  const { t } = useI18n();
  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .catch(() => setError(t("finance.hub.loadFailed")))
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

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="nav.finance"
        subtitle="finance.hub.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.finance" }]} />}
      />

      <ModuleHubCards cards={FINANCE_HUB_CARDS} />

      {error && <ErrorBanner message={error} />}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t("finance.hub.netSalary"), value: netStr,          icon: "payments",         color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20"  },
          { label: t("finance.hub.pendingAdvances"),   value: String(pendingCount), icon: "account_balance",  color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20"  },
          { label: t("finance.hub.ytdGross"),          value: ytdStr,           icon: "bar_chart",        color: "text-primary",   bg: "bg-primary/10"},
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.label}</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {loading ? <span className="inline-block h-6 w-24 animate-pulse rounded bg-neutral-100 dark:bg-neutral-700/40" /> : s.value}
                </p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.color} text-[22px]`}>{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget Utilization */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 dark:text-neutral-500 text-[18px]">pie_chart</span>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("finance.hub.budgetUtilization")}</h3>
          </div>
          <Link href="/finance/budget" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
            {t("finance.hub.manageBudgets")}
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
        {budgetsLoading ? (
          <div className="px-5 py-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-48 rounded bg-neutral-100 dark:bg-neutral-700/40" />
                  <div className="h-4 w-20 rounded bg-neutral-100 dark:bg-neutral-700/40" />
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-700/40" />
              </div>
            ))}
          </div>
        ) : budgets.length > 0 ? (
          <div className="px-5 divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {budgets.map((b) => (
              <BudgetBar key={b.id} budget={b} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="pie_chart"
            title="finance.hub.noBudgets"
            action={
              <Link href="/finance/budget/upload" className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">upload_file</span>
                {t("finance.hub.uploadBudget")}
              </Link>
            }
          />
        )}
        {budgets.length > 0 && (
          <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-700/50 flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-green-500 inline-block" /> {t("finance.hub.legend.healthy")}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-amber-500 inline-block" /> {t("finance.hub.legend.near")}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-red-500 inline-block" /> {t("finance.hub.legend.critical")}</span>
          </div>
        )}
      </div>

      {/* Payslips */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 dark:text-neutral-500 text-[18px]">description</span>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("finance.hub.payslips")}</h3>
          </div>
          <Link href="/finance/payslips" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
            {t("common.viewAll")}
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">{t("common.loading")}</div>
        ) : payslips.length > 0 ? (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {payslips.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{formatPeriod(p, t)}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{t("finance.hub.net", { amount: `${p.currency} ${Number(p.net_amount).toLocaleString()}` })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/finance/payslips/${p.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    {t("finance.hub.view")}
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
                        toastError(t("finance.hub.payslipUnavailable"));
                      }
                    }}
                    className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    {t("common.download")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="description" title="finance.hub.noPayslips" />
        )}
      </div>

      {/* Salary Advances */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 dark:text-neutral-500 text-[18px]">account_balance</span>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("nav.salary_advances")}</h3>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/salary-advances" className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">{t("common.viewAll")}</Link>
            <Link href="/salary-advances/create" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
              <span className="material-symbols-outlined text-[14px]">add</span>
              {t("finance.hub.requestAdvance")}
            </Link>
          </div>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">{t("common.loading")}</div>
        ) : (
          <div className="divide-y divide-neutral-50 dark:divide-neutral-700/50">
            {advances.map((adv) => {
              const s = statusConfig[adv.status] ?? { label: adv.status, cls: "badge-muted" };
              const requestedDate = adv.submitted_at ?? (adv as { created_at?: string }).created_at ?? "";
              return (
                <div key={adv.id} className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">account_balance</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{adv.purpose}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">{adv.reference_number}{safeIsoDay(requestedDate) ? ` · ${safeIsoDay(requestedDate)}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{adv.currency} {adv.amount.toLocaleString()}</p>
                    <span className={`badge ${s.cls}`}>{statusConfig[adv.status] ? t(s.label) : s.label}</span>
                  </div>
                </div>
              );
            })}
            {advances.length === 0 && (
              <EmptyState icon="account_balance" title="finance.hub.noAdvances" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
