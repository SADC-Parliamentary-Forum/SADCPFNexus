"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";

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
  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await financeApi.listAdvances({ per_page: 15, page: pg, queue });
      setAdvances(getListData<SalaryAdvanceRequest>(res.data));
      setLastPage(getLastPage(res.data));
      setPage(pg);
    } catch {
      setError("Failed to load salary advances.");
    } finally {
      setLoading(false);
    }
  }, [queue]);

  useEffect(() => { load(1); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
          <Link href="/salary-advances" className="hover:text-neutral-700 transition-colors">Salary Advances</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700">{title}</span>
        </div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>

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
          <p className="text-sm font-semibold text-neutral-700">No advances found</p>
          <p className="text-xs text-neutral-500 mt-1">{emptyHint ?? "Nothing in this queue right now."}</p>
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
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {advances.map((adv) => {
                  const sc = SA_STATUS_CONFIG[adv.status] ?? { label: adv.status, badge: "badge-muted" };
                  return (
                    <tr key={adv.id}>
                      <td className="font-mono text-xs text-neutral-600">{adv.reference_number}</td>
                      {showRequester ? (
                        <td className="font-medium text-neutral-800">{adv.requester?.name ?? "—"}</td>
                      ) : null}
                      <td>{TYPE_LABELS[adv.advance_type] ?? adv.advance_type}</td>
                      <td className="font-semibold whitespace-nowrap">{formatSaCurrency(adv.amount, adv.currency)}</td>
                      <td className="text-neutral-600 max-w-[200px] truncate">{adv.purpose}</td>
                      <td><span className={`badge text-xs ${sc.badge}`}>{sc.label}</span></td>
                      <td className="text-xs text-neutral-500 whitespace-nowrap">
                        {adv.submitted_at ? formatDate(adv.submitted_at) : "—"}
                      </td>
                      <td>
                        <Link
                          href={`/salary-advances/${adv.id}`}
                          className="text-xs font-medium text-primary hover:underline"
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
