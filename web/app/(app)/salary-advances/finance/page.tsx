"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { financeApi } from "@/lib/api";
import { formatSaCurrency } from "@/components/salary-advance/AdvanceQueueTable";
import { SalaryAdvancePageHeader } from "@/components/salary-advance/SalaryAdvancePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Queue tiles; `label` is a catalog key translated where it renders. */
const QUEUE_CARDS = [
  { key: "certify", label: "salaryAdvances.finance.queue.certify", href: "/salary-advances/queues/certify", icon: "verified" },
  { key: "pending_approval", label: "salaryAdvances.finance.queue.pendingApproval", href: "/salary-advances/pending-approval", icon: "fact_check" },
  { key: "payment", label: "salaryAdvances.finance.queue.payment", href: "/salary-advances/queues/payment", icon: "account_balance" },
  { key: "recovery", label: "salaryAdvances.finance.queue.recovery", href: "/salary-advances/queues/recovery", icon: "event_repeat" },
  { key: "reconciliation", label: "salaryAdvances.finance.queue.reconciliation", href: "/salary-advances/reconciliation", icon: "compare_arrows" },
  { key: "outstanding", label: "salaryAdvances.finance.queue.outstanding", href: "/salary-advances/outstanding", icon: "pending" },
] as const;

export default function SalaryAdvanceFinanceDashboardPage() {
  const { t } = useI18n();
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
        setError(t("salaryAdvances.finance.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <SalaryAdvancePageHeader
        title={t("salaryAdvances.finance.title")}
        subtitle={t("salaryAdvances.finance.subtitle")}
        crumbs={[
          { label: "nav.salary_advances", href: "/salary-advances" },
          { label: t("salaryAdvances.finance.crumb") },
        ]}
        actions={
          <>
          <Link href="/salary-advances/register" className="btn-secondary py-2 px-4 text-sm">{t("salaryAdvances.common.register")}</Link>
          <Link href="/salary-advances/reports" className="btn-secondary py-2 px-4 text-sm">{t("salaryAdvances.common.reports")}</Link>
          </>
        }
      />

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">{t("salaryAdvances.finance.exposure")}</p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">
                {formatSaCurrency(data.exposure.total_outstanding_balance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">{t("salaryAdvances.finance.openWithBalance")}</p>
              <p className="text-xl font-semibold text-neutral-900">{data.exposure.outstanding_count}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {QUEUE_CARDS.map((card) => (
              <Link key={card.key} href={card.href} className="card p-5 hover:border-primary/40 transition-colors group">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary">{card.icon}</span>
                  <h2 className="text-sm font-semibold text-neutral-900 group-hover:text-primary">{t(card.label)}</h2>
                </div>
                <p className="text-3xl font-semibold text-neutral-900">{data.queues[card.key] ?? 0}</p>
              </Link>
            ))}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">{t("salaryAdvances.finance.byStatus")}</h2>
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
