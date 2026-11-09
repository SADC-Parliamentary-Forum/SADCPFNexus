"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export const SA_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft:                   { label: "Draft",                   badge: "badge-muted" },
  submitted:               { label: "Pending Finance Certify", badge: "badge-warning" },
  resubmitted:             { label: "Resubmitted",             badge: "badge-warning" },
  finance_certified:       { label: "Finance Certified",       badge: "badge-primary" },
  finance_returned:        { label: "Returned by Finance",     badge: "badge-warning" },
  not_eligible:            { label: "Not Eligible",            badge: "badge-danger" },
  approved:                { label: "Approved",                badge: "badge-success" },
  approved_for_payment:    { label: "Approved for Payment",    badge: "badge-success" },
  rejected:                { label: "Rejected",                badge: "badge-danger" },
  paid:                    { label: "Paid",                    badge: "badge-primary" },
  recovery_scheduled:      { label: "Recovery Scheduled",      badge: "badge-primary" },
  recovered:               { label: "Recovered",               badge: "badge-success" },
  closed:                  { label: "Closed",                  badge: "badge-muted" },
  reconciliation_required: { label: "Needs Reconciliation",    badge: "badge-warning" },
  withdrawn:               { label: "Withdrawn",               badge: "badge-muted" },
  cancelled:               { label: "Cancelled",               badge: "badge-muted" },
};

/** Catalog keys for SA_STATUS_CONFIG labels (the English labels stay for other consumers). */
export const SA_STATUS_LABEL_KEYS: Record<string, string> = {
  draft: "salaryAdvance.status.draft",
  submitted: "salaryAdvance.status.submitted",
  resubmitted: "salaryAdvance.status.resubmitted",
  finance_certified: "salaryAdvance.status.financeCertified",
  finance_returned: "salaryAdvance.status.financeReturned",
  not_eligible: "salaryAdvance.status.notEligible",
  approved: "salaryAdvance.status.approved",
  approved_for_payment: "salaryAdvance.status.approvedForPayment",
  rejected: "salaryAdvance.status.rejected",
  paid: "salaryAdvance.status.paid",
  recovery_scheduled: "salaryAdvance.status.recoveryScheduled",
  recovered: "salaryAdvance.status.recovered",
  closed: "salaryAdvance.status.closed",
  reconciliation_required: "salaryAdvance.status.reconciliationRequired",
  withdrawn: "salaryAdvance.status.withdrawn",
  cancelled: "salaryAdvance.status.cancelled",
};

const TYPE_LABELS: Record<string, string> = {
  salary_advance: "salaryAdvance.type.salaryAdvance",
  education_advance: "salaryAdvance.type.educationAdvance",
  medical_advance: "salaryAdvance.type.medicalAdvance",
  emergency_advance: "salaryAdvance.type.emergencyAdvance",
  medical: "salaryAdvance.type.medical",
  school: "salaryAdvance.type.school",
  rental: "salaryAdvance.type.rental",
  funeral: "salaryAdvance.type.funeral",
  other: "salaryAdvance.type.other",
};

const FILTER_TABS = [
  { key: "all", label: "salaryAdvance.queueTable.tabAll" },
  { key: "draft", label: "salaryAdvance.status.draft" },
  { key: "submitted", label: "salaryAdvance.queueTable.tabSubmitted" },
  { key: "approved_for_payment", label: "salaryAdvance.queueTable.tabForPayment" },
  { key: "paid", label: "salaryAdvance.status.paid" },
  { key: "recovered", label: "salaryAdvance.status.recovered" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

function getLastPage(payload: unknown): number {
  if (payload && typeof payload === "object" && "last_page" in payload) {
    const n = Number((payload as { last_page?: unknown }).last_page);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
}

export function formatSaCurrency(amount: number, currency = "NAD") {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AdvanceQueueTable({
  queue,
  title,
  subtitle,
  showRequester = true,
  emptyHint,
}: {
  queue: string;
  title: string;
  subtitle?: string;
  showRequester?: boolean;
  emptyHint?: string;
}) {
  const { t } = useI18n();
  const { success } = useToast();
  const { confirm } = useConfirm();
  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [actionId, setActionId] = useState<number | null>(null);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");
  const [payrollAdapter, setPayrollAdapter] = useState<{
    mode: string;
    adapter?: string;
    driver?: string;
    enabled: boolean;
    message: string;
    recording_mode?: string;
  } | null>(null);
  const isRecovery = queue === "recovery";


  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await financeApi.listAdvances({ per_page: 15, page: pg, queue });
      setAdvances(getListData<SalaryAdvanceRequest>(res.data));
      setLastPage(getLastPage(res.data));
      setPage(pg);
      if (queue === "recovery") {
        try {
          const pay = await financeApi.getSalaryAdvancePayrollIntegration();
          setPayrollAdapter(pay.data.data);
        } catch {
          setPayrollAdapter(null);
        }
      }
    } catch {
      setError(t("salaryAdvance.queueTable.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [queue, t]);

  useEffect(() => { load(1); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return advances.filter((adv) => {
      if (filter !== "all" && adv.status !== filter) return false;
      if (!q) return true;
      const hay = [
        adv.reference_number,
        adv.purpose,
        adv.advance_type,
        adv.status,
        adv.requester?.name,
        adv.payment_reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [advances, filter, search]);

  const pageTotal = useMemo(
    () => filtered.reduce((sum, a) => sum + Number(a.amount ?? 0), 0),
    [filtered],
  );

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `salary-advances-${queue || "all"}-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((a) => ({
        reference: a.reference_number,
        requester: a.requester?.name ?? "",
        type: a.advance_type,
        amount: a.amount,
        currency: a.currency,
        purpose: a.purpose,
        status: a.status,
        submitted_at: a.submitted_at ?? "",
        paid_at: a.paid_at ?? "",
      })),
      [
        { key: "reference", header: t("salaryAdvance.queueTable.reference") },
        { key: "requester", header: t("salaryAdvance.queueTable.requester") },
        { key: "type", header: t("salaryAdvance.queueTable.type") },
        { key: "amount", header: t("salaryAdvance.queueTable.amount") },
        { key: "currency", header: t("salaryAdvance.queueTable.currency") },
        { key: "purpose", header: t("salaryAdvance.queueTable.purpose") },
        { key: "status", header: t("salaryAdvance.queueTable.status") },
        { key: "submitted_at", header: t("salaryAdvance.queueTable.submitted") },
        { key: "paid_at", header: t("salaryAdvance.status.paid") },
      ],
    );
  };

  const handleDelete = async (adv: SalaryAdvanceRequest) => {
    if (
      !(await confirm({
        title: t("salaryAdvance.queueTable.deleteTitle"),
        message: t("salaryAdvance.queueTable.deleteMessage", { reference: adv.reference_number }),
        confirmText: t("common.delete"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(adv.id);
    try {
      await financeApi.deleteAdvance(adv.id);
      success(t("salaryAdvance.queueTable.deleted"));
      await load(page);
    } catch {
      setError(t("salaryAdvance.queueTable.deleteFailed"));
    } finally {
      setActionId(null);
    }
  };

  const handleWithdraw = async (adv: SalaryAdvanceRequest) => {
    if (
      !(await confirm({
        title: t("salaryAdvance.queueTable.withdrawTitle"),
        message: t("salaryAdvance.queueTable.withdrawMessage", { reference: adv.reference_number }),
        confirmText: t("salaryAdvance.queueTable.withdraw"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(adv.id);
    try {
      await financeApi.withdrawAdvance(adv.id);
      success(t("salaryAdvance.queueTable.withdrawn"));
      await load(page);
    } catch {
      setError(t("salaryAdvance.queueTable.withdrawFailed"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <RegisterShell
      title={title}
      subtitle={subtitle}
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: "nav.salary_advances", href: "/salary-advances" },
            { label: title },
          ]}
        />
      }
      density={density}
      onDensityChange={setDensity}
      page={page}
      pageCount={lastPage}
      onPageChange={(p) => void load(p)}
      loading={loading}
      empty={
        !error && filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="payments"
              title={t("salaryAdvance.queueTable.emptyTitle")}
              description={
                advances.length === 0
                  ? (emptyHint ?? t("salaryAdvance.queueTable.emptyQueue"))
                  : t("salaryAdvance.queueTable.noMatches")
              }
            />
          </div>
        ) : undefined
      }
      actions={
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-50"
          disabled={filtered.length === 0}
          onClick={handleExport}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          {t("salaryAdvance.queueTable.exportCsv")}
        </button>
      }
      stats={
        <>
{error ? (
            <ErrorBanner message={error} onRetry={() => void load(page)} />
          ) : null}
          {isRecovery ? (
            <div className="card space-y-2 p-4">
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-muted text-xs">
                  {t("salaryAdvance.queueTable.adapter", { value: payrollAdapter?.adapter ?? payrollAdapter?.mode ?? "manual" })}
                </span>
                <span className="badge badge-muted text-xs">
                  {t("salaryAdvance.queueTable.driver", { value: payrollAdapter?.driver ?? "manual" })}
                </span>
                <span className={`badge text-xs ${payrollAdapter?.enabled ? "badge-warning" : "badge-success"}`}>
                  {payrollAdapter?.enabled ? t("salaryAdvance.queueTable.vendorAutomation") : t("salaryAdvance.queueTable.manualRecording")}
                </span>
                {(payrollAdapter?.recording_mode === "manual_reference_required" || !payrollAdapter?.enabled) && (
                  <span className="badge badge-muted text-xs">{t("salaryAdvance.queueTable.refRequired")}</span>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                {payrollAdapter?.message
                  ?? t("salaryAdvance.queueTable.manualHint")}
              </p>
            </div>
          ) : null}
          {!loading && advances.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: t("salaryAdvance.queueTable.onThisPage"), value: advances.length, icon: "list", color: "text-primary", bg: "bg-primary/10" },
                { label: t("salaryAdvance.queueTable.matchingFilter"), value: filtered.length, icon: "filter_alt", color: "text-amber-600", bg: "bg-amber-50" },
                { label: t("salaryAdvance.queueTable.amountShown"), value: formatSaCurrency(pageTotal), icon: "payments", color: "text-green-600", bg: "bg-green-50" },
              ].map((s) => (
                <div key={s.label} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-500">{s.label}</p>
                      <p className="mt-0.5 text-lg font-bold text-neutral-900">{s.value}</p>
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                      <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      }
      filters={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder={t("salaryAdvance.queueTable.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("salaryAdvance.queueTable.searchLabel")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`filter-tab ${filter === tab.key ? "active" : ""}`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
              <caption className="sr-only">{t("salaryAdvance.queueTable.caption")}</caption>
            <thead>
              <tr>
                <th>{t("salaryAdvance.queueTable.reference")}</th>
                {showRequester ? <th>{t("salaryAdvance.queueTable.requester")}</th> : null}
                <th>{t("salaryAdvance.queueTable.type")}</th>
                <th>{t("salaryAdvance.queueTable.amount")}</th>
                {isRecovery ? <th>{t("salaryAdvance.queueTable.paymentRef")}</th> : <th>{t("salaryAdvance.queueTable.purpose")}</th>}
                {isRecovery ? <th>{t("salaryAdvance.queueTable.recoveryPayroll")}</th> : null}
                {isRecovery ? <th>{t("salaryAdvance.status.recovered")}</th> : null}
                {isRecovery ? <th>{t("salaryAdvance.queueTable.outstanding")}</th> : null}
                <th>{t("salaryAdvance.queueTable.status")}</th>
                <th>{isRecovery ? t("salaryAdvance.status.paid") : t("salaryAdvance.queueTable.submitted")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((adv) => {
                const sc = SA_STATUS_CONFIG[adv.status] ?? { label: adv.status, badge: "badge-muted" };
                const outstanding = Number(adv.balance_register?.balance ?? Math.max(0, Number(adv.amount) - Number(adv.recovered_amount ?? 0)));
                const busy = actionId === adv.id;
                return (
                  <tr key={adv.id}>
                    <td className="font-mono text-xs text-neutral-600">{adv.reference_number}</td>
                    {showRequester ? (
                      <td className="font-medium text-neutral-800">{adv.requester?.name ?? "—"}</td>
                    ) : null}
                    <td>{TYPE_LABELS[adv.advance_type] ? t(TYPE_LABELS[adv.advance_type]) : adv.advance_type}</td>
                    <td className="whitespace-nowrap font-semibold">{formatSaCurrency(adv.amount, adv.currency)}</td>
                    {isRecovery ? (
                      <td className="font-mono text-xs text-neutral-600">{adv.payment_reference ?? "—"}</td>
                    ) : (
                      <td className="max-w-[200px] truncate text-neutral-600">{adv.purpose}</td>
                    )}
                    {isRecovery ? (
                      <td className="whitespace-nowrap text-xs text-neutral-600">
                        {adv.intended_recovery_payroll_date ? formatDate(adv.intended_recovery_payroll_date) : "—"}
                      </td>
                    ) : null}
                    {isRecovery ? (
                      <td className="whitespace-nowrap text-xs">{formatSaCurrency(Number(adv.recovered_amount ?? 0), adv.currency)}</td>
                    ) : null}
                    {isRecovery ? (
                      <td className="whitespace-nowrap text-xs font-semibold">{formatSaCurrency(outstanding, adv.currency)}</td>
                    ) : null}
                    <td><span className={`badge text-xs ${sc.badge}`}>{SA_STATUS_LABEL_KEYS[adv.status] ? t(SA_STATUS_LABEL_KEYS[adv.status]) : sc.label}</span></td>
                    <td className="whitespace-nowrap text-xs text-neutral-500">
                      {isRecovery
                        ? (adv.paid_at ? formatDate(adv.paid_at) : "—")
                        : (adv.submitted_at ? formatDate(adv.submitted_at) : "—")}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/salary-advances/${adv.id}`}
                          className="btn-secondary py-1 px-2 text-xs"
                        >
                          {isRecovery ? t("salaryAdvance.queueTable.recordRecovery") : t("salaryAdvance.queueTable.view")}
                        </Link>
                        {adv.status === "draft" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDelete(adv)}
                            className="btn-secondary py-1 px-2 text-xs text-red-700 disabled:opacity-50"
                          >
                            {t("common.delete")}
                          </button>
                        )}
                        {(adv.status === "submitted" || adv.status === "resubmitted" || adv.status === "finance_returned") && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleWithdraw(adv)}
                            className="btn-secondary py-1 px-2 text-xs disabled:opacity-50"
                          >
                            {t("salaryAdvance.queueTable.withdraw")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </RegisterShell>
  );
}
