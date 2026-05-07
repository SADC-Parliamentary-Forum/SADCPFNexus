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
import { ReturnModal } from "@/components/workflow/ReturnModal";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:                { label: "Approved",               cls: "text-green-700 bg-green-50 border-green-200",        icon: "check_circle" },
  submitted:               { label: "Pending",                cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "pending"      },
  rejected:                { label: "Rejected",               cls: "text-red-700 bg-red-50 border-red-200",              icon: "cancel"       },
  draft:                   { label: "Draft",                  cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note"    },
  liquidated:              { label: "Liquidated",             cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "task_alt"     },
  returned_for_correction: { label: "Returned for Correction", cls: "text-amber-700 bg-amber-50 border-amber-200",       icon: "undo"         },
  withdrawn:               { label: "Withdrawn",              cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "block"        },
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
  const [toast, setToast] = useState<string | null>(null);
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
      setError("Invalid request ID.");
      return;
    }
    imprestApi.get(id)
      .then((res) => setRequest((res.data as any).data ?? res.data))
      .catch(() => setError("Failed to load imprest request."))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshRequest = async () => {
    const res = await imprestApi.get(id);
    setRequest((res.data as any).data ?? res.data);
  };

  const showToastMsg = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  };

  const handleApprove = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      const res = await imprestApi.approve(request.id);
      const notified: string[] = (res.data as any).notified_approvers ?? [];
      await refreshRequest();
      if (notified.length > 0) {
        showToastMsg(`Approved. Notified: ${notified.join(", ")}`);
      } else {
        showToastMsg("Request fully approved.");
      }
    } catch {
      setError("Failed to approve request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetire = async () => {
    if (!request) return;
    const amount = parseFloat(retireAmount);
    if (isNaN(amount) || amount <= 0) { setRetireError("Please enter a valid amount."); return; }
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
      const msg = (e as any)?.response?.data?.message ?? "Failed to submit retirement.";
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
      setError("Failed to reject request.");
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
      showToastMsg("Request returned to requester for correction.");
    } catch {
      setError("Failed to return request.");
    } finally {
      setReturnLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!request) return;
    if (!(await confirm({ title: "Withdraw Request", message: "Withdraw this imprest request? This cannot be undone.", variant: "danger" }))) return;
    setActionLoading(true);
    try {
      await imprestApi.withdraw(request.id);
      await refreshRequest();
      showToastMsg("Request withdrawn.");
    } catch {
      setError("Failed to withdraw request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!request) return;
    if (!(await confirm({ title: "Resubmit Request", message: "Resubmit this imprest request for approval? It will restart from the first step.", variant: "primary" }))) return;
    setActionLoading(true);
    try {
      await imprestApi.resubmit(request.id);
      await refreshRequest();
      showToastMsg("Request resubmitted for approval.");
    } catch {
      setError("Failed to resubmit request.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
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
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[20px] flex-shrink-0 mt-0.5">error_outline</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Error loading request</p>
            <p className="text-sm text-red-600 mt-0.5">{error ?? "Request not found."}</p>
          </div>
        </div>
        <Link href="/imprest" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Imprest Requests
        </Link>
      </div>
    );
  }

  const s = statusConfig[request.status] ?? statusConfig.draft;
  const approvalRequest = (request as any).approval_request;
  const currentStep = approvalRequest?.workflow?.steps?.[approvalRequest?.current_step_index];
  const canReturn = approvalRequest?.status === "pending" && currentStep?.allow_return;
  const isReturnedForCorrection = request.status === "returned_for_correction";
  const daysLeft = Math.ceil((new Date(request.expected_liquidation_date).getTime() - Date.now()) / 86400000);
  const liquidationPct = request.amount_approved && request.amount_liquidated
    ? Math.min(100, (request.amount_liquidated / request.amount_approved) * 100)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-green-600 text-white px-4 py-3 text-sm font-semibold shadow-lg">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {toast}
        </div>
      )}

      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3">
          <Link href="/imprest" className="hover:text-primary transition-colors font-medium">Imprest</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-mono text-neutral-500">{request.reference_number}</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Imprest Request</h1>
            <p className="text-sm text-neutral-500 mt-0.5 line-clamp-1">{request.purpose}</p>
          </div>
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
                Certificate
              </Link>
            )}
            {request.status === "submitted" && approvalRequest?.status === "pending" && (
              <button
                onClick={handleWithdraw}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">block</span>
                Withdraw
              </button>
            )}
            {isReturnedForCorrection && (
              <button
                onClick={handleResubmit}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Resubmit
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
            <p className="text-sm font-semibold text-amber-800">Returned for Correction</p>
            <p className="text-xs text-amber-700 mt-0.5">Make the required corrections and resubmit this request.</p>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <SectionIcon icon="timeline" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Request Progress</h3>
          </div>
          <PrintButton className="text-xs" />
        </div>
        <StatusTimeline
          steps={[
            { key: "draft",      label: "Draft",      icon: "edit_note",       completedAt: request.submitted_at ?? undefined },
            { key: "submitted",  label: "Submitted",  icon: "send",            completedAt: request.submitted_at },
            { key: "approved",   label: "Approved",   icon: "check_circle",    completedAt: request.approved_at },
            { key: "liquidated", label: "Liquidated", icon: "receipt_long",    completedAt: request.liquidated_at },
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
            label: "Requested",
            value: `${request.currency} ${request.amount_requested.toLocaleString()}`,
            icon: "account_balance_wallet",
            color: "text-neutral-700",
            iconColor: "text-neutral-500",
            bg: "bg-neutral-50",
          },
          {
            label: "Approved",
            value: request.amount_approved != null
              ? `${request.currency} ${request.amount_approved.toLocaleString()}`
              : "Pending",
            icon: "check_circle",
            color: "text-green-600",
            iconColor: "text-green-500",
            bg: "bg-green-50",
          },
          {
            label: "Liquidated",
            value: request.amount_liquidated != null
              ? `${request.currency} ${request.amount_liquidated.toLocaleString()}`
              : "Pending",
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
            <p className="text-xs font-semibold text-neutral-500">Liquidation Progress</p>
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
              Due: {request.expected_liquidation_date}
            </p>
            {daysLeft > 0 && daysLeft <= 5 && (
              <span className="badge badge-warning text-[10px]">{daysLeft}d left</span>
            )}
            {daysLeft <= 0 && request.status !== "liquidated" && (
              <span className="badge badge-danger text-[10px]">Overdue</span>
            )}
          </div>
        </div>
      ) : null}

      {/* Submitted By */}
      {request.requester && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="badge" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Submitted By</h3>
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Request Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">account_tree</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Budget Line</p>
            </div>
            <p className="font-mono text-xs text-neutral-900">{request.budget_line}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">calendar_today</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Liquidation Deadline</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-neutral-900">{request.expected_liquidation_date}</p>
              {daysLeft > 0 && daysLeft <= 5 && (
                <span className="badge badge-warning text-[10px]">{daysLeft}d left</span>
              )}
              {daysLeft <= 0 && request.status !== "liquidated" && (
                <span className="badge badge-danger text-[10px]">Overdue</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-50">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-[14px] text-neutral-300">description</span>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Purpose</p>
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed">{request.purpose}</p>
        </div>
        {request.justification && (
          <div className="mt-3 pt-3 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">chat_bubble</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Justification</p>
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
              {request.status === "approved" ? "Approved By" : "Reviewed By"}
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Retire / Liquidate Imprest</h3>
            {!showWizard && (
              <div className="ml-auto">
                <button type="button" onClick={openWizard} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  Submit Retirement
                </button>
              </div>
            )}
          </div>

          {!showWizard ? (
            <p className="text-sm text-neutral-600">
              This imprest has been approved for{" "}
              <strong>{request.currency} {(request.amount_approved ?? 0).toLocaleString()}</strong>.
              Submit your retirement with receipts before{" "}
              <strong>{fmt(request.expected_liquidation_date)}</strong>.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Stepper */}
              <Stepper
                steps={[
                  { label: "Summary",   description: "Review details"   },
                  { label: "Receipts",  description: "Expenditure info" },
                  { label: "Confirm",   description: "Submit"           },
                ]}
                currentStep={wizardStep}
              />

              {/* ── Step 1: Summary ── */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Original Imprest Details</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] text-neutral-400 uppercase tracking-wide mb-0.5">Reference</p>
                        <p className="font-mono font-semibold text-neutral-800">{request.reference_number}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-400 uppercase tracking-wide mb-0.5">Purpose</p>
                        <p className="font-medium text-neutral-800">{request.purpose}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-400 uppercase tracking-wide mb-0.5">Amount Approved</p>
                        <p className="text-lg font-bold text-green-700">{request.currency} {(request.amount_approved ?? 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-400 uppercase tracking-wide mb-0.5">Liquidation Deadline</p>
                        <p className={cn("font-semibold", daysLeft <= 0 ? "text-red-600" : daysLeft <= 5 ? "text-amber-600" : "text-neutral-800")}>
                          {fmt(request.expected_liquidation_date)}
                          {daysLeft <= 0
                            ? " — Overdue"
                            : daysLeft <= 5
                              ? ` — ${daysLeft}d left`
                              : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setWizardStep(2)} className="btn-primary py-2 px-5 text-sm flex items-center gap-2">
                      Next: Receipts
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
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Amount Spent ({request.currency}) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input w-full"
                        placeholder={`Max: ${request.amount_approved ?? request.amount_requested}`}
                        value={retireAmount}
                        onChange={(e) => setRetireAmount(e.target.value)}
                      />
                      {request.amount_approved && retireAmount && Number(retireAmount) > request.amount_approved && (
                        <p className="text-xs text-amber-600 mt-1">Amount exceeds approved value</p>
                      )}
                      {request.amount_approved && retireAmount && Number(retireAmount) < request.amount_approved && Number(retireAmount) > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          Surplus: {request.currency} {(request.amount_approved - Number(retireAmount)).toLocaleString()} to be returned
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Notes / Explanation</label>
                      <input
                        type="text"
                        className="form-input w-full"
                        placeholder="Optional: notes on expenditure"
                        value={retireNotes}
                        onChange={(e) => setRetireNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                    <p className="text-xs font-semibold text-neutral-600 mb-2">Receipt Upload</p>
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={retireReceipts}
                        onChange={(e) => setRetireReceipts(e.target.checked)}
                        className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
                      />
                      <span className="text-sm text-neutral-700">
                        I confirm receipts / supporting documents are attached or will be submitted to Finance
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-between">
                    <button type="button" onClick={() => setWizardStep(1)} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRetireError(null); setWizardStep(3); }}
                      disabled={!retireAmount || Number(retireAmount) <= 0}
                      className="btn-primary py-2 px-5 text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      Next: Confirm
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
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Retirement Summary</p>
                    </div>
                    <div className="p-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Approved amount</span>
                        <span className="font-semibold text-neutral-800">
                          {request.currency} {(request.amount_approved ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Amount spent</span>
                        <span className="font-bold text-neutral-900">
                          {request.currency} {Number(retireAmount).toLocaleString()}
                        </span>
                      </div>
                      {request.amount_approved && Number(retireAmount) !== request.amount_approved && (
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                          <span className={cn("text-sm font-semibold", Number(retireAmount) > (request.amount_approved ?? 0) ? "text-red-600" : "text-blue-600")}>
                            {Number(retireAmount) > (request.amount_approved ?? 0) ? "Over by" : "Surplus to return"}
                          </span>
                          <span className={cn("font-bold", Number(retireAmount) > (request.amount_approved ?? 0) ? "text-red-600" : "text-blue-600")}>
                            {request.currency} {Math.abs((request.amount_approved ?? 0) - Number(retireAmount)).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Receipts attached</span>
                        <span className={cn("font-semibold", retireReceipts ? "text-green-700" : "text-amber-600")}>
                          {retireReceipts ? "Yes" : "No — to be submitted separately"}
                        </span>
                      </div>
                      {retireNotes && (
                        <div className="pt-2 border-t border-neutral-100">
                          <span className="text-neutral-400 text-xs">Notes: </span>
                          <span className="text-neutral-700 text-sm">{retireNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-[18px] flex-shrink-0 mt-0.5">info</span>
                    <p className="text-xs text-amber-700">
                      Once submitted, this retirement cannot be modified. Ensure all figures are correct before proceeding.
                    </p>
                  </div>

                  <div className="flex justify-between">
                    <button type="button" onClick={() => setWizardStep(2)} disabled={actionLoading} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      Back
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowWizard(false); setWizardStep(1); setRetireError(null); }}
                        disabled={actionLoading}
                        className="btn-secondary py-2 px-4 text-sm"
                      >
                        Cancel
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
                        {actionLoading ? "Submitting…" : "Submit Retirement"}
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Approval Decision</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Review the imprest request details above and take an action.</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {actionLoading ? "Processing…" : "Approve Request"}
            </button>
            {canReturn && (
              <button
                onClick={() => setShowReturnModal(true)}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
                Return
              </button>
            )}
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link href="/imprest" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Imprest Requests
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
                <h3 className="text-base font-bold text-neutral-900">Reject Imprest Request</h3>
                <p className="text-xs text-neutral-400">A reason is required</p>
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter your reason for rejection…"
              rows={3}
              className="form-input resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
