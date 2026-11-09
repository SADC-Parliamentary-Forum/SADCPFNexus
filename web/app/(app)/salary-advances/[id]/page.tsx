"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { financeApi, type SalaryAdvanceRequest } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getStoredUser } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { PrintButton } from "@/components/ui/PrintButton";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { WorkflowStatusBanner } from "@/components/workflow/WorkflowStatusBanner";
import { ReturnModal } from "@/components/workflow/ReturnModal";
import { useToast } from "@/components/ui/Toast";
import { SalaryAdvancePageHeader } from "@/components/salary-advance/SalaryAdvancePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  draft:                   { label: "salaryAdvances.detail.status.draft",                  badge: "badge-muted",    icon: "edit_note" },
  submitted:               { label: "salaryAdvances.detail.status.submitted", badge: "badge-warning",  icon: "pending" },
  finance_certified:       { label: "salaryAdvances.detail.status.financeCertified",      badge: "badge-primary",  icon: "verified" },
  finance_returned:        { label: "salaryAdvances.detail.status.financeReturned",    badge: "badge-warning",  icon: "undo" },
  not_eligible:            { label: "salaryAdvances.detail.status.notEligible",           badge: "badge-danger",   icon: "block" },
  approved:                { label: "salaryAdvances.detail.status.approved",               badge: "badge-success",  icon: "check_circle" },
  approved_for_payment:    { label: "salaryAdvances.detail.status.approvedForPayment",   badge: "badge-success",  icon: "payments" },
  rejected:                { label: "salaryAdvances.detail.status.rejected",               badge: "badge-danger",   icon: "cancel" },
  paid:                    { label: "salaryAdvances.detail.status.paid",                   badge: "badge-primary",  icon: "payments" },
  recovery_scheduled:      { label: "salaryAdvances.detail.status.recoveryScheduled",     badge: "badge-primary",  icon: "event" },
  recovered:               { label: "salaryAdvances.detail.status.recovered",              badge: "badge-success",  icon: "check_circle" },
  reconciliation_required: { label: "salaryAdvances.detail.status.reconciliationRequired", badge: "badge-warning", icon: "warning" },
  closed:                  { label: "salaryAdvances.detail.status.closed",                 badge: "badge-muted",    icon: "lock" },
  returned_for_correction: { label: "salaryAdvances.detail.status.returnedForCorrection", badge: "badge-warning", icon: "undo" },
  withdrawn:               { label: "salaryAdvances.detail.status.withdrawn",              badge: "badge-muted",    icon: "block" },
  resubmitted:             { label: "salaryAdvances.detail.status.resubmitted",            badge: "badge-warning",  icon: "refresh" },
};

/** i18n keys of the advance type labels. */
const TYPE_LABELS: Record<string, string> = {
  salary_advance:    "salaryAdvances.type.salary",
  education_advance: "salaryAdvances.type.education",
  medical_advance:   "salaryAdvances.type.medical",
  emergency_advance: "salaryAdvances.type.emergency",
  other:             "salaryAdvances.type.other",
};

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
  const { t, localeTag } = useI18n();
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
        <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.detail.schedule.title")}</h2>
        <span className="ml-auto text-xs text-neutral-400">
          {t("salaryAdvances.detail.schedule.installments", { paid: paidCount, total: advance.repayment_months })}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-neutral-500">{t("salaryAdvances.detail.schedule.repaid")} <span className="font-semibold text-neutral-800">{formatCurrency(paidAmount, advance.currency)}</span></span>
          <span className="text-neutral-500">{t("salaryAdvances.detail.schedule.remaining")} <span className="font-semibold text-neutral-800">{formatCurrency(remaining, advance.currency)}</span></span>
        </div>
        <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-neutral-400 mt-1">{t("salaryAdvances.detail.schedule.progress", { percent: progress })}</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="text-left py-2 text-xs font-semibold text-neutral-500">#</th>
              <th className="text-left py-2 text-xs font-semibold text-neutral-500">{t("salaryAdvances.detail.schedule.month")}</th>
              <th className="text-right py-2 text-xs font-semibold text-neutral-500">{t("salaryAdvances.detail.schedule.deduction")}</th>
              <th className="text-right py-2 text-xs font-semibold text-neutral-500">{t("salaryAdvances.detail.schedule.balance")}</th>
              <th className="text-center py-2 text-xs font-semibold text-neutral-500">{t("salaryAdvances.detail.schedule.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {rows.map((row, i) => (
              <tr key={i} className={row.isPast ? "opacity-60" : ""}>
                <td className="py-2 pr-3 text-neutral-400 font-mono text-xs">{i + 1}</td>
                <td className="py-2 font-medium text-neutral-800">
                  {row.month.toLocaleDateString(localeTag, { month: "short", year: "numeric" })}
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
                      {t("salaryAdvances.detail.schedule.deducted")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      {t("salaryAdvances.detail.schedule.upcoming")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-400">
        {t("salaryAdvances.detail.schedule.note")}
      </p>
    </div>
  );
}

export default function AdvanceDetailPage() {
  const { success, error: showErrorToast, info } = useToast();
  const { t, localeTag } = useI18n();
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
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [certifyForm, setCertifyForm] = useState({
    confirmed_net_salary: "",
    confirmed_gross_salary: "",
    recommended_amount: "",
    intended_recovery_payroll_date: "",
    comments: "",
  });
  const [certifyMode, setCertifyMode] = useState<"certify" | "return" | "not_eligible">("certify");
  const [actionReason, setActionReason] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    payment_reference: "",
    payment_method: "bank_transfer",
    payment_date: new Date().toISOString().slice(0, 10),
  });
  const [recoveryForm, setRecoveryForm] = useState({
    amount: "",
    reference_doc: "PAYROLL",
    notes: "Full EOM recovery",
  });
  const { confirm } = useConfirm();

  useEffect(() => {
    const user = getStoredUser();
    setIsAdmin(user?.roles?.some((r) => [
      "System Admin", "System Administrator", "super-admin",
      "Finance Controller", "Finance Officer", "Secretary General", "Director",
    ].includes(r)) ?? false);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(id)) { router.replace("/salary-advances"); return; }
    setLoading(true);
    financeApi.getAdvance(id)
      .then((res) => setAdvance(getEntity<SalaryAdvanceRequest>(res.data)))
      .catch(() => setError(t("salaryAdvances.detail.err.load")))
      .finally(() => setLoading(false));
  }, [id, router, t]);

  const handleSubmit = async () => {
    if (!advance) return;
    setActionLoading(true);
    try {
      const res = await financeApi.submitAdvance(advance.id, { deduction_authority_confirmed: true });
      setAdvance(res.data.data);
    } catch { setError(t("salaryAdvances.detail.err.submit")); }
    finally { setActionLoading(false); }
  };

  const openCertifyModal = () => {
    if (!advance) return;
    const recovery = advance.intended_recovery_payroll_date
      ?? new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString().slice(0, 10);
    setCertifyForm({
      confirmed_net_salary: String(advance.net_salary_at_request ?? ""),
      confirmed_gross_salary: advance.gross_salary_at_request != null ? String(advance.gross_salary_at_request) : "",
      recommended_amount: String(advance.amount ?? ""),
      intended_recovery_payroll_date: recovery.slice(0, 10),
      comments: "",
    });
    setCertifyMode("certify");
    setActionReason("");
    setShowCertifyModal(true);
  };

  const handleFinanceCertifySubmit = async () => {
    if (!advance) return;
    setActionLoading(true);
    setError(null);
    try {
      if (certifyMode === "return") {
        if (!actionReason.trim()) { setError(t("salaryAdvances.detail.err.returnReason")); return; }
        await financeApi.financeReturnAdvance(advance.id, actionReason.trim());
        success(t("salaryAdvances.detail.ok.returned"));
      } else if (certifyMode === "not_eligible") {
        if (!actionReason.trim()) { setError(t("salaryAdvances.detail.err.notEligibleReason")); return; }
        await financeApi.markAdvanceNotEligible(advance.id, actionReason.trim());
        success(t("salaryAdvances.detail.ok.notEligible"));
      } else {
        const net = Number(certifyForm.confirmed_net_salary);
        const recommended = Number(certifyForm.recommended_amount);
        if (!Number.isFinite(net) || net < 0) { setError(t("salaryAdvances.detail.err.netSalary")); return; }
        if (!certifyForm.intended_recovery_payroll_date) { setError(t("salaryAdvances.detail.err.recoveryDate")); return; }
        if (!Number.isFinite(recommended) || recommended < 1) { setError(t("salaryAdvances.detail.err.recommended")); return; }
        await financeApi.financeCertifyAdvance(advance.id, {
          confirmed_net_salary: net,
          confirmed_gross_salary: certifyForm.confirmed_gross_salary
            ? Number(certifyForm.confirmed_gross_salary)
            : undefined,
          recommended_amount: recommended,
          intended_recovery_payroll_date: certifyForm.intended_recovery_payroll_date,
          eligible: true,
          comments: certifyForm.comments || undefined,
        });
        success(t("salaryAdvances.detail.ok.certified"));
      }
      setShowCertifyModal(false);
      await refreshAdvance();
    } catch {
      setError(certifyMode === "certify" ? t("salaryAdvances.detail.err.certify") : t("salaryAdvances.detail.err.financeAction"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPaymentSubmit = async () => {
    if (!advance) return;
    if (!paymentForm.payment_reference.trim()) {
      setError(t("salaryAdvances.detail.err.paymentRef"));
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await financeApi.recordAdvancePayment(advance.id, {
        payment_reference: paymentForm.payment_reference.trim(),
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date || undefined,
      });
      setShowPaymentModal(false);
      await refreshAdvance();
      success(t("salaryAdvances.detail.ok.payment"));
    } catch { setError(t("salaryAdvances.detail.err.payment")); }
    finally { setActionLoading(false); }
  };

  const handleRecordRecoverySubmit = async () => {
    if (!advance) return;
    const amount = Number(recoveryForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("salaryAdvances.detail.err.recoveryAmount"));
      return;
    }
    if (!recoveryForm.reference_doc.trim()) {
      setError(t("salaryAdvances.detail.err.recoveryRef"));
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await financeApi.recordAdvanceRecovery(advance.id, {
        amount,
        reference_doc: recoveryForm.reference_doc.trim(),
        notes: recoveryForm.notes || undefined,
      });
      setShowRecoveryModal(false);
      await refreshAdvance();
      success(t("salaryAdvances.detail.ok.recovery"));
    } catch { setError(t("salaryAdvances.detail.err.recovery")); }
    finally { setActionLoading(false); }
  };

  const refreshAdvance = async () => {
    const res = await financeApi.getAdvance(id);
    setAdvance(getEntity<SalaryAdvanceRequest>(res.data));
  };


  const handleApprove = async () => {
    if (!advance) return;
    setActionLoading(true);
    try {
      const res = await financeApi.approveAdvance(advance.id);
      const notified: string[] = (res.data as any).notified_approvers ?? [];
      await refreshAdvance();
      if (notified.length > 0) {
        success(t("salaryAdvances.detail.ok.approvedNotified", { names: notified.join(", ") }));
      } else {
        success(t("salaryAdvances.detail.ok.fullyApproved"));
      }
    } catch { setError(t("salaryAdvances.detail.err.approve")); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!advance || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await financeApi.rejectAdvance(advance.id, rejectReason.trim());
      await refreshAdvance();
      setShowRejectDialog(false);
    } catch { setError(t("salaryAdvances.detail.err.reject")); }
    finally { setActionLoading(false); }
  };

  const handleReturn = async (comment: string) => {
    if (!advance) return;
    setReturnLoading(true);
    try {
      await financeApi.returnAdvanceForCorrection(advance.id, comment);
      await refreshAdvance();
      setShowReturnModal(false);
      success(t("salaryAdvances.detail.ok.returnedForCorrection"));
    } catch { setError(t("salaryAdvances.detail.err.return")); }
    finally { setReturnLoading(false); }
  };

  const handleWithdraw = async () => {
    if (!advance) return;
    if (!(await confirm({ title: t("salaryAdvances.detail.withdrawTitle"), message: t("salaryAdvances.detail.withdrawMessage"), variant: "danger" }))) return;
    setActionLoading(true);
    try {
      await financeApi.withdrawAdvance(advance.id);
      await refreshAdvance();
      success(t("salaryAdvances.detail.ok.withdrawn"));
    } catch { setError(t("salaryAdvances.detail.err.withdraw")); }
    finally { setActionLoading(false); }
  };

  const handleResubmit = async () => {
    if (!advance) return;
    if (!(await confirm({ title: t("salaryAdvances.detail.resubmitTitle"), message: t("salaryAdvances.detail.resubmitMessage"), variant: "primary" }))) return;
    setActionLoading(true);
    try {
      await financeApi.resubmitAdvance(advance.id);
      await refreshAdvance();
      success(t("salaryAdvances.detail.ok.resubmitted"));
    } catch { setError(t("salaryAdvances.detail.err.resubmit")); }
    finally { setActionLoading(false); }
  };

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-neutral-200 rounded" />
        <div className="h-48 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error || !advance) {
    return (
      <div className="w-full min-w-0 space-y-3">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? t("salaryAdvances.detail.notFound")}
        </div>
        <Link href="/salary-advances" className="btn-secondary text-sm">
          {t("salaryAdvances.detail.backToAdvances")}
        </Link>
      </div>
    );
  }

  const scConfig = STATUS_CONFIG[advance.status];
  const sc = scConfig
    ? { ...scConfig, label: t(scConfig.label) }
    : { label: advance.status, badge: "badge-muted", icon: "info" };
  const typeLabel = TYPE_LABELS[advance.advance_type] ? t(TYPE_LABELS[advance.advance_type]) : advance.advance_type;
  const monthlyRepayment = advance.repayment_months > 0
    ? formatCurrency(advance.amount / advance.repayment_months, advance.currency)
    : "—";
  const approvalRequest = (advance as any).approval_request;
  const currentStep = approvalRequest?.workflow?.steps?.[approvalRequest?.current_step_index];
  const canReturn = approvalRequest?.status === "pending" && currentStep?.allow_return;
  const isReturnedForCorrection = advance.status === "returned_for_correction";

  const timelineStatus = (() => {
    switch (advance.status) {
      case "draft":
      case "finance_returned":
      case "returned_for_correction":
        return "draft";
      case "submitted":
      case "resubmitted":
        return "submitted";
      case "finance_certified":
        return "finance_certified";
      case "approved":
      case "approved_for_payment":
        return "approved_for_payment";
      case "paid":
      case "recovery_scheduled":
      case "reconciliation_required":
      case "recovered":
        return "paid";
      case "closed":
        return "closed";
      case "rejected":
      case "not_eligible":
        return "submitted";
      default:
        return advance.status;
    }
  })();

  return (
    <div className="w-full min-w-0 space-y-6">
      <WorkflowStatusBanner
        status={advance.status}
        currentStage={currentStep?.role_name ?? currentStep?.name ?? null}
        currentHolder={null}
      />

      <SalaryAdvancePageHeader
        title={typeLabel}
        subtitle={advance.reference_number}
        crumbs={[
          { label: "nav.salary_advances", href: "/salary-advances" },
          { label: "salaryAdvances.detail.crumbApplications", href: "/salary-advances/applications" },
          { label: advance.reference_number },
        ]}
        meta={
          <span className={`badge ${sc.badge}`}>
            <span className="material-symbols-outlined text-[13px] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>{sc.icon}</span>
            {sc.label}
          </span>
        }
        actions={
          <>
          {(advance.status === "approved" || advance.status === "approved_for_payment" || advance.status === "paid" || advance.status === "closed" || advance.status === "recovery_scheduled" || advance.status === "recovered") && (
            <>
              <Link
                href={`/salary-advances/${advance.id}/certificate`}
                className="btn-secondary text-xs"
              >
                <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                {t("salaryAdvances.detail.certificate")}
              </Link>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={async () => {
                  try {
                    const res = await financeApi.downloadAdvancePdf(advance.id);
                    const url = URL.createObjectURL(res.data);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `FORM-002-${advance.reference_number}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    setError(t("salaryAdvances.detail.err.downloadPdf"));
                  }
                }}
              >
                <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                {t("salaryAdvances.detail.formPdf")}
              </button>
            </>
          )}
          {advance.status === "submitted" && approvalRequest?.status === "pending" && (
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={actionLoading}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">block</span>
              {t("salaryAdvances.detail.withdraw")}
            </button>
          )}
          {isReturnedForCorrection && (
            <button
              type="button"
              onClick={handleResubmit}
              disabled={actionLoading}
              className="btn-primary text-xs disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              {t("salaryAdvances.detail.resubmit")}
            </button>
          )}
          </>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Rejection reason */}
      {advance.status === "rejected" && advance.rejection_reason && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-3">
          <span className="material-symbols-outlined text-[20px] text-red-500 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
          <div>
            <p className="text-sm font-semibold text-red-800">{t("salaryAdvances.detail.status.rejected")}</p>
            <p className="text-sm text-red-700 mt-0.5">{advance.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary">timeline</span>
            {t("salaryAdvances.detail.workflowTracker")}
          </h3>
          <PrintButton className="text-xs" />
        </div>
        <StatusTimeline
          steps={[
            { key: "draft", label: t("salaryAdvances.detail.status.draft"), icon: "edit_note", completedAt: advance.submitted_at ? advance.created_at : undefined },
            { key: "submitted", label: t("salaryAdvances.detail.step.financeCertify"), icon: "verified", completedAt: advance.finance_certified_at ?? (["finance_certified", "approved", "approved_for_payment", "paid", "recovery_scheduled", "recovered", "closed", "reconciliation_required"].includes(advance.status) ? advance.submitted_at : null) },
            { key: "finance_certified", label: t("salaryAdvances.detail.step.principalSg"), icon: "fact_check", completedAt: advance.approved_at },
            { key: "approved_for_payment", label: t("salaryAdvances.detail.step.payment"), icon: "payments", completedAt: advance.paid_at },
            { key: "paid", label: t("salaryAdvances.detail.step.recovery"), icon: "event_repeat", completedAt: advance.closed_at ?? (advance.status === "recovered" ? advance.updated_at : null) },
            { key: "closed", label: t("salaryAdvances.detail.status.closed"), icon: "lock", completedAt: advance.closed_at },
          ]}
          currentStatus={timelineStatus}
          rejectedAt={advance.status === "rejected" || advance.status === "not_eligible" ? (advance.approved_at ?? advance.updated_at) : null}
          rejectionReason={advance.rejection_reason ?? advance.not_eligible_reason}
        />
        <div className="mt-4 grid sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
            <p className="text-neutral-500">{t("salaryAdvances.detail.currentStage")}</p>
            <p className="font-semibold text-neutral-900 mt-0.5">{sc.label}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
            <p className="text-neutral-500">{t("salaryAdvances.detail.currentHolder")}</p>
            <p className="font-semibold text-neutral-900 mt-0.5">
              {currentStep?.role_name ?? currentStep?.name ?? (["draft", "finance_returned", "returned_for_correction"].includes(advance.status) ? t("salaryAdvances.detail.requester") : "—")}
            </p>
          </div>
          <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
            <p className="text-neutral-500">{t("salaryAdvances.detail.paymentRecovery")}</p>
            <p className="font-semibold text-neutral-900 mt-0.5">
              {(advance.payment_status ?? "not_prepared").replaceAll("_", " ")}
              {" · "}
              {(advance.recovery_status ?? "not_scheduled").replaceAll("_", " ")}
            </p>
          </div>
        </div>
      </div>

      {/* Approval Timeline */}
      <ApprovalTimeline request={approvalRequest} />

      {advance.status === "closed" && (
        <div className="card p-5 border-dashed">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary">folder_shared</span>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.detail.personnelFile")}</h3>
              <p className="text-xs text-neutral-500 mt-1">
                {advance.personnel_file_document_id
                  ? t("salaryAdvances.detail.personnelFiled")
                  : t("salaryAdvances.detail.personnelAvailable")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary py-1.5 px-3 text-xs"
                  onClick={async () => {
                    try {
                      const res = await financeApi.downloadAdvancePdf(advance.id);
                      const url = URL.createObjectURL(res.data);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${advance.reference_number}-FORM-002.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      setError(t("salaryAdvances.detail.err.downloadPdfAlt"));
                    }
                  }}
                >
                  {t("salaryAdvances.detail.downloadPdf")}
                </button>
                {advance.personnel_file_url ? (
                  <Link
                    href={advance.personnel_file_url}
                    className="btn-primary py-1.5 px-3 text-xs"
                    data-testid="personnel-file-link"
                  >
                    {t("salaryAdvances.detail.openPersonnelFile")}
                  </Link>
                ) : (
                  <span className="badge badge-muted text-xs self-center">{t("salaryAdvances.detail.awaitingFiling")}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main details card */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px] text-primary">payments</span>
          </div>
          <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.detail.requestDetails")}</h2>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.advanceType")}</p>
            <p className="font-semibold text-neutral-900">{typeLabel}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.amountRequested")}</p>
            <p className="font-semibold text-neutral-900 text-lg">{formatCurrency(advance.amount, advance.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.step.recovery")}</p>
            <p className="font-semibold text-neutral-900">
              {advance.repayment_months <= 1
                ? t("salaryAdvances.detail.fullAmountOneMonth")
                : t("salaryAdvances.detail.months", { count: advance.repayment_months })}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">
              {advance.repayment_months <= 1 ? t("salaryAdvances.detail.payrollDeduction") : t("salaryAdvances.detail.monthlyDeduction")}
            </p>
            <p className="font-semibold text-neutral-900">{monthlyRepayment}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.purpose")}</p>
            <p className="font-medium text-neutral-800">{advance.purpose}</p>
          </div>
          {advance.justification && (
            <div className="col-span-2">
              <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.justification")}</p>
              <p className="text-neutral-700 whitespace-pre-wrap">{advance.justification}</p>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 pt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.requestedBy")}</p>
            <p className="font-medium text-neutral-900">{advance.requester?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.approvedBy")}</p>
            <p className="font-medium text-neutral-900">{advance.approver?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.submittedOn")}</p>
            <p className="font-medium text-neutral-900">{advance.submitted_at ? formatDate(advance.submitted_at) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.approvedOn")}</p>
            <p className="font-medium text-neutral-900">{advance.approved_at ? formatDate(advance.approved_at) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Salary Eligibility Snapshot */}
      {(advance.net_salary_at_request != null || advance.max_eligible_amount != null) && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-[16px]">verified</span>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.detail.snapshot.title")}</h2>
            <span className="ml-auto text-[11px] text-neutral-400">{t("salaryAdvances.detail.snapshot.frozen")}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.snapshot.net")}</p>
              <p className="font-semibold text-neutral-900">
                {advance.net_salary_at_request != null ? formatCurrency(advance.net_salary_at_request, advance.currency) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.snapshot.gross")}</p>
              <p className="font-medium text-neutral-800">
                {advance.gross_salary_at_request != null ? formatCurrency(advance.gross_salary_at_request, advance.currency) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.snapshot.maxEligible")}</p>
              <p className="font-semibold text-neutral-900">
                {advance.max_eligible_amount != null ? formatCurrency(advance.max_eligible_amount, advance.currency) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.snapshot.payslipPeriod")}</p>
              <p className="font-medium text-neutral-800">
                {advance.payslip
                  ? advance.payslip.period_month >= 1 && advance.payslip.period_month <= 12
                    ? new Date(advance.payslip.period_year, advance.payslip.period_month - 1, 1).toLocaleDateString(localeTag, { month: "short", year: "numeric" })
                    : `${advance.payslip.period_month} ${advance.payslip.period_year}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-0.5">{t("salaryAdvances.detail.snapshot.eligibility")}</p>
              <span className={`badge ${advance.eligibility_status === "eligible" ? "badge-success" : "badge-warning"}`}>
                {advance.eligibility_status ?? "—"}
              </span>
            </div>
          </div>
        </div>
      )}

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
            {t("salaryAdvances.detail.submitForApproval")}
          </button>
        )}
        {isAdmin && (advance.status === "submitted" || advance.status === "resubmitted") && (
          <>
            <button
              type="button"
              disabled={actionLoading}
              onClick={openCertifyModal}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-60"
              data-testid="finance-certify-open"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              {t("salaryAdvances.detail.financeCertifyPartB")}
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowRejectDialog(true)}
              className="flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              {t("common.reject")}
            </button>
          </>
        )}
        {isAdmin && advance.status === "finance_certified" && (
          <>
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleApprove}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {t("common.approve")}
            </button>
            {canReturn && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowReturnModal(true)}
                className="flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
                {t("common.return")}
              </button>
            )}
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowRejectDialog(true)}
              className="flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              {t("common.reject")}
            </button>
          </>
        )}
        {isAdmin && (advance.status === "approved_for_payment" || advance.status === "approved") && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => {
              setPaymentForm({
                payment_reference: "",
                payment_method: "bank_transfer",
                payment_date: new Date().toISOString().slice(0, 10),
              });
              setShowPaymentModal(true);
            }}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-60"
            data-testid="record-payment-open"
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>
            {t("salaryAdvances.detail.recordPaymentBtn")}
          </button>
        )}
        {isAdmin && (advance.status === "paid" || advance.status === "recovery_scheduled" || advance.status === "reconciliation_required") && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => {
              setRecoveryForm({
                amount: String(advance.approved_amount ?? advance.amount),
                reference_doc: "PAYROLL",
                notes: "Full EOM recovery",
              });
              setShowRecoveryModal(true);
            }}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-60"
            data-testid="record-recovery-open"
          >
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
            {t("salaryAdvances.detail.recordRecoveryBtn")}
          </button>
        )}
        <Link href="/salary-advances" className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm">
          {t("salaryAdvances.detail.backToList")}
        </Link>
      </div>

      {/* Return for Correction Modal */}
      <ReturnModal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onConfirm={handleReturn}
        loading={returnLoading}
      />

      {/* Reject dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-base font-semibold text-neutral-900 mb-1">{t("salaryAdvances.detail.reject.title")}</h3>
              <p className="text-sm text-neutral-500 mb-4">{t("salaryAdvances.detail.reject.body")}</p>
              <textarea
                className="form-input w-full h-28 resize-none"
                placeholder={t("salaryAdvances.detail.reject.placeholder")}
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
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || actionLoading}
                onClick={handleReject}
                className="flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {t("salaryAdvances.detail.reject.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Part B — Finance certify worksheet */}
      {showCertifyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" data-testid="finance-certify-modal">
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">{t("salaryAdvances.detail.certify.title")}</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {t("salaryAdvances.detail.certify.subtitle")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  { key: "certify", label: "salaryAdvances.detail.certify.modeCertify" },
                  { key: "return", label: "common.return" },
                  { key: "not_eligible", label: "salaryAdvances.detail.certify.modeNotEligible" },
                ] as const).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setCertifyMode(m.key)}
                    className={`filter-tab${certifyMode === m.key ? " active" : ""}`}
                  >
                    {t(m.label)}
                  </button>
                ))}
              </div>

              {certifyMode === "certify" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label htmlFor="salary-advances-detail-confirmed-net-salary-setcertifyform-f-data-testi" className="block text-xs font-semibold text-neutral-700">
                      {t("salaryAdvances.detail.certify.net")} <span className="text-red-500">*</span>
                      <input id="salary-advances-detail-confirmed-net-salary-setcertifyform-f-data-testi"
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-input mt-1 w-full"
                        value={certifyForm.confirmed_net_salary}
                        onChange={(e) => setCertifyForm((f) => ({ ...f, confirmed_net_salary: e.target.value }))}
                        data-testid="certify-net-salary"
                      />
                    </label>
                    <label htmlFor="salary-advances-detail-confirmed-gross-optional-setcertifyform-f" className="block text-xs font-semibold text-neutral-700">
                      {t("salaryAdvances.detail.certify.gross")}
                      <input id="salary-advances-detail-confirmed-gross-optional-setcertifyform-f"
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-input mt-1 w-full"
                        value={certifyForm.confirmed_gross_salary}
                        onChange={(e) => setCertifyForm((f) => ({ ...f, confirmed_gross_salary: e.target.value }))}
                      />
                    </label>
                    <label htmlFor="salary-advances-detail-recommended-amount-setcertifyform-f-data-testid-" className="block text-xs font-semibold text-neutral-700">
                      {t("salaryAdvances.detail.certify.recommended")} <span className="text-red-500">*</span>
                      <input id="salary-advances-detail-recommended-amount-setcertifyform-f-data-testid-"
                        type="number"
                        min={1}
                        step="0.01"
                        className="form-input mt-1 w-full"
                        value={certifyForm.recommended_amount}
                        onChange={(e) => setCertifyForm((f) => ({ ...f, recommended_amount: e.target.value }))}
                        data-testid="certify-recommended-amount"
                      />
                    </label>
                    <label htmlFor="salary-advances-detail-recovery-payroll-date-setcertifyform-f-data-test" className="block text-xs font-semibold text-neutral-700">
                      {t("salaryAdvances.detail.certify.recoveryDate")} <span className="text-red-500">*</span>
                      <input id="salary-advances-detail-recovery-payroll-date-setcertifyform-f-data-test"
                        type="date"
                        className="form-input mt-1 w-full"
                        value={certifyForm.intended_recovery_payroll_date}
                        onChange={(e) => setCertifyForm((f) => ({ ...f, intended_recovery_payroll_date: e.target.value }))}
                        data-testid="certify-recovery-date"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    {t("salaryAdvances.detail.certify.basisPrefix")}{" "}
                    <span className="font-semibold">{t("salaryAdvances.detail.certify.basisValue")}</span>
                    .{" "}{t("salaryAdvances.detail.certify.basisSuffix")}
                  </p>
                  <label htmlFor="salary-advances-detail-comments-setcertifyform-f-placeholder-certificat" className="block text-xs font-semibold text-neutral-700">
                    {t("salaryAdvances.detail.certify.comments")}
                    <textarea id="salary-advances-detail-comments-setcertifyform-f-placeholder-certificat"
                      className="form-input mt-1 w-full h-20 resize-none"
                      value={certifyForm.comments}
                      onChange={(e) => setCertifyForm((f) => ({ ...f, comments: e.target.value }))}
                      placeholder={t("salaryAdvances.detail.certify.notesPlaceholder")}
                    />
                  </label>
                </div>
              ) : (
                <label htmlFor="salary-advances-detail-setactionreason-e-target-value-placeholder" className="block text-xs font-semibold text-neutral-700">
                  {certifyMode === "return" ? t("salaryAdvances.detail.certify.returnReason") : t("salaryAdvances.detail.certify.notEligibleReason")} <span className="text-red-500">*</span>
                  <textarea id="salary-advances-detail-setactionreason-e-target-value-placeholder"
                    className="form-input mt-1 w-full h-28 resize-none"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={certifyMode === "return" ? t("salaryAdvances.detail.certify.returnPlaceholder") : t("salaryAdvances.detail.certify.notEligiblePlaceholder")}
                  />
                </label>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button type="button" onClick={() => setShowCertifyModal(false)} className="btn-secondary py-2 px-4 text-sm">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleFinanceCertifySubmit}
                className="btn-primary py-2 px-4 text-sm disabled:opacity-60"
                data-testid="finance-certify-submit"
              >
                {certifyMode === "certify"
                  ? t("salaryAdvances.detail.certify.modeCertify")
                  : certifyMode === "return"
                    ? t("salaryAdvances.detail.certify.returnToRequester")
                    : t("salaryAdvances.detail.certify.markNotEligible")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" data-testid="payment-modal">
            <div className="p-6 space-y-3">
              <h3 className="text-base font-semibold text-neutral-900">{t("salaryAdvances.detail.payment.title")}</h3>
              <p className="text-sm text-neutral-500">{t("salaryAdvances.detail.payment.subtitle")}</p>
              <label htmlFor="salary-advances-detail-payment-reference-setpaymentform-f-data-testid-p" className="block text-xs font-semibold text-neutral-700">
                {t("salaryAdvances.detail.payment.reference")} <span className="text-red-500">*</span>
                <input id="salary-advances-detail-payment-reference-setpaymentform-f-data-testid-p"
                  type="text"
                  className="form-input mt-1 w-full"
                  value={paymentForm.payment_reference}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, payment_reference: e.target.value }))}
                  data-testid="payment-reference"
                />
              </label>
              <label htmlFor="salary-advances-detail-method-setpaymentform-f-bank-transfer-cash-chequ" className="block text-xs font-semibold text-neutral-700">
                {t("salaryAdvances.detail.payment.method")}
                <select id="salary-advances-detail-method-setpaymentform-f-bank-transfer-cash-chequ"
                  className="form-input mt-1 w-full"
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, payment_method: e.target.value }))}
                >
                  <option value="bank_transfer">{t("salaryAdvances.detail.payment.bankTransfer")}</option>
                  <option value="cash">{t("salaryAdvances.detail.payment.cash")}</option>
                  <option value="cheque">{t("salaryAdvances.detail.payment.cheque")}</option>
                  <option value="other">{t("salaryAdvances.type.other")}</option>
                </select>
              </label>
              <label htmlFor="salary-advances-detail-payment-date-setpaymentform-f" className="block text-xs font-semibold text-neutral-700">
                {t("salaryAdvances.detail.payment.date")}
                <input id="salary-advances-detail-payment-date-setpaymentform-f"
                  type="date"
                  className="form-input mt-1 w-full"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, payment_date: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary py-2 px-4 text-sm">{t("common.cancel")}</button>
              <button
                type="button"
                disabled={actionLoading || !paymentForm.payment_reference.trim()}
                onClick={handleRecordPaymentSubmit}
                className="btn-primary py-2 px-4 text-sm disabled:opacity-60"
              >
                {t("salaryAdvances.detail.payment.title")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record recovery modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" data-testid="recovery-modal">
            <div className="p-6 space-y-3">
              <h3 className="text-base font-semibold text-neutral-900">{t("salaryAdvances.detail.recovery.title")}</h3>
              <p className="text-sm text-neutral-500">{t("salaryAdvances.detail.recovery.subtitle")}</p>
              <label htmlFor="salary-advances-detail-amount-setrecoveryform-f-data-testid-recovery-am" className="block text-xs font-semibold text-neutral-700">
                {t("salaryAdvances.detail.recovery.amount")} <span className="text-red-500">*</span>
                <input id="salary-advances-detail-amount-setrecoveryform-f-data-testid-recovery-am"
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="form-input mt-1 w-full"
                  value={recoveryForm.amount}
                  onChange={(e) => setRecoveryForm((f) => ({ ...f, amount: e.target.value }))}
                  data-testid="recovery-amount"
                />
              </label>
              <label htmlFor="salary-advances-detail-payroll-transaction-reference-setrecoveryform-f-" className="block text-xs font-semibold text-neutral-700">
                {t("salaryAdvances.detail.recovery.reference")} <span className="text-red-500">*</span>
                <input id="salary-advances-detail-payroll-transaction-reference-setrecoveryform-f-"
                  type="text"
                  required
                  className="form-input mt-1 w-full"
                  placeholder={t("salaryAdvances.detail.recovery.referencePlaceholder")}
                  value={recoveryForm.reference_doc}
                  onChange={(e) => setRecoveryForm((f) => ({ ...f, reference_doc: e.target.value }))}
                  data-testid="recovery-reference"
                />
              </label>
              <label htmlFor="salary-advances-detail-notes-setrecoveryform-f" className="block text-xs font-semibold text-neutral-700">
                {t("salaryAdvances.detail.recovery.notes")}
                <textarea id="salary-advances-detail-notes-setrecoveryform-f"
                  className="form-input mt-1 w-full h-20 resize-none"
                  value={recoveryForm.notes}
                  onChange={(e) => setRecoveryForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button type="button" onClick={() => setShowRecoveryModal(false)} className="btn-secondary py-2 px-4 text-sm">{t("common.cancel")}</button>
              <button
                type="button"
                disabled={actionLoading || !recoveryForm.amount || !recoveryForm.reference_doc.trim()}
                onClick={handleRecordRecoverySubmit}
                className="btn-primary py-2 px-4 text-sm disabled:opacity-60"
              >
                {t("salaryAdvances.detail.recovery.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
