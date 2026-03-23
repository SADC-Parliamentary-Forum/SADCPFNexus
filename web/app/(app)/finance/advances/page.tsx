"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft:     { label: "Draft",     badge: "badge-muted" },
  submitted: { label: "Submitted", badge: "badge-warning" },
  approved:  { label: "Approved",  badge: "badge-success" },
  rejected:  { label: "Rejected",  badge: "badge-danger" },
  paid:      { label: "Paid",      badge: "badge-primary" },
};

const TYPE_LABELS: Record<string, string> = {
  salary_advance:    "Salary Advance",
  education_advance: "Education Advance",
  medical_advance:   "Medical Advance",
  emergency_advance: "Emergency Advance",
  other:             "Other",
};

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const load = useCallback(async (pg = 1, status = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { per_page: 15, page: pg };
      if (status !== "all") params.status = status;
      const res = await financeApi.listAdvances(params);
      const data = (res.data as any).data ?? res.data;
      setAdvances(Array.isArray(data) ? data : []);
      setLastPage((res.data as any).last_page ?? 1);
      setPage(pg);
    } catch {
      setError("Failed to load advances.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(1, statusFilter); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = ["all", "draft", "submitted", "approved", "rejected", "paid"];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
            <Link href="/finance" className="hover:text-neutral-700 transition-colors">Finance</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Advances</span>
          </div>
          <h1 className="page-title">Salary &amp; Advances</h1>
          <p className="page-subtitle">Track your advance requests and repayment schedule.</p>
        </div>
        <Link href="/finance/advances/create" className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New advance request
        </Link>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`filter-tab capitalize${statusFilter === s ? " active" : ""}`}
          >
            {s === "all" ? "All requests" : (STATUS_CONFIG[s]?.label ?? s)}
          </button>
        ))}
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
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[28px] text-primary">payments</span>
          </div>
          <p className="text-sm font-semibold text-neutral-700">No advance requests found</p>
          <p className="text-xs text-neutral-500 mt-1">
            {statusFilter !== "all" ? "No requests match the selected filter." : "You have not submitted any advance requests yet."}
          </p>
          <Link href="/finance/advances/create" className="btn-primary inline-flex items-center gap-2 mt-5 py-2 px-4 text-sm">
            <span className="material-symbols-outlined text-[16px]">add</span>
            Request an advance
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Purpose</th>
                  <th>Repayment</th>
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
                      <td className="font-medium text-neutral-900">
                        {TYPE_LABELS[adv.advance_type] ?? adv.advance_type}
                      </td>
                      <td className="font-semibold text-neutral-900 whitespace-nowrap">
                        {formatCurrency(adv.amount, adv.currency)}
                      </td>
                      <td className="text-neutral-600 max-w-[200px] truncate">{adv.purpose}</td>
                      <td className="text-neutral-600 whitespace-nowrap">
                        {adv.repayment_months} {adv.repayment_months === 1 ? "month" : "months"}
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

          {/* Pagination */}
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
