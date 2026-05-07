"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { travelApi, type TravelRequest, type ModuleAttachment, TRAVEL_DOCUMENT_TYPES } from "@/lib/api";
import { formatDateShort, formatDateRelative } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { PrintButton } from "@/components/ui/PrintButton";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { ReturnModal } from "@/components/workflow/ReturnModal";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:                { label: "Approved",              cls: "text-green-700 bg-green-50 border-green-200",   icon: "check_circle" },
  submitted:               { label: "Pending Approval",      cls: "text-amber-700 bg-amber-50 border-amber-200",   icon: "pending" },
  rejected:                { label: "Rejected",              cls: "text-red-700 bg-red-50 border-red-200",         icon: "cancel" },
  draft:                   { label: "Draft",                 cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note" },
  cancelled:               { label: "Cancelled",             cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "cancel" },
  returned_for_correction: { label: "Returned for Correction", cls: "text-amber-700 bg-amber-50 border-amber-200", icon: "undo" },
  withdrawn:               { label: "Withdrawn",             cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "block" },
};

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-neutral-100 rounded" />
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="h-4 w-36 bg-neutral-100 rounded" />
    </div>
  );
}

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

export default function TravelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { confirm } = useConfirm();

  // Attachments
  const [attachments, setAttachments] = useState<ModuleAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("other");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [attachToast, setAttachToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError("Invalid request ID.");
      return;
    }
    travelApi.get(id)
      .then((res) => {
        setRequest((res.data as any).data ?? res.data);
        return travelApi.listAttachments(id);
      })
      .then((res) => setAttachments(res.data.data))
      .catch(() => setError("Failed to load travel request."))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshRequest = async () => {
    const res = await travelApi.get(id);
    setRequest((res.data as any).data ?? res.data);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  };

  const handleApprove = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      const res = await travelApi.approve(request.id);
      const notified: string[] = (res.data as any).notified_approvers ?? [];
      await refreshRequest();
      if (notified.length > 0) {
        showToast(`Approved. Notified: ${notified.join(", ")}`);
      } else {
        showToast("Request fully approved.");
      }
    } catch {
      setError("Failed to approve request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!request || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await travelApi.reject(request.id, rejectReason.trim());
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
      await travelApi.returnForCorrection(request.id, comment);
      await refreshRequest();
      setShowReturnModal(false);
      showToast("Request returned to requester for correction.");
    } catch {
      setError("Failed to return request.");
    } finally {
      setReturnLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!request) return;
    if (!(await confirm({ title: "Withdraw Request", message: "Withdraw this travel request? This cannot be undone.", variant: "danger" }))) return;
    setActionLoading(true);
    try {
      await travelApi.withdraw(request.id);
      await refreshRequest();
      showToast("Request withdrawn.");
    } catch {
      setError("Failed to withdraw request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!request) return;
    if (!(await confirm({ title: "Resubmit Request", message: "Resubmit this travel request for approval? It will restart from the first step.", variant: "primary" }))) return;
    setActionLoading(true);
    try {
      await travelApi.resubmit(request.id);
      await refreshRequest();
      showToast("Request resubmitted for approval.");
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
        <Link href="/travel" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Travel Requests
        </Link>
      </div>
    );
  }

  const s = statusConfig[request.status] ?? statusConfig.draft;
  const itineraries = request.itineraries ?? [];
  const approvalRequest = (request as any).approval_request;
  const currentStep = approvalRequest?.workflow?.steps?.[approvalRequest?.current_step_index];
  const canReturn = approvalRequest?.status === "pending" && currentStep?.allow_return;
  const isReturnedForCorrection = request.status === "returned_for_correction";

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-green-600 text-white px-4 py-3 text-sm font-semibold shadow-lg animate-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {toast}
        </div>
      )}

      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3">
          <Link href="/travel" className="hover:text-primary transition-colors font-medium">Travel</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-mono text-neutral-500">{request.reference_number}</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{request.purpose}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-neutral-400">
                <span className="material-symbols-outlined text-[13px]">location_on</span>
                {[request.destination_city, request.destination_country].filter(Boolean).join(", ") || request.destination_country}
              </span>
              <span className="text-neutral-200">·</span>
              <span className="flex items-center gap-1 text-xs text-neutral-400">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                {formatDateShort(request.departure_date)} → {formatDateShort(request.return_date)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {request.status === "approved" && (
              <Link
                href={`/travel/${request.id}/certificate`}
                className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                Certificate
              </Link>
            )}
            {request.status === "draft" && (
              <>
                <button
                  onClick={async () => {
                    if (!(await confirm({ title: "Submit Request", message: "Submit this travel request for approval?", variant: "primary" }))) return;
                    setActionLoading(true);
                    try {
                      await travelApi.submit(request.id);
                      await refreshRequest();
                    } catch { setError("Failed to submit."); }
                    finally { setActionLoading(false); }
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  Submit
                </button>
                <button
                  onClick={async () => {
                    if (!(await confirm({ title: "Delete Draft", message: "Delete this draft travel request?", variant: "danger" }))) return;
                    try {
                      await travelApi.delete(request.id);
                      router.push("/travel");
                    } catch { setError("Failed to delete."); }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  Delete
                </button>
              </>
            )}
            {/* Withdraw: visible when submitted/pending, requester can act */}
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
            {/* Resubmit: visible when returned for correction */}
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
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Returned for Correction</p>
            <p className="text-xs text-amber-700 mt-0.5">This request was returned. Make the required corrections and resubmit.</p>
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
            { key: "draft",     label: "Draft",     icon: "edit_note",    completedAt: request.submitted_at ? request.submitted_at : undefined },
            { key: "submitted", label: "Submitted",  icon: "send",         completedAt: request.submitted_at },
            { key: "approved",  label: "Approved",   icon: "check_circle", completedAt: request.approved_at },
          ]}
          currentStatus={request.status}
          rejectedAt={request.status === "rejected" ? (request.approved_at ?? request.submitted_at) : null}
          rejectionReason={request.rejection_reason}
        />
      </div>

      {/* Approval Timeline */}
      <ApprovalTimeline request={approvalRequest} />

      {/* Requester */}
      {request.requester && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="person" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Requester</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {request.requester.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{request.requester.name}</p>
              <p className="text-xs text-neutral-400">{[request.requester.job_title, request.requester.employee_number].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Trip Details */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="flight_takeoff" color="text-primary" bg="bg-primary/10" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Trip Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">location_on</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Destination</p>
            </div>
            <p className="font-semibold text-neutral-900">{[request.destination_city, request.destination_country].filter(Boolean).join(", ") || request.destination_country}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">date_range</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Travel Period</p>
            </div>
            <p className="font-semibold text-neutral-900">{formatDateShort(request.departure_date)} → {formatDateShort(request.return_date)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">currency_exchange</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Currency</p>
            </div>
            <p className="font-semibold text-neutral-900">{request.currency}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">payments</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Estimated DSA</p>
            </div>
            <p className="text-lg font-bold text-primary">{request.currency} {request.estimated_dsa.toLocaleString()}</p>
          </div>
        </div>
        {request.justification && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">description</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Justification</p>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">{request.justification}</p>
          </div>
        )}
      </div>

      {/* Itinerary */}
      {itineraries.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="route" color="text-teal-600" bg="bg-teal-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Itinerary</h3>
            <span className="ml-auto text-xs font-semibold text-neutral-400">{itineraries.length} leg{itineraries.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2.5">
            {itineraries.map((leg, i) => (
              <div key={leg.id} className="flex items-center gap-4 rounded-xl bg-neutral-50 border border-neutral-100 p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white border border-neutral-200 shadow-sm">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    {leg.transport_mode === "flight" ? "flight" : leg.transport_mode === "road" ? "directions_car" : "train"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{leg.from_location} → {leg.to_location}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{leg.travel_date} · {leg.days_count} day{leg.days_count !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wide">DSA</p>
                  <p className="text-sm font-bold text-neutral-900">
                    {request.currency} {((leg as { calculated_dsa?: number }).calculated_dsa ?? (leg.dsa_rate * leg.days_count)).toLocaleString()}
                  </p>
                </div>
                {i < itineraries.length - 1 && (
                  <div className="absolute left-7 mt-9 h-2.5 w-px bg-neutral-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Decision */}
      {request.status === "submitted" && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="gavel" color="text-amber-600" bg="bg-amber-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Approval Decision</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Review the travel request details above and take an action.</p>
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

      {/* Attachments */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="attach_file" color="text-indigo-600" bg="bg-indigo-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Supporting Documents</h3>
          <span className="ml-auto text-xs text-neutral-400">{attachments.length} file{attachments.length !== 1 ? "s" : ""}</span>
        </div>

        {attachToast && (
          <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">{attachToast}</div>
        )}

        {/* Upload row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select
            className="form-input text-xs py-1.5 w-44"
            value={uploadDocType}
            onChange={(e) => setUploadDocType(e.target.value)}
          >
            {TRAVEL_DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label className={`btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer ${uploadLoading ? "opacity-50 pointer-events-none" : ""}`}>
            <span className="material-symbols-outlined text-[15px]">upload_file</span>
            {uploadLoading ? "Uploading…" : "Upload File"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
              disabled={uploadLoading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !request) return;
                setUploadLoading(true);
                try {
                  const res = await travelApi.uploadAttachment(request.id, file, uploadDocType);
                  setAttachments((prev) => [res.data.data, ...prev]);
                  setAttachToast("File uploaded successfully.");
                  setTimeout(() => setAttachToast(null), 3000);
                } catch {
                  setAttachToast("Upload failed. Please try again.");
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
          <p className="text-xs text-neutral-400 text-center py-4">No documents attached yet.</p>
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
                  href={travelApi.downloadAttachmentUrl(request!.id, a.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-primary hover:bg-primary/5 transition-colors"
                  title="Download"
                >
                  <span className="material-symbols-outlined text-[17px]">download</span>
                </a>
                <button
                  type="button"
                  title="Delete"
                  onClick={async () => {
                    if (!request) return;
                    await travelApi.deleteAttachment(request.id, a.id);
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
      <Link href="/travel" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Travel Requests
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
                <h3 className="text-base font-bold text-neutral-900">Reject Travel Request</h3>
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
