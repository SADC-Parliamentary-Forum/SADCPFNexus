"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { imprestApi, type ImprestRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useFormatDate } from "@/lib/useFormatDate";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { PrintButton } from "@/components/ui/PrintButton";
import { Stepper } from "@/components/ui/Stepper";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { WorkflowStatusBanner } from "@/components/workflow/WorkflowStatusBanner";
import { ReturnModal } from "@/components/workflow/ReturnModal";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:                { label: "status.approved",               cls: "text-green-700 bg-green-50 border-green-200",        icon: "check_circle" },
  submitted:               { label: "status.pending",                cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "pending"      },
  rejected:                { label: "status.rejected",               cls: "text-red-700 bg-red-50 border-red-200",              icon: "cancel"       },
  draft:                   { label: "status.draft",                  cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note"    },
  liquidated:              { label: "imprest.status.liquidated",             cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "task_alt"     },
  returned_for_correction: { label: "imprest.status.returnedForCorrection", cls: "text-amber-700 bg-amber-50 border-amber-200",       icon: "undo"         },
  withdrawn:               { label: "imprest.status.withdrawn",              cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "block"        },
};

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-neutral-100 rounded" />
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="h-4 w-36 bg-neutral-100 rounded" />
    </div>
  );
}

export default function ImprestDetailPage() {
  const { success, error: showErrorToast, info } = useToast();
  const { t } = useI18n();
  const { fmt } = useFormatDate();
  const params = useParams();
  const id = Number(params?.id);
  const [request, setRequest] = useState<ImprestRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const { confirm } = useConfirm();
  // Retirement wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [retireAmount, setRetireAmount] = useState("");
  const [retireNotes, setRetireNotes] = useState("");
  const [retireReceipts, setRetireReceipts] = useState(true);
  const [retireError, setRetireError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError(t("imprest.certificate.invalidId"));
      return;
    }
    imprestApi.get(id)
      .then((res) => setRequest((res.data as any).data ?? res.data))
      .catch(() => setError(t("imprest.detail.loadFailed")))
      .finally(() => setLoading(false));
  }, [id, t]);

  const refreshRequest = async () => {
    const res = await imprestApi.get(id);
    setRequest((res.data as any).data ?? res.data);
  };


  const handleApprove = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      const res = await imprestApi.approve(request.id);
      const notified: string[] = (res.data as any).notified_approvers ?? [];
      await refreshRequest();
      if (notified.length > 0) {
        success(t("imprest.detail.approvedNotified", { names: notified.join(", ") }));
      } else {
        success(t("imprest.detail.fullyApproved"));
      }
    } catch {
      setError(t("imprest.detail.approveFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetire = async () => {
    if (!request) return;
    const amount = parseFloat(retireAmount);
    if (isNaN(amount) || amount <= 0) { setRetireError(t("imprest.detail.invalidAmount")); return; }
    setActionLoading(true);
    setRetireError(null);
    try {
      await imprestApi.retire(request.id, { amount_liquidated: amount, notes: retireNotes.trim() || undefined, receipts_attached: retireReceipts });
      const res = await imprestApi.get(request.id);
      setRequest((res.data as any).data ?? res.data);
      setShowWizard(false);
      setWizardStep(1);
      setRetireAmount("");
      setRetireNotes("");
      setRetireReceipts(true);
    } catch (e: unknown) {
      const msg = (e as any)?.response?.data?.message ?? t("imprest.detail.retireFailed");
      setRetireError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const openWizard = () => {
    setShowWizard(true);
    setWizardStep(1);
    setRetireAmount("");
    setRetireNotes("");
    setRetireReceipts(true);
    setRetireError(null);
  };

  const handleReject = async () => {
    if (!request || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await imprestApi.reject(request.id, rejectReason.trim());
      await refreshRequest();
      setShowRejectModal(false);
      setRejectReason("");
    } catch {
      setError(t("imprest.detail.rejectFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async (comment: string) => {
    if (!request) return;
    setReturnLoading(true);
    try {
      await imprestApi.returnForCorrection(request.id, comment);
      await refreshRequest();
      setShowReturnModal(false);
      success(t("imprest.detail.returned"));
    } catch {
      setError(t("imprest.detail.returnFailed"));
    } finally {
      setReturnLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!request) return;
    if (!(await confirm({ title: t("imprest.detail.withdrawTitle"), message: t("imprest.detail.withdrawMessage"), variant: "danger" }))) return;
    setActionLoading(true);
    try {
      await imprestApi.withdraw(request.id);
      await refreshRequest();
      success(t("imprest.list.withdrawn"));
    } catch {
      setError(t("imprest.list.withdrawFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!request) return;
    if (!(await confirm({ title: t("imprest.detail.resubmitTitle"), message: t("imprest.detail.resubmitMessage"), variant: "primary" }))) return;
    setActionLoading(true);
    try {
      await imprestApi.resubmit(request.id);
      await refreshRequest();
      success(t("imprest.detail.resubmitted"));
    } catch {
      setError(t("imprest.detail.resubmitFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse" />
        <div className="h-7 w-64 bg-neutral-100 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[20px] flex-shrink-0 mt-0.5">error_outline</span>
          <div>
            <p className="text-sm font-semibold text-red-700">{t("imprest.detail.errorLoading")}</p>
            <p className="text-sm text-red-600 mt-0.5">{error ?? t("imprest.detail.notFound")}</p>
          </div>
        </div>
        <Link href="/imprest" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t("imprest.backToList")}
        </Link>
      </div>
    );
  }

  const sBase = statusConfig[request.status] ?? statusConfig.draft;
  const s = { ...sBase, label: t(sBase.label) };
  const approvalRequest = (request as any).approval_request;
  const currentStep = approvalRequest?.workflow?.steps?.[approvalRequest?.current_step_index];
  const canReturn = approvalRequest?.status === "pending" && currentStep?.allow_return;
  const isReturnedForCorrection = request.status === "returned_for_correction";
  const daysLeft = Math.ceil((new Date(request.expected_liquidation_date).getTime() - Date.now()) / 86400000);
  const liquidationPct = request.amount_approved && request.amount_liquidated
    ? Math.min(100, (request.amount_liquidated / request.amount_approved) * 100)
    : 0;

  return (
    <div className="w-full min-w-0 space-y-5">
      <WorkflowStatusBanner
        status={request.status}
        currentStage={currentStep?.name ?? currentStep?.role_name ?? null}
        currentHolder={null}
      />

      <ModulePageHeader
        title={t("imprest.detail.title")}
        subtitle={request.purpose}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.imprest", href: "/imprest" },
              { label: request.reference_number },
            ]}
          />
        }
      />
      <div>
        <div className="flex items-start justify-between gap-4">
          <div />
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {request.status === "approved" && (
              <Link
                href={`/imprest/${request.id}/certificate`}
                className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                {t("imprest.certificate.crumb")}
              </Link>
            )}
            {request.status === "submitted" && approvalRequest?.status === "pending" && (
              <button
                onClick={handleWithdraw}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">block</span>
                {t("imprest.list.withdraw")}
              </button>
            )}
            {isReturnedForCorrection && (
              <button
                onClick={handleResubmit}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                {t("imprest.detail.resubmit")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Returned for correction banner */}
      {isReturnedForCorrection && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="material-symbols-outlined text-[18px] text-amber-600 flex-shrink-0 mt-0.5">undo</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">{t("imprest.status.returnedForCorrection")}</p>
            <p className="text-xs text-amber-700 mt-0.5">{t("imprest.detail.returnedHint")}</p>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <SectionIcon icon="timeline" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("imprest.detail.progress")}</h3>
          </div>
          <PrintButton className="text-xs" />
        </div>
        <StatusTimeline
          steps={[
            { key: "draft",      label: t("status.draft"),      icon: "edit_note",       completedAt: request.submitted_at ?? undefined },
            { key: "submitted",  label: t("status.submitted"),  icon: "send",            completedAt: request.submitted_at },
            { key: "approved",   label: t("status.approved"),   icon: "check_circle",    completedAt: request.approved_at },
            { key: "liquidated", label: t("imprest.status.liquidated"), icon: "receipt_long",    completedAt: request.liquidated_at },
          ]}
          currentStatus={request.status}
          rejectedAt={request.status === "rejected" ? (request.approved_at ?? request.submitted_at) : null}
          rejectionReason={request.rejection_reason}
        />
      </div>

      {/* Approval Timeline */}
      <ApprovalTimeline request={approvalRequest} />

      {/* Amount summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: t("imprest.detail.requested"),
            value: `${request.currency} ${request.amount_requested.toLocaleString()}`,
            icon: "account_balance_wallet",
            color: "text-neutral-700",
            iconColor: "text-neutral-500",
            bg: "bg-neutral-50",
          },
          {
            label: t("status.approved"),
            value: request.amount_approved != null
              ? `${request.currency} ${request.amount_approved.toLocaleString()}`
              : t("status.pending"),
            icon: "check_circle",
            color: "text-green-600",
            iconColor: "text-green-500",
            bg: "bg-green-50",
          },
          {
            label: t("imprest.status.liquidated"),
            value: request.amount_liquidated != null
              ? `${request.currency} ${request.amount_liquidated.toLocaleString()}`
              : t("status.pending"),
            icon: "receipt_long",
            color: "text-blue-600",
            iconColor: "text-blue-500",
            bg: "bg-blue-50",
          },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg} mb-3`}>
              <span className={`material-symbols-outlined text-[16px] ${item.iconColor}`}>{item.icon}</span>
            </div>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wide mb-0.5">{item.label}</p>
            <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Liquidation progress bar (if approved) */}
      {request.status === "approved" || request.status === "liquidated" ? (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-neutral-500">{t("imprest.detail.liquidationProgress")}</p>
            <p className="text-xs font-bold text-neutral-700">{liquidationPct.toFixed(0)}%</p>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${liquidationPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-neutral-400">
              {t("imprest.detail.due", { date: request.expected_liquidation_date })}
            </p>
            {daysLeft > 0 && daysLeft <= 5 && (
              <span className="badge badge-warning text-[10px]">{t("imprest.detail.daysLeft", { days: daysLeft })}</span>
            )}
            {daysLeft <= 0 && request.status !== "liquidated" && (
              <span className="badge badge-danger text-[10px]">{t("correspondence.hub.overdue")}</span>
            )}
          </div>
        </div>
      ) : null}

      {/* Submitted By */}
      {request.requester && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="badge" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("imprest.detail.submittedBy")}</h3>
            {request.submitted_at && (
              <span className="ml-auto text-xs text-neutral-400">
                {fmt(request.submitted_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {request.requester.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{request.requester.name}</p>
              <p className="text-xs text-neutral-400">{[request.requester.job_title, request.requester.employee_number].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Request Details */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="account_balance_wallet" color="text-amber-600" bg="bg-amber-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("imprest.detail.details")}</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">account_tree</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("imprest.create.budgetLine")}</p>
            </div>
            <p className="font-mono text-xs text-neutral-900">{request.budget_line}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">calendar_today</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("imprest.liquidate.deadline")}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-neutral-900">{request.expected_liquidation_date}</p>
              {daysLeft > 0 && daysLeft <= 5 && (
                <span className="badge badge-warning text-[10px]">{t("imprest.detail.daysLeft", { days: daysLeft })}</span>
              )}
              {daysLeft <= 0 && request.status !== "liquidated" && (
                <span className="badge badge-danger text-[10px]">{t("correspondence.hub.overdue")}</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-50">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-[14px] text-neutral-300">description</span>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("imprest.create.purposeLabel")}</p>
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed">{request.purpose}</p>
        </div>
        {request.justification && (
          <div className="mt-3 pt-3 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">chat_bubble</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("imprest.create.step.justification")}</p>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{request.justification}</p>
          </div>
        )}
      </div>

      {/* Reviewer/Approver */}
      {request.approver && request.status !== "submitted" && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon
              icon={request.status === "approved" ? "verified" : "cancel"}
              color={request.status === "approved" ? "text-green-600" : "text-red-600"}
              bg={request.status === "approved" ? "bg-green-50" : "bg-red-50"}
            />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              {request.status === "approved" ? t("imprest.detail.approvedBy") : t("imprest.detail.reviewedBy")}
            </h3>
            {request.approved_at && (
              <span className="ml-auto text-xs text-neutral-400">
                {fmt(request.approved_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${request.status === "approved" ? "bg-green-50" : "bg-red-50"}`}>
              <span className={`material-symbols-outlined text-[18px] ${request.status === "approved" ? "text-green-600" : "text-red-600"}`}>
                {request.status === "approved" ? "how_to_reg" : "person_off"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{request.approver.name}</p>
              <p className="text-xs text-neutral-400">{request.approver.job_title ?? ""}</p>
            </div>
          </div>
          {request.rejection_reason && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-3.5 flex items-start gap-2">
              <span className="material-symbols-outlined text-red-400 text-[16px] flex-shrink-0 mt-0.5">info</span>
              <p className="text-sm text-red-700">{request.rejection_reason}</p>
            </div>
          )}
        </div>
      )}

      {/* Retirement / Liquidation Wizard */}
      {request.status === "approved" && request.amount_liquidated == null && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <SectionIcon icon="receipt_long" color="text-blue-600" bg="bg-blue-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("imprest.detail.retireTitle")}</h3>
            {!showWizard && (
              <div className="ml-auto">
                <button type="button" onClick={openWizard} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  {t("imprest.detail.submitRetirement")}
                </button>
              </div>
            )}
          </div>

          {!showWizard ? (
            <p className="text-sm text-neutral-600">
              {t("imprest.detail.retireIntro", { amount: `${request.currency} ${(request.amount_approved ?? 0).toLocaleString()}`, date: fmt(request.expected_liquidation_date) })}
            </p>
          ) : (
            <div className="space-y-6">
              {/* Stepper */}
              <Stepper
                steps={[
                  { label: t("imprest.detail.wizard.summary"),   description: t("imprest.detail.wizard.summaryDesc")   },
                  { label: t("imprest.detail.wizard.receipts"),  description: t("imprest.detail.wizard.receiptsDesc") },
                  { label: t("imprest.detail.wizard.confirm"),   description: t("common.submit")           },
                ]}
                currentStep={wizardStep}
              />

              {/* ── Step 1: Summary ── */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">{t("imprest.detail.originalDetails")}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] text-neutral-400 uppercase tracking-wide mb-0.5">{t("correspondence.col.reference")}</p>
                        <p className="font-mono font-semibold text-neutral-800">{request.reference_number}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-400 uppercase tracking-wide mb-0.5">{t("imprest.create.purposeLabel")}</p>
                        <p className="font-medium text-neutral-800">{request.purpose}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-400 uppercase tracking-wide mb-0.5">{t("imprest.certificate.amountApproved")}</p>
                        <p className="text-lg font-bold text-green-700">{request.currency} {(request.amount_approved ?? 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-400 uppercase tracking-wide mb-0.5">{t("imprest.liquidate.deadline")}</p>
                        <p className={cn("font-semibold", daysLeft <= 0 ? "text-red-600" : daysLeft <= 5 ? "text-amber-600" : "text-neutral-800")}>
                          {fmt(request.expected_liquidation_date)}
                          {daysLeft <= 0
                            ? ` — ${t("correspondence.hub.overdue")}`
                            : daysLeft <= 5
                              ? ` — ${t("imprest.detail.daysLeft", { days: daysLeft })}`
                              : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setWizardStep(2)} className="btn-primary py-2 px-5 text-sm flex items-center gap-2">
                      {t("imprest.detail.nextReceipts")}
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Receipts ── */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="imprest-retire-amount" className="block text-xs font-semibold text-neutral-700 mb-1">
                        {t("imprest.liquidate.amountSpent", { currency: request.currency })} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="imprest-retire-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input w-full"
                        placeholder={t("imprest.detail.max", { amount: request.amount_approved ?? request.amount_requested })}
                        value={retireAmount}
                        onChange={(e) => setRetireAmount(e.target.value)}
                      />
                      {request.amount_approved && retireAmount && Number(retireAmount) > request.amount_approved && (
                        <p className="text-xs text-amber-600 mt-1">{t("imprest.detail.exceeds")}</p>
                      )}
                      {request.amount_approved && retireAmount && Number(retireAmount) < request.amount_approved && Number(retireAmount) > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          {t("imprest.detail.surplusReturn", { amount: `${request.currency} ${(request.amount_approved - Number(retireAmount)).toLocaleString()}` })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="imprest-retire-notes" className="block text-xs font-semibold text-neutral-700 mb-1">{t("imprest.liquidate.notes")}</label>
                      <input
                        id="imprest-retire-notes"
                        type="text"
                        className="form-input w-full"
                        placeholder={t("imprest.detail.notesPlaceholder")}
                        value={retireNotes}
                        onChange={(e) => setRetireNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                    <p className="text-xs font-semibold text-neutral-600 mb-2">{t("imprest.detail.receiptUpload")}</p>
                    <label htmlFor="imprest-retire-receipts" className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        id="imprest-retire-receipts"
                        type="checkbox"
                        checked={retireReceipts}
                        onChange={(e) => setRetireReceipts(e.target.checked)}
                        className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
                      />
                      <span className="text-sm text-neutral-700">
                        {t("imprest.detail.confirmReceipts")}
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-between">
                    <button type="button" onClick={() => setWizardStep(1)} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      {t("common.back")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRetireError(null); setWizardStep(3); }}
                      disabled={!retireAmount || Number(retireAmount) <= 0}
                      className="btn-primary py-2 px-5 text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {t("imprest.detail.nextConfirm")}
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Confirm & Submit ── */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  {retireError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error_outline</span>
                      {retireError}
                    </div>
                  )}

                  <div className="rounded-xl border border-neutral-200 overflow-hidden">
                    <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-100">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("imprest.detail.retirementSummary")}</p>
                    </div>
                    <div className="p-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">{t("imprest.detail.approvedAmount")}</span>
                        <span className="font-semibold text-neutral-800">
                          {request.currency} {(request.amount_approved ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">{t("imprest.detail.amountSpent")}</span>
                        <span className="font-bold text-neutral-900">
                          {request.currency} {Number(retireAmount).toLocaleString()}
                        </span>
                      </div>
                      {request.amount_approved && Number(retireAmount) !== request.amount_approved && (
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                          <span className={cn("text-sm font-semibold", Number(retireAmount) > (request.amount_approved ?? 0) ? "text-red-600" : "text-blue-600")}>
                            {Number(retireAmount) > (request.amount_approved ?? 0) ? t("imprest.detail.overBy") : t("imprest.detail.surplusToReturn")}
                          </span>
                          <span className={cn("font-bold", Number(retireAmount) > (request.amount_approved ?? 0) ? "text-red-600" : "text-blue-600")}>
                            {request.currency} {Math.abs((request.amount_approved ?? 0) - Number(retireAmount)).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">{t("imprest.detail.receiptsAttached")}</span>
                        <span className={cn("font-semibold", retireReceipts ? "text-green-700" : "text-amber-600")}>
                          {retireReceipts ? t("imprest.detail.yes") : t("imprest.detail.noSeparately")}
                        </span>
                      </div>
                      {retireNotes && (
                        <div className="pt-2 border-t border-neutral-100">
                          <span className="text-neutral-400 text-xs">{t("imprest.detail.notesLabel")} </span>
                          <span className="text-neutral-700 text-sm">{retireNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-[18px] flex-shrink-0 mt-0.5">info</span>
                    <p className="text-xs text-amber-700">
                      {t("imprest.detail.retireWarning")}
                    </p>
                  </div>

                  <div className="flex justify-between">
                    <button type="button" onClick={() => setWizardStep(2)} disabled={actionLoading} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      {t("common.back")}
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowWizard(false); setWizardStep(1); setRetireError(null); }}
                        disabled={actionLoading}
                        className="btn-secondary py-2 px-4 text-sm"
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={handleRetire}
                        disabled={actionLoading}
                        className="btn-primary flex items-center gap-2 py-2 px-5 text-sm disabled:opacity-60"
                      >
                        {actionLoading
                          ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                          : <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        }
                        {actionLoading ? t("imprest.create.submitting") : t("imprest.detail.submitRetirement")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Approval Decision */}
      {request.status === "submitted" && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="gavel" color="text-amber-600" bg="bg-amber-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("imprest.detail.decision")}</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">{t("imprest.detail.decisionHint")}</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {actionLoading ? t("correspondence.detail.processing") : t("imprest.detail.approve")}
            </button>
            {canReturn && (
              <button
                onClick={() => setShowReturnModal(true)}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
                {t("common.return")}
              </button>
            )}
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              {t("common.reject")}
            </button>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link href="/imprest" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        {t("imprest.backToList")}
      </Link>

      {/* Return for Correction Modal */}
      <ReturnModal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onConfirm={handleReturn}
        loading={returnLoading}
      />

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-md w-full shadow-2xl border border-neutral-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-red-600 text-[20px]">cancel</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">{t("imprest.detail.rejectTitle")}</h3>
                <p className="text-xs text-neutral-400">{t("imprest.detail.reasonRequired")}</p>
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("imprest.detail.rejectPlaceholder")}
              rows={3}
              className="form-input resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="btn-secondary flex-1 justify-center"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? t("imprest.detail.rejecting") : t("imprest.detail.confirmRejection")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
