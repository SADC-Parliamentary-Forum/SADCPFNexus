"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { leaveApi, type LeaveRequest, workflowApi, type ModuleAttachment, LEAVE_DOCUMENT_TYPES } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { ReturnModal } from "@/components/workflow/ReturnModal";
import { WorkflowStatusBanner } from "@/components/workflow/WorkflowStatusBanner";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { unwrapEntity } from "@/lib/unwrapEntity";
import { useToast } from "@/components/ui/Toast";

const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
  annual: { label: "Annual Leave", color: "text-green-700 bg-green-50 border-green-200", icon: "sunny" },
  sick: { label: "Sick Leave", color: "text-red-700 bg-red-50 border-red-200", icon: "medical_services" },
  lil: { label: "Leave in Lieu", color: "text-primary bg-primary/10 border-primary/20", icon: "swap_horiz" },
  special: { label: "Special Leave", color: "text-amber-800 bg-amber-50 border-amber-200", icon: "star" },
  maternity: { label: "Maternity Leave", color: "text-neutral-800 bg-neutral-50 border-neutral-200", icon: "child_care" },
  paternity: { label: "Paternity Leave", color: "text-neutral-800 bg-neutral-50 border-neutral-200", icon: "family_restroom" },
  compassionate: { label: "Compassionate Leave", color: "text-amber-800 bg-amber-50 border-amber-200", icon: "volunteer_activism" },
  study: { label: "Study Leave", color: "text-primary bg-primary/5 border-primary/20", icon: "school" },
  unpaid: { label: "Leave Without Pay", color: "text-neutral-700 bg-neutral-50 border-neutral-200", icon: "money_off" },
  home: { label: "Home Leave", color: "text-neutral-700 bg-neutral-50 border-neutral-200", icon: "home" },
};

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:                { label: "Approved",               cls: "text-green-700 bg-green-50 border-green-200",    icon: "check_circle" },
  submitted:               { label: "Pending",                cls: "text-amber-700 bg-amber-50 border-amber-200",    icon: "pending" },
  rejected:                { label: "Rejected",               cls: "text-red-700 bg-red-50 border-red-200",          icon: "cancel" },
  draft:                   { label: "Draft",                  cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note" },
  cancelled:               { label: "Cancelled",              cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "cancel" },
  returned_for_correction: { label: "Returned for Correction", cls: "text-amber-700 bg-amber-50 border-amber-200",   icon: "undo" },
  withdrawn:               { label: "Withdrawn",              cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "block" },
};

type LilLinking = { id: number; code?: string; description?: string; hours?: number; date?: string; approved_by?: string; is_verified?: boolean };

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

function formatWorkflowStage(stage: unknown, fallback: string) {
  if (!stage) return fallback;
  if (typeof stage === "string") return stage;
  if (typeof stage === "number") return String(stage);
  if (typeof stage === "object") {
    const value = stage as {
      label?: unknown;
      step_name?: unknown;
      name?: unknown;
      approver_type?: unknown;
      index?: unknown;
    };
    if (typeof value.label === "string" && value.label.trim()) return value.label;
    if (typeof value.step_name === "string" && value.step_name.trim()) return value.step_name;
    if (typeof value.name === "string" && value.name.trim()) return value.name;
    if (typeof value.approver_type === "string" && value.approver_type.trim()) {
      const human = value.approver_type.replace(/_/g, " ");
      return value.index != null ? `Stage ${Number(value.index) + 1}: ${human}` : human;
    }
  }
  return fallback;
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

export default function LeaveDetailPage() {
  const { success, error: showErrorToast, info } = useToast();
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const { confirm } = useConfirm();

  // Balance override flow
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // HOD / HR recommendation & certification
  const [recommendComment, setRecommendComment] = useState("");
  const [certifyComment, setCertifyComment] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<ModuleAttachment[]>([]);
  const [uploadDocType, setUploadDocType] = useState("other");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [attachToast, setAttachToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError("Invalid request ID.");
      return;
    }
    leaveApi.get(id)
      .then((res) => {
        const entity = unwrapEntity<LeaveRequest>(res.data);
        if (!entity) throw new Error("not_found");
        setRequest(entity);
        return leaveApi.listAttachments(id);
      })
      .then((res) => setAttachments(res.data.data ?? []))
      .catch(() => setError("Failed to load leave request."))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshRequest = async () => {
    const res = await leaveApi.get(id);
    const entity = unwrapEntity<LeaveRequest>(res.data);
    if (entity) setRequest(entity);
  };


  const handleApprove = async (override?: string) => {
    if (!request) return;
    setActionLoading(true);
    setBalanceError(null);
    try {
      const res = await leaveApi.approve(request.id, override);
      const notified: string[] = (res.data as any).notified_approvers ?? [];
      await refreshRequest();
      setShowOverrideModal(false);
      setOverrideReason("");
      if (notified.length > 0) {
        success(`Approved. Notified: ${notified.join(", ")}`);
      } else {
        success("Request fully approved.");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { errors?: { balance?: string[] }; message?: string } } };
      const balMsg = err?.response?.data?.errors?.balance?.[0];
      if (balMsg) {
        setBalanceError(balMsg);
        setShowOverrideModal(true);
      } else {
        setError(err?.response?.data?.message ?? "Failed to approve request.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!request || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await leaveApi.reject(request.id, rejectReason.trim());
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
      await leaveApi.returnForCorrection(request.id, comment);
      await refreshRequest();
      setShowReturnModal(false);
      success("Request returned to requester for correction.");
    } catch {
      setError("Failed to return request.");
    } finally {
      setReturnLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!request) return;
    if (!(await confirm({ title: "Withdraw Request", message: "Withdraw this leave request? This cannot be undone.", variant: "danger" }))) return;
    setActionLoading(true);
    try {
      await leaveApi.withdraw(request.id);
      await refreshRequest();
      success("Request withdrawn.");
    } catch {
      setError("Failed to withdraw request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!request) return;
    if (!(await confirm({ title: "Resubmit Request", message: "Resubmit this leave request for approval? It will restart from the first step.", variant: "primary" }))) return;
    setActionLoading(true);
    try {
      await leaveApi.resubmit(request.id);
      await refreshRequest();
      success("Request resubmitted for approval.");
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
        <Link href="/leave" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Leave Requests
        </Link>
      </div>
    );
  }

  const typeInfo = typeConfig[request.leave_type] ?? { label: request.leave_type, color: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "event_available" };
  const s = statusConfig[request.status] ?? statusConfig.draft;
  const lilLinkings = (request as LeaveRequest & { lil_linkings?: LilLinking[] }).lil_linkings ?? [];
  const hasLil = request.has_lil_linking && (lilLinkings.length > 0 || (request.lil_hours_required != null && request.lil_hours_linked != null));
  const segments = request.segments ?? [];

  const durationDays = request.days_requested;
  const approvalRequest = (request as any).approval_request;
  const currentStep = approvalRequest?.workflow?.steps?.[approvalRequest?.current_step_index];
  const canReturn = approvalRequest?.status === "pending" && currentStep?.allow_return;
  const isReturnedForCorrection = request.status === "returned_for_correction";

  return (
    <div className="mx-auto max-w-3xl space-y-5">

      {/* Toast */}
<ModulePageHeader
        title="Leave Request"
        subtitle={`${formatDateShort(request.start_date)} → ${formatDateShort(request.end_date)} · ${durationDays} day${durationDays !== 1 ? "s" : ""}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Leave", href: "/leave" },
              { label: request.reference_number },
            ]}
          />
        }
        meta={
          <>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${typeInfo.color}`}>
              <span className="material-symbols-outlined text-[12px]">{typeInfo.icon}</span>
              {typeInfo.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <PrintButton className="text-xs" />
            {request.status === "approved" && (
              <Link
                href={`/leave/${request.id}/certificate`}
                className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
              >
                <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                Certificate
              </Link>
            )}
            <a
              href={leaveApi.pdfUrl(request.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
              FORM-005
            </a>
            {request.status === "draft" && (
              <>
                <button
                  onClick={async () => {
                    if (!(await confirm({ title: "Submit Request", message: "Submit this leave request for approval?", variant: "primary" }))) return;
                    setActionLoading(true);
                    try {
                      await leaveApi.submit(request.id);
                      await refreshRequest();
                    } catch { setError("Failed to submit."); }
                    finally { setActionLoading(false); }
                  }}
                  disabled={actionLoading}
                  className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  Submit
                </button>
                <button
                  onClick={async () => {
                    if (!(await confirm({ title: "Delete Draft", message: "Delete this draft leave request?", variant: "danger" }))) return;
                    try {
                      await leaveApi.delete(request.id);
                      router.push("/leave");
                    } catch { setError("Failed to delete."); }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  Delete
                </button>
              </>
            )}
            {request.status === "submitted" && approvalRequest?.status === "pending" && (
              <button
                onClick={handleWithdraw}
                disabled={actionLoading}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">block</span>
                Withdraw
              </button>
            )}
            {isReturnedForCorrection && (
              <button
                onClick={handleResubmit}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Resubmit
              </button>
            )}
          </div>
        }
      />

      {/* Duration banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Start Date", value: formatDateShort(request.start_date), icon: "event", color: "text-primary" },
          { label: "End Date", value: formatDateShort(request.end_date), icon: "event_available", color: "text-neutral-700" },
          { label: "Duration", value: `${durationDays} day${durationDays !== 1 ? "s" : ""}`, icon: "schedule", color: "text-green-600" },
        ].map((item) => (
          <div key={item.label} className="card p-4 text-center">
            <span className={`material-symbols-outlined text-[22px] ${item.color}`}>{item.icon}</span>
            <p className={`mt-1 text-base font-bold ${item.color}`}>{item.value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-400">{item.label}</p>
          </div>
        ))}
      </div>

      <WorkflowStatusBanner
        status={request.status}
        currentStage={formatWorkflowStage(request.current_stage, request.status)}
        currentHolder={request.current_holder ?? "Not assigned"}
        extras={[
          { label: "HOD recommendation", value: request.recommendation_status ?? "Pending" },
          { label: "HR certification", value: request.certification_status ?? "Pending" },
        ]}
      />

      {/* HOD Recommendation / HR Certification */}
      {["submitted", "resubmitted", "pending_next_step"].includes(request.status) && (() => {
        const currentUser = getStoredUser();
        const roles = currentUser?.roles ?? [];
        const canRecommend = isSystemAdmin(currentUser)
          || hasPermission(currentUser, ["leave.approve", "hr.approve"])
          || roles.some((r) => ["HOD", "HR Manager", "HR Administrator", "Secretary General"].includes(r));
        const canCertify = isSystemAdmin(currentUser)
          || hasPermission(currentUser, ["leave.approve", "hr.admin"])
          || roles.some((r) => ["HR Manager", "HR Administrator"].includes(r));
        const needsRecommend = !request.recommendation_status || request.recommendation_status === "pending";
        const needsCertify = request.recommendation_status === "recommended"
          && (!request.certification_status || request.certification_status === "pending");
        if (!((canRecommend && needsRecommend) || (canCertify && needsCertify))) return null;
        return (
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon="fact_check" color="text-indigo-600" bg="bg-indigo-50" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                {needsRecommend ? "HOD Recommendation" : "HR Certification"}
              </h3>
            </div>
            {canRecommend && needsRecommend && (
              <div className="space-y-3">
                <textarea
                  className="form-input min-h-[70px]"
                  placeholder="Optional comment (required if not recommending / returning)"
                  value={recommendComment}
                  onChange={(e) => setRecommendComment(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    className="btn-primary disabled:opacity-50"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await leaveApi.recommend(request.id, { action: "recommend", comment: recommendComment || undefined });
                        await refreshRequest();
                        success("Recommendation recorded.");
                      } catch { setError("Failed to record recommendation."); }
                      finally { setActionLoading(false); }
                    }}
                  >
                    Recommend
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || !recommendComment.trim()}
                    className="btn-secondary disabled:opacity-50"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await leaveApi.recommend(request.id, { action: "not_recommend", comment: recommendComment.trim() });
                        await refreshRequest();
                        success("Not recommended recorded.");
                      } catch { setError("Failed to record recommendation."); }
                      finally { setActionLoading(false); }
                    }}
                  >
                    Do Not Recommend
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || !recommendComment.trim()}
                    className="btn-secondary text-amber-700 border-amber-200 disabled:opacity-50"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await leaveApi.recommend(request.id, { action: "return", comment: recommendComment.trim() });
                        await refreshRequest();
                        success("Returned for correction.");
                      } catch { setError("Failed to return leave request."); }
                      finally { setActionLoading(false); }
                    }}
                  >
                    Return
                  </button>
                </div>
              </div>
            )}
            {canCertify && needsCertify && (
              <div className="space-y-3">
                <textarea
                  className="form-input min-h-[70px]"
                  placeholder="Optional comment (required for conditional / return / ineligible)"
                  value={certifyComment}
                  onChange={(e) => setCertifyComment(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    className="btn-primary disabled:opacity-50"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await leaveApi.certify(request.id, { action: "certify", comment: certifyComment || undefined });
                        await refreshRequest();
                        success("Certification recorded.");
                      } catch { setError("Failed to certify leave request."); }
                      finally { setActionLoading(false); }
                    }}
                  >
                    Certify
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || !certifyComment.trim()}
                    className="btn-secondary disabled:opacity-50"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await leaveApi.certify(request.id, { action: "certify_with_condition", comment: certifyComment.trim() });
                        await refreshRequest();
                        success("Certified with condition.");
                      } catch { setError("Failed to certify leave request."); }
                      finally { setActionLoading(false); }
                    }}
                  >
                    Certify with Condition
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || !certifyComment.trim()}
                    className="btn-secondary text-amber-700 border-amber-200 disabled:opacity-50"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await leaveApi.certify(request.id, { action: "return", comment: certifyComment.trim() });
                        await refreshRequest();
                        success("Returned for correction.");
                      } catch { setError("Failed to return leave request."); }
                      finally { setActionLoading(false); }
                    }}
                  >
                    Return
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Submitted By */}
      {request.requester && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="badge" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Submitted By</h3>
            {request.submitted_at && (
              <span className="ml-auto text-xs text-neutral-400">
                {new Date(request.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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

      {/* Approval Decision (top) */}
      {request.status === "submitted" && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="gavel" color="text-amber-600" bg="bg-amber-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Approval Decision</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Review the leave request details above and take an action.</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => { void handleApprove(); }}
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

      {/* Workflow Timeline */}
      <ApprovalTimeline request={approvalRequest} />

      <AuditTimeline
        subjectType="LeaveRequest"
        subjectId={request.id}
        title="Platform Audit Trail"
      />

      {/* Leave Segments */}
      {segments.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="calendar_view_week" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Leave Segments</h3>
            {request.policy_version && (
              <span className="ml-auto text-[11px] text-neutral-400">
                Policy: {request.policy_version.name} {request.policy_version.version}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[11px] uppercase tracking-wide text-neutral-400">
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 px-3 font-semibold">Dates</th>
                  <th className="py-2 px-3 text-right font-semibold">Working</th>
                  <th className="py-2 px-3 text-right font-semibold">Holidays</th>
                  <th className="py-2 px-3 text-right font-semibold">Balance After</th>
                  <th className="py-2 pl-3 font-semibold">Certification</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment) => {
                  const info = typeConfig[segment.leave_type] ?? { label: segment.leave_type, color: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "event_available" };
                  return (
                    <tr key={segment.id} className="border-b border-neutral-50 last:border-0">
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${info.color}`}>
                          <span className="material-symbols-outlined text-[12px]">{info.icon}</span>
                          {segment.type?.name ?? info.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-neutral-700">
                        {formatDateShort(segment.start_date)} - {formatDateShort(segment.end_date)}
                        {segment.day_part && segment.day_part !== "full" && (
                          <span className="ml-1 text-xs text-neutral-400">({segment.day_part})</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-neutral-900">{Number(segment.amount_requested).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-neutral-600">{Number(segment.public_holidays_excluded ?? 0).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-neutral-600">
                        {segment.balance_after == null ? "-" : Number(segment.balance_after).toFixed(2)}
                      </td>
                      <td className="py-3 pl-3 text-neutral-600">
                        <div className="text-xs font-medium">{segment.certification_status ?? "Pending"}</div>
                        <div className="text-[11px] text-neutral-400">Docs: {segment.document_status ?? "not recorded"}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Details */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="event_available" color="text-green-600" bg="bg-green-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Leave Details</h3>
        </div>
        {request.reason && (
          <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">description</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Reason</p>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{request.reason}</p>
          </div>
        )}
        {!request.reason && (
          <p className="text-sm text-neutral-400 italic">No reason provided.</p>
        )}
      </div>

      {/* LIL Accrual Linkings */}
      {hasLil && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="swap_horiz" color="text-purple-600" bg="bg-purple-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">LIL Accrual Linkings</h3>
            {request.lil_hours_required != null && request.lil_hours_linked != null && (
              <div className="ml-auto flex items-center gap-1.5">
                <div className="h-1.5 w-20 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${Math.min(100, (request.lil_hours_linked / request.lil_hours_required) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-purple-600">
                  {request.lil_hours_linked}/{request.lil_hours_required} hrs
                </span>
              </div>
            )}
          </div>
          {lilLinkings.length > 0 && (
            <div className="space-y-2">
              {lilLinkings.map((lil) => (
                <div key={lil.id} className="flex items-center justify-between rounded-xl bg-purple-50 border border-purple-100 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-purple-100 flex-shrink-0">
                      <span className="material-symbols-outlined text-purple-600 text-[16px]">schedule</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{lil.description ?? "—"}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {lil.date ?? ""}
                        {lil.approved_by && ` · Approved by ${lil.approved_by}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    {lil.is_verified && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full mb-1">
                        <span className="material-symbols-outlined text-[11px]">verified</span>
                        Verified
                      </span>
                    )}
                    <p className="text-sm font-bold text-purple-700">{lil.hours ?? 0} hrs</p>
                    <p className="text-[10px] text-neutral-400">Code: {lil.code ?? "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approval Decision (bottom) */}
      {request.status === "submitted" && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="gavel" color="text-amber-600" bg="bg-amber-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Approval Decision</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Review the leave request details above and take an action.</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => { void handleApprove(); }}
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

      {/* Attachments */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
            <span className="material-symbols-outlined text-indigo-600 text-[18px]">attach_file</span>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Supporting Documents</h3>
          <span className="ml-auto text-xs text-neutral-400">{attachments.length} file{attachments.length !== 1 ? "s" : ""}</span>
        </div>

        {attachToast && (
          <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">{attachToast}</div>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select
            className="form-input text-xs py-1.5 w-44"
            value={uploadDocType}
            onChange={(e) => setUploadDocType(e.target.value)}
          >
            {LEAVE_DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label className={`btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer ${uploadLoading ? "opacity-50 pointer-events-none" : ""}`}>
            <span className="material-symbols-outlined text-[15px]">upload_file</span>
            {uploadLoading ? "Uploading…" : "Upload File"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              disabled={uploadLoading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !request) return;
                setUploadLoading(true);
                try {
                  const res = await leaveApi.uploadAttachment(request.id, file, uploadDocType);
                  setAttachments((prev) => [res.data.data, ...prev]);
                  setAttachToast("File uploaded.");
                  setTimeout(() => setAttachToast(null), 3000);
                } catch {
                  setAttachToast("Upload failed.");
                  setTimeout(() => setAttachToast(null), 3000);
                } finally {
                  setUploadLoading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>

        {attachments.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center py-4">No documents attached. Upload a medical certificate or supporting document.</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                <span className="material-symbols-outlined text-[20px] text-indigo-400">
                  {a.mime_type?.includes("pdf") ? "picture_as_pdf" : a.mime_type?.includes("image") ? "image" : "description"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-900 truncate">{a.original_filename}</p>
                  <p className="text-[10px] text-neutral-400">
                    {a.document_type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    {a.size_bytes ? ` · ${(a.size_bytes / 1024).toFixed(0)} KB` : ""}
                  </p>
                </div>
                <a
                  href={leaveApi.downloadAttachmentUrl(request!.id, a.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">download</span>
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    if (!request) return;
                    await leaveApi.deleteAttachment(request.id, a.id);
                    setAttachments((prev) => prev.filter((x) => x.id !== a.id));
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back link */}
      <Link href="/leave" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Leave Requests
      </Link>

      {/* Return for Correction Modal */}
      <ReturnModal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onConfirm={handleReturn}
        loading={returnLoading}
      />

      {/* Balance Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-md w-full shadow-2xl border border-neutral-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Insufficient Leave Balance</h3>
                <p className="text-xs text-neutral-400">Override requires justification</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-4 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">{balanceError}</p>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Override Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Provide a written justification for overriding the leave balance check…"
              rows={3}
              className="form-input resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowOverrideModal(false); setOverrideReason(""); setBalanceError(null); }}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(overrideReason.trim())}
                disabled={actionLoading || !overrideReason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Processing…" : "Approve Anyway"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-md w-full shadow-2xl border border-neutral-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-red-600 text-[20px]">cancel</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Reject Leave Request</h3>
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
