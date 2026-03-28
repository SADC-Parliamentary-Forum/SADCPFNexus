"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { getStoredUser } from "@/lib/auth";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { PrintButton } from "@/components/ui/PrintButton";

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  draft:     { label: "Draft",     badge: "badge-muted",    icon: "edit_note" },
  submitted: { label: "Submitted", badge: "badge-warning",  icon: "pending" },
  approved:  { label: "Approved",  badge: "badge-success",  icon: "check_circle" },
  rejected:  { label: "Rejected",  badge: "badge-danger",   icon: "cancel" },
  paid:      { label: "Paid",      badge: "badge-primary",  icon: "payments" },
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

function getEntity<T>(payload: unknown): T | null {
  if (payload && typeof payload === "object" && "data" in payload) {
    return ((payload as { data?: unknown }).data as T) ?? null;
  }
  return (payload as T) ?? null;
}

function RepaymentSchedule({
  advance,
  formatCurrency,
}: {
  advance: SalaryAdvanceRequest;
  formatCurrency: (amount: number, currency: string) => string;
}) {
  const monthly = advance.amount / advance.repayment_months;
  const startDate = advance.approved_at ? new Date(advance.approved_at) : new Date();
  // Repayments begin the month after approval
  startDate.setDate(1);
  startDate.setMonth(startDate.getMonth() + 1);

  const now = new Date();
  const rows = Array.from({ length: advance.repayment_months }, (_, i) => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    const isPast = d < now;
    const balance = advance.amount - monthly * (i + 1);
    return { month: d, installment: monthly, balance: Math.max(0, balance), isPast };
  });

  const paidCount  = rows.filter((r) => r.isPast).length;
  const paidAmount = paidCount * monthly;
  const remaining  = advance.amount - paidAmount;
  const progress   = Math.round((paidAmount / advance.amount) * 100);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-emerald-600 text-[16px]">calendar_month</span>
        </div>
        <h2 className="text-sm font-semibold text-neutral-900">Repayment Schedule</h2>
        <span className="ml-auto text-xs text-neutral-400">{paidCount}/{advance.repayment_months} installments</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-neutral-500">Repaid: <span className="font-semibold text-neutral-800">{formatCurrency(paidAmount, advance.currency)}</span></span>
          <span className="text-neutral-500">Remaining: <span className="font-semibold text-neutral-800">{formatCurrency(remaining, advance.currency)}</span></span>
        </div>
        <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-neutral-400 mt-1">{progress}% repaid</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="text-left py-2 text-xs font-semibold text-neutral-500">#</th>
              <th className="text-left py-2 text-xs font-semibold text-neutral-500">Month</th>
              <th className="text-right py-2 text-xs font-semibold text-neutral-500">Deduction</th>
              <th className="text-right py-2 text-xs font-semibold text-neutral-500">Balance</th>
              <th className="text-center py-2 text-xs font-semibold text-neutral-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {rows.map((row, i) => (
              <tr key={i} className={row.isPast ? "opacity-60" : ""}>
                <td className="py-2 pr-3 text-neutral-400 font-mono text-xs">{i + 1}</td>
                <td className="py-2 font-medium text-neutral-800">
                  {row.month.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                </td>
                <td className="py-2 text-right font-semibold text-neutral-900">
                  {formatCurrency(row.installment, advance.currency)}
                </td>
                <td className="py-2 text-right text-neutral-600">
                  {formatCurrency(row.balance, advance.currency)}
                </td>
                <td className="py-2 text-center">
                  {row.isPast ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      Deducted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      Upcoming
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-400">
        Deduction status is estimated based on approval date. Actual payroll records may differ.
      </p>
    </div>
  );
}

export default function AdvanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? Number(params.id) : NaN;

  const [advance, setAdvance] = useState<SalaryAdvanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    setIsAdmin(user?.roles?.some((r) => ["System Admin", "System Administrator", "super-admin", "Finance Officer"].includes(r)) ?? false);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(id)) { router.replace("/finance/advances"); return; }
    setLoading(true);
    financeApi.getAdvance(id)
      .then((res) => setAdvance(getEntity<SalaryAdvanceRequest>(res.data)))
      .catch(() => setError("Could not load advance request."))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleSubmit = async () => {
    if (!advance) return;
    setActionLoading(true);
    try {
      const res = await financeApi.submitAdvance(advance.id);
      setAdvance(res.data.data);
    } catch { setError("Failed to submit request."); }
    finally { setActionLoading(false); }
  };

  const handleApprove = async () => {
    if (!advance) return;
    setActionLoading(true);
    try {
      const res = await financeApi.approveAdvance(advance.id);
      setAdvance(res.data.data);
    } catch { setError("Failed to approve request."); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!advance || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await financeApi.rejectAdvance(advance.id, rejectReason.trim());
      setAdvance(res.data.data);
      setShowRejectDialog(false);
    } catch { setError("Failed to reject request."); }
    finally { setActionLoading(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl animate-pulse">
        <div className="h-6 w-48 bg-neutral-200 rounded" />
        <div className="h-48 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error || !advance) {
    return (
      <div className="space-y-3 max-w-3xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Not found"}
        </div>
        <Link href="/finance/advances" className="text-sm font-semibold text-primary hover:underline">
          Back to Advances
        </Link>
      </div>
    );
  }

  const sc = STATUS_CONFIG[advance.status] ?? { label: advance.status, badge: "badge-muted", icon: "info" };
  const monthlyRepayment = advance.repayment_months > 0
    ? formatCurrency(advance.amount / advance.repayment_months, advance.currency)
    : "—";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
          <Link href="/finance" className="hover:text-neutral-700 transition-colors">Finance</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/finance/advances" className="hover:text-neutral-700 transition-colors">Advances</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700">{advance.reference_number}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">{TYPE_LABELS[advance.advance_type] ?? advance.advance_type}</h1>
          <span className={`badge ${sc.badge}`}>
            <span className="material-symbols-outlined text-[13px] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>{sc.icon}</span>
            {sc.label}
          </span>
        </div>
        <p className="page-subtitle">{advance.reference_number}</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Rejection reason */}
      {advance.status === "rejected" && advance.rejection_reason && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-3">
          <span className="material-symbols-outlined text-[20px] text-red-500 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Rejected</p>
            <p className="text-sm text-red-700 mt-0.5">{advance.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary">timeline</span>
            Request Progress
          </h3>
          <PrintButton className="text-xs" />
        </div>
        <StatusTimeline
          steps={[
            { key: "draft",     label: "Draft",     icon: "edit_note",    completedAt: advance.submitted_at ? undefined : advance.submitted_at },
            { key: "submitted", label: "Submitted", icon: "send",         completedAt: advance.submitted_at },
            { key: "approved",  label: "Approved",  icon: "check_circle", completedAt: advance.approved_at },
            { key: "paid",      label: "Paid",      icon: "payments",     completedAt: null },
          ]}
          currentStatus={advance.status}
          rejectedAt={advance.status === "rejected" ? advance.approved_at : null}
          rejectionReason={advance.rejection_reason}
        />
      </div>

      {/* Main details card */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px] text-primary">payments</span>
          </div>
          <h2 className="text-sm font-semibold text-neutral-900">Request Details</h2>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Advance type</p>
            <p className="font-semibold text-neutral-900">{TYPE_LABELS[advance.advance_type] ?? advance.advance_type}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Amount requested</p>
            <p className="font-semibold text-neutral-900 text-lg">{formatCurrency(advance.amount, advance.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Repayment period</p>
            <p className="font-semibold text-neutral-900">{advance.repayment_months} {advance.repayment_months === 1 ? "month" : "months"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Monthly deduction</p>
            <p className="font-semibold text-neutral-900">{monthlyRepayment}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-neutral-400 mb-0.5">Purpose</p>
            <p className="font-medium text-neutral-800">{advance.purpose}</p>
          </div>
          {advance.justification && (
            <div className="col-span-2">
              <p className="text-xs text-neutral-400 mb-0.5">Justification</p>
              <p className="text-neutral-700 whitespace-pre-wrap">{advance.justification}</p>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 pt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Requested by</p>
            <p className="font-medium text-neutral-900">{advance.requester?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Approved by</p>
            <p className="font-medium text-neutral-900">{advance.approver?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Submitted on</p>
            <p className="font-medium text-neutral-900">{advance.submitted_at ? formatDate(advance.submitted_at) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Approved on</p>
            <p className="font-medium text-neutral-900">{advance.approved_at ? formatDate(advance.approved_at) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Repayment Schedule */}
      {(advance.status === "approved" || advance.status === "paid") && advance.repayment_months > 0 && (
        <RepaymentSchedule advance={advance} formatCurrency={formatCurrency} />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {advance.status === "draft" && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleSubmit}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            Submit for approval
          </button>
        )}
        {isAdmin && advance.status === "submitted" && (
          <>
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleApprove}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Approve
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowRejectDialog(true)}
              className="flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              Reject
            </button>
          </>
        )}
        <Link href="/finance/advances" className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm">
          Back to list
        </Link>
      </div>

      {/* Reject dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-base font-semibold text-neutral-900 mb-1">Reject advance request</h3>
              <p className="text-sm text-neutral-500 mb-4">Please provide a reason for rejecting this request.</p>
              <textarea
                className="form-input w-full h-28 resize-none"
                placeholder="Reason for rejection…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={() => setShowRejectDialog(false)}
                className="btn-secondary py-2 px-4 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || actionLoading}
                onClick={handleReject}
                className="flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
