"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { getStoredUser } from "@/lib/auth";

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

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
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
};

const TYPE_LABELS: Record<string, string> = {
  salary_advance:    "Salary Advance",
  education_advance: "Education Advance",
  medical_advance:   "Medical Advance",
  emergency_advance: "Emergency Advance",
  other:             "Other",
};

const QUEUE_TABS = [
  { key: "",         label: "My requests",           hint: "Your own advance requests" },
  { key: "certify",  label: "Pending certification", hint: "Awaiting Finance Part B certify" },
  { key: "payment",  label: "Approved for payment",  hint: "Ready for disbursement" },
  { key: "recovery", label: "Payroll recovery",      hint: "Paid / scheduled for recovery" },
] as const;

type QueueKey = (typeof QUEUE_TABS)[number]["key"];

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AdvancesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queueParam = (searchParams.get("queue") ?? "") as QueueKey;
  const activeQueue: QueueKey = QUEUE_TABS.some((t) => t.key === queueParam) ? queueParam : "";

  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [canUseQueues, setCanUseQueues] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    setCanUseQueues(user?.roles?.some((r) => [
      "System Admin", "System Administrator", "super-admin",
      "Finance Controller", "Finance Officer", "Secretary General", "Director",
    ].includes(r)) ?? false);
  }, []);

  const setQueue = (key: QueueKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key) params.set("queue", key);
    else params.delete("queue");
    const qs = params.toString();
    router.replace(qs ? `/finance/advances?${qs}` : "/finance/advances");
  };

  const load = useCallback(async (pg = 1, status = statusFilter, queue = activeQueue) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { per_page: 15, page: pg };
      if (queue) {
        params.queue = queue;
      } else if (status !== "all") {
        params.status = status;
      }
      const res = await financeApi.listAdvances(params);
      setAdvances(getListData<SalaryAdvanceRequest>(res.data));
      setLastPage(getLastPage(res.data));
      setPage(pg);
    } catch {
      setError("Failed to load advances.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, activeQueue]);

  useEffect(() => { load(1, statusFilter, activeQueue); }, [statusFilter, activeQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = ["all", "draft", "submitted", "approved", "rejected", "paid"];
  const visibleTabs = canUseQueues ? QUEUE_TABS : QUEUE_TABS.filter((t) => t.key === "");
  const activeHint = QUEUE_TABS.find((t) => t.key === activeQueue)?.hint;

  return (
    <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
            <Link href="/salary-advances" className="hover:text-neutral-700 transition-colors">Salary Advances</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Legacy list</span>
          </div>
          <h1 className="page-title">Salary &amp; Advances</h1>
          <p className="page-subtitle">
            {activeHint ?? "Track your advance requests and repayment schedule."}
            {" "}
            <Link href="/salary-advances" className="text-primary font-medium hover:underline">Open new Salary Advances hub</Link>
          </p>
        </div>
        <Link href="/finance/advances/create" className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New advance request
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Advance queues">
        {visibleTabs.map((t) => (
          <button
            key={t.key || "mine"}
            type="button"
            role="tab"
            aria-selected={activeQueue === t.key}
            data-queue={t.key || "mine"}
            onClick={() => setQueue(t.key)}
            className={`filter-tab${activeQueue === t.key ? " active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!activeQueue && (
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`filter-tab capitalize${statusFilter === s ? " active" : ""}`}
            >
              {s === "all" ? "All statuses" : (STATUS_CONFIG[s]?.label ?? s)}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="card p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : advances.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[28px] text-primary">payments</span>
          </div>
          <p className="text-sm font-semibold text-neutral-700">No advance requests found</p>
          <p className="text-xs text-neutral-500 mt-1">
            {activeQueue
              ? "No requests in this finance queue."
              : statusFilter !== "all"
                ? "No requests match the selected filter."
                : "You have not submitted any advance requests yet."}
          </p>
          {!activeQueue && (
            <Link href="/finance/advances/create" className="btn-primary inline-flex items-center gap-2 mt-5 py-2 px-4 text-sm">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Request an advance
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  {activeQueue ? <th>Requester</th> : null}
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Purpose</th>
                  <th>Recovery</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {advances.map((adv) => {
                  const sc = STATUS_CONFIG[adv.status] ?? { label: adv.status, badge: "badge-muted" };
                  return (
                    <tr key={adv.id}>
                      <td className="font-mono text-xs text-neutral-600">{adv.reference_number}</td>
                      {activeQueue ? (
                        <td className="font-medium text-neutral-800">{adv.requester?.name ?? "—"}</td>
                      ) : null}
                      <td className="font-medium text-neutral-900">
                        {TYPE_LABELS[adv.advance_type] ?? adv.advance_type}
                      </td>
                      <td className="font-semibold text-neutral-900 whitespace-nowrap">
                        {formatCurrency(adv.amount, adv.currency)}
                      </td>
                      <td className="text-neutral-600 max-w-[200px] truncate">{adv.purpose}</td>
                      <td className="text-neutral-600 whitespace-nowrap">
                        {adv.repayment_months <= 1 ? "Full EOM" : `${adv.repayment_months} months`}
                      </td>
                      <td className="text-neutral-500 whitespace-nowrap text-xs">
                        {adv.submitted_at ? formatDate(adv.submitted_at) : "—"}
                      </td>
                      <td>
                        <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                      </td>
                      <td>
                        <Link
                          href={`/finance/advances/${adv.id}`}
                          className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                        >
                          View
                        </Link>
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
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => load(page - 1)}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= lastPage}
                  onClick={() => load(page + 1)}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdvancesPage() {
  return (
    <Suspense fallback={
      <div className="card p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-neutral-100 animate-pulse" />
        ))}
      </div>
    }>
      <AdvancesPageInner />
    </Suspense>
  );
}
