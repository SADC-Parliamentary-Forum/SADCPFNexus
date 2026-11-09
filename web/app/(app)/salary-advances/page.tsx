"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { canManageSalaryAdvanceFinance, getStoredUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { formatSaCurrency, SA_STATUS_CONFIG } from "@/components/salary-advance/AdvanceQueueTable";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { SALARY_ADVANCE_HUB_CARDS } from "@/lib/hubs/salaryAdvances";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function SalaryAdvanceEmployeeDashboardPage() {
  const { t } = useI18n();
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
        setError(t("salaryAdvances.dashboard.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elig = summary?.eligibility;
  const current = summary?.current_request;
  const currentStatus = current ? (SA_STATUS_CONFIG[current.status] ?? { label: current.status, badge: "badge-muted" }) : null;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("salaryAdvances.dashboard.title")}
        subtitle={t("salaryAdvances.dashboard.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.salary_advances") }]} />}
        actions={
          <>
            {showFinanceLink ? (
              <Link href="/salary-advances/finance" className="btn-secondary text-sm">{t("salaryAdvances.dashboard.financeLink")}</Link>
            ) : null}
            <Link href="/salary-advances/create" className="btn-primary text-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t("salaryAdvances.dashboard.request")}
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-neutral-100" />)}
        </div>
      ) : (
        <>
      {error && <ErrorBanner message={error} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">verified_user</span>
            <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.dashboard.eligibility")}</h2>
          </div>
          {elig ? (
            <>
              <p className={`text-sm font-semibold ${elig.eligible ? "text-emerald-700" : "text-amber-700"}`}>
                {elig.eligible ? t("salaryAdvances.dashboard.eligible") : t("salaryAdvances.dashboard.blocked")}
              </p>
              <dl className="text-xs text-neutral-600 space-y-1.5">
                <div className="flex justify-between gap-3"><dt>{t("salaryAdvances.dashboard.confirmedNet")}</dt><dd className="font-medium text-neutral-900">{elig.net_salary != null ? formatSaCurrency(elig.net_salary) : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt>{t("salaryAdvances.dashboard.maxEligible")}</dt><dd className="font-medium text-neutral-900">{elig.max_eligible != null ? formatSaCurrency(elig.max_eligible) : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt>{t("salaryAdvances.finance.queue.outstanding")}</dt><dd className="font-medium text-neutral-900">{formatSaCurrency(elig.exposure?.outstanding_balance ?? 0)}</dd></div>
                <div className="flex justify-between gap-3"><dt>{t("salaryAdvances.dashboard.policy")}</dt><dd className="font-medium text-neutral-900">{elig.policy?.version ?? "—"} · {elig.policy?.recovery_rule ?? "full_eom"}</dd></div>
                {elig.intended_recovery_payroll_date && (
                  <div className="flex justify-between gap-3"><dt>{t("salaryAdvances.dashboard.recoveryPayroll")}</dt><dd className="font-medium text-neutral-900">{formatDate(elig.intended_recovery_payroll_date)}</dd></div>
                )}
              </dl>
              {!elig.eligible && elig.exposure?.reasons?.length ? (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  {t("salaryAdvances.dashboard.reasons", { reasons: elig.exposure.reasons.join(", ").replaceAll("_", " ") })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-neutral-500">{t("salaryAdvances.dashboard.eligibilityUnavailable")}</p>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">pending_actions</span>
            <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.dashboard.currentRequest")}</h2>
          </div>
          {current && currentStatus ? (
            <>
              <p className="font-mono text-xs text-neutral-500">{current.reference_number}</p>
              <p className="text-lg font-semibold text-neutral-900">{formatSaCurrency(current.amount, current.currency)}</p>
              <span className={`badge text-xs ${currentStatus.badge}`}>{t(currentStatus.label)}</span>
              <Link href={`/salary-advances/${current.id}`} className="btn-secondary text-xs py-1 px-2 inline-block">
                {t("salaryAdvances.dashboard.openRequest")}
              </Link>
            </>
          ) : (
            <p className="text-sm text-neutral-500">{t("salaryAdvances.dashboard.noOpenRequest")}</p>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
            <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.dashboard.activeAdvance")}</h2>
          </div>
          {summary?.active_advance ? (
            <>
              <p className="font-mono text-xs text-neutral-500">{summary.active_advance.reference_number}</p>
              <p className="text-lg font-semibold text-neutral-900">{formatSaCurrency(summary.active_advance.amount)}</p>
              <span className={`badge text-xs ${(SA_STATUS_CONFIG[summary.active_advance.status] ?? { badge: "badge-muted" }).badge}`}>
                {t((SA_STATUS_CONFIG[summary.active_advance.status] ?? { label: summary.active_advance.status }).label)}
              </span>
              <Link href={`/salary-advances/${summary.active_advance.id}`} className="btn-secondary text-xs py-1 px-2 inline-block">
                {t("salaryAdvances.dashboard.viewAdvance")}
              </Link>
            </>
          ) : (
            <p className="text-sm text-neutral-500">{t("salaryAdvances.dashboard.noActiveAdvance")}</p>
          )}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.dashboard.recentHistory")}</h2>
          <Link href="/salary-advances/history" className="btn-secondary text-xs py-1 px-2">{t("common.viewAll")}</Link>
        </div>
        {(summary?.history?.length ?? 0) === 0 ? (
          <EmptyState icon="history" title={t("salaryAdvances.dashboard.noHistory")} className="py-6 min-h-0" />
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
                    <span className={`badge text-xs ${sc.badge}`}>{t(sc.label)}</span>
                    <Link href={`/salary-advances/${h.id}`} className="btn-secondary text-xs py-1 px-2">{t("salaryAdvances.common.view")}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-700">{t("salaryAdvances.dashboard.moreTools")}</summary>
        <div className="mt-3">
          <ModuleHubCards cards={SALARY_ADVANCE_HUB_CARDS.filter((card) => card.href !== "/salary-advances/create")} />
        </div>
      </details>
        </>
      )}
    </div>
  );
}
