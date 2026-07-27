"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { useConfirm } from "@/components/ui/ConfirmDialog";

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

const TYPE_LABELS: Record<string, string> = {
  salary_advance: "Salary Advance",
  education_advance: "Education Advance",
  medical_advance: "Medical Advance",
  emergency_advance: "Emergency Advance",
  medical: "Medical",
  school: "School",
  rental: "Rental",
  funeral: "Funeral",
  other: "Other",
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved_for_payment", label: "For payment" },
  { key: "paid", label: "Paid" },
  { key: "recovered", label: "Recovered" },
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
  const { confirm } = useConfirm();
  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [actionId, setActionId] = useState<number | null>(null);
  const [payrollAdapter, setPayrollAdapter] = useState<{
    mode: string;
    adapter?: string;
    driver?: string;
    enabled: boolean;
    message: string;
    recording_mode?: string;
  } | null>(null);
  const isRecovery = queue === "recovery";

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

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
      setError("Failed to load salary advances.");
    } finally {
      setLoading(false);
    }
  }, [queue]);

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
        { key: "reference", header: "Reference" },
        { key: "requester", header: "Requester" },
        { key: "type", header: "Type" },
        { key: "amount", header: "Amount" },
        { key: "currency", header: "Currency" },
        { key: "purpose", header: "Purpose" },
        { key: "status", header: "Status" },
        { key: "submitted_at", header: "Submitted" },
        { key: "paid_at", header: "Paid" },
      ],
    );
  };

  const handleDelete = async (adv: SalaryAdvanceRequest) => {
    if (
      !(await confirm({
        title: "Delete draft",
        message: `Permanently remove draft ${adv.reference_number}?`,
        confirmText: "Delete",
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(adv.id);
    try {
      await financeApi.deleteAdvance(adv.id);
      showToast("Draft deleted.");
      await load(page);
    } catch {
      setError("Failed to delete draft.");
    } finally {
      setActionId(null);
    }
  };

  const handleWithdraw = async (adv: SalaryAdvanceRequest) => {
    if (
      !(await confirm({
        title: "Withdraw request",
        message: `Withdraw ${adv.reference_number} from the workflow?`,
        confirmText: "Withdraw",
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(adv.id);
    try {
      await financeApi.withdrawAdvance(adv.id);
      showToast("Request withdrawn.");
      await load(page);
    } catch {
      setError("Failed to withdraw request.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
            <Link href="/salary-advances" className="hover:text-neutral-700 transition-colors">Salary Advances</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">{title}</span>
          </div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          {isRecovery ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-muted text-xs">
                  Adapter: {payrollAdapter?.adapter ?? payrollAdapter?.mode ?? "manual"}
                </span>
                <span className="badge badge-muted text-xs">
                  Driver: {payrollAdapter?.driver ?? "manual"}
                </span>
                <span className={`badge text-xs ${payrollAdapter?.enabled ? "badge-warning" : "badge-success"}`}>
                  {payrollAdapter?.enabled ? "Vendor automation on" : "Manual recording"}
                </span>
                {(payrollAdapter?.recording_mode === "manual_reference_required" || !payrollAdapter?.enabled) && (
                  <span className="badge badge-muted text-xs">Payroll transaction ref required</span>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                {payrollAdapter?.message
                  ?? "Manual payroll recovery — record each deduction with a payroll transaction reference."}
              </p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-50"
          disabled={filtered.length === 0}
          onClick={handleExport}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export CSV
        </button>
      </div>

      {toast && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{toast}</div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void load(page)}>
            Retry
          </button>
        </div>
      )}

      {!loading && advances.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "On this page", value: advances.length, icon: "list", color: "text-primary", bg: "bg-primary/10" },
            { label: "Matching filter", value: filtered.length, icon: "filter_alt", color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Amount (shown)", value: formatSaCurrency(pageTotal), icon: "payments", color: "text-green-600", bg: "bg-green-50" },
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
      )}

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder="Search reference, purpose, requester…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <p className="text-sm font-semibold text-neutral-700">No advances found</p>
          <p className="text-xs text-neutral-500 mt-1">
            {advances.length === 0
              ? (emptyHint ?? "Nothing in this queue right now.")
              : "No rows match the current filters."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  {showRequester ? <th>Requester</th> : null}
                  <th>Type</th>
                  <th>Amount</th>
                  {isRecovery ? <th>Payment ref</th> : <th>Purpose</th>}
                  {isRecovery ? <th>Recovery payroll</th> : null}
                  {isRecovery ? <th>Recovered</th> : null}
                  {isRecovery ? <th>Outstanding</th> : null}
                  <th>Status</th>
                  <th>{isRecovery ? "Paid" : "Submitted"}</th>
                  <th></th>
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
                      <td>{TYPE_LABELS[adv.advance_type] ?? adv.advance_type}</td>
                      <td className="font-semibold whitespace-nowrap">{formatSaCurrency(adv.amount, adv.currency)}</td>
                      {isRecovery ? (
                        <td className="font-mono text-xs text-neutral-600">{adv.payment_reference ?? "—"}</td>
                      ) : (
                        <td className="text-neutral-600 max-w-[200px] truncate">{adv.purpose}</td>
                      )}
                      {isRecovery ? (
                        <td className="text-xs text-neutral-600 whitespace-nowrap">
                          {adv.intended_recovery_payroll_date ? formatDate(adv.intended_recovery_payroll_date) : "—"}
                        </td>
                      ) : null}
                      {isRecovery ? (
                        <td className="text-xs whitespace-nowrap">{formatSaCurrency(Number(adv.recovered_amount ?? 0), adv.currency)}</td>
                      ) : null}
                      {isRecovery ? (
                        <td className="text-xs font-semibold whitespace-nowrap">{formatSaCurrency(outstanding, adv.currency)}</td>
                      ) : null}
                      <td><span className={`badge text-xs ${sc.badge}`}>{sc.label}</span></td>
                      <td className="text-xs text-neutral-500 whitespace-nowrap">
                        {isRecovery
                          ? (adv.paid_at ? formatDate(adv.paid_at) : "—")
                          : (adv.submitted_at ? formatDate(adv.submitted_at) : "—")}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/salary-advances/${adv.id}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {isRecovery ? "Record recovery" : "View"}
                          </Link>
                          {adv.status === "draft" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDelete(adv)}
                              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                          {(adv.status === "submitted" || adv.status === "resubmitted" || adv.status === "finance_returned") && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleWithdraw(adv)}
                              className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
                            >
                              Withdraw
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
          {lastPage > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
              <p className="text-xs text-neutral-500">Page {page} of {lastPage}</p>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => load(page - 1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Previous</button>
                <button type="button" disabled={page >= lastPage} onClick={() => load(page + 1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
