"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { travelApi, type TravelRequest } from "@/lib/api";
import { formatDateShort, formatDateRelative } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { PrintButton } from "@/components/ui/PrintButton";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved: { label: "Approved", cls: "text-green-700 bg-green-50 border-green-200", icon: "check_circle" },
  submitted: { label: "Pending Approval", cls: "text-amber-700 bg-amber-50 border-amber-200", icon: "pending" },
  rejected: { label: "Rejected", cls: "text-red-700 bg-red-50 border-red-200", icon: "cancel" },
  draft: { label: "Draft", cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note" },
  cancelled: { label: "Cancelled", cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "cancel" },
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
  const { confirm } = useConfirm();

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError("Invalid request ID.");
      return;
    }
    travelApi.get(id)
      .then((res) => setRequest((res.data as any).data ?? res.data))
      .catch(() => setError("Failed to load travel request."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      await travelApi.approve(request.id);
      const res = await travelApi.get(request.id);
      setRequest((res.data as any).data ?? res.data);
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
      const res = await travelApi.get(request.id);
      setRequest((res.data as any).data ?? res.data);
      setShowRejectModal(false);
      setRejectReason("");
    } catch {
      setError("Failed to reject request.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb skeleton */}
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

  return (
    <div className="max-w-3xl mx-auto space-y-5">

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
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {request.status === "draft" && (
              <>
                <button
                  onClick={async () => {
                    if (!(await confirm({ title: "Submit Request", message: "Submit this travel request for approval?", variant: "primary" }))) return;
                    setActionLoading(true);
                    try {
                      await travelApi.submit(request.id);
                      const res = await travelApi.get(request.id);
                      setRequest((res.data as any).data ?? res.data);
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
          </div>
        </div>
      </div>

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
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {actionLoading ? "Processing…" : "Approve Request"}
            </button>
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
      <Link href="/travel" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Travel Requests
      </Link>

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
