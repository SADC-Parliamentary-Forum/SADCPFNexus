"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { hrProfileRequestApi, type ProfileChangeRequest } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatDateRelative } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  phone: "Phone", bio: "Bio", nationality: "Nationality",
  gender: "Gender", marital_status: "Marital Status",
  emergency_contact_name: "Emergency Contact Name",
  emergency_contact_relationship: "Emergency Contact Relationship",
  emergency_contact_phone: "Emergency Contact Phone",
  address_line1: "Address Line 1", address_line2: "Address Line 2",
  city: "City", country: "Country",
};

const STATUS_CONFIG = {
  pending:   { label: "Pending",   cls: "badge-warning" },
  approved:  { label: "Approved",  cls: "badge-success" },
  rejected:  { label: "Rejected",  cls: "badge-danger"  },
  cancelled: { label: "Cancelled", cls: "badge-muted"   },
};

type StatusFilter = "pending" | "approved" | "rejected" | "all";

function ReviewModal({
  request,
  action,
  onClose,
  onDone,
}: {
  request: ProfileChangeRequest;
  action: "approve" | "reject";
  onClose: () => void;
  onDone: (updated: ProfileChangeRequest) => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (action === "reject" && !notes.trim()) return;
    setSaving(true);
    try {
      const res = action === "approve"
        ? await hrProfileRequestApi.approve(request.id, notes || undefined)
        : await hrProfileRequestApi.reject(request.id, notes);
      success(action === "approve" ? "Approved" : "Rejected", res.data.message);
      onDone(res.data.data);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      toastError("Error", ax.response?.data?.message ?? "Action failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className={`px-6 py-4 flex items-center gap-3 ${action === "approve" ? "bg-green-50 border-b border-green-100" : "bg-red-50 border-b border-red-100"}`}>
          <span className={`material-symbols-outlined text-[22px] ${action === "approve" ? "text-green-600" : "text-red-500"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {action === "approve" ? "check_circle" : "cancel"}
          </span>
          <h3 className="text-base font-bold text-neutral-900">
            {action === "approve" ? "Approve Profile Changes" : "Reject Profile Changes"}
          </h3>
          <button type="button" onClick={onClose} className="ml-auto text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Diff summary */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">Requested Changes</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Object.entries(request.requested_changes).map(([field, diff]) => (
              <div key={field} className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">{FIELD_LABELS[field] ?? field}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-red-400 line-through">{diff.old ?? <em className="not-italic text-neutral-300">empty</em>}</span>
                  <span className="material-symbols-outlined text-[14px] text-neutral-400">arrow_forward</span>
                  <span className="text-green-700 font-semibold">{diff.new ?? <em className="not-italic text-neutral-300">empty</em>}</span>
                </div>
              </div>
            ))}
          </div>
          {request.notes && (
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
              <span className="font-semibold">Staff note: </span>{request.notes}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-2 pb-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              {action === "approve" ? "Notes (optional)" : "Reason for rejection *"}
            </label>
            <textarea
              rows={3}
              required={action === "reject"}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={action === "approve" ? "Add any notes for the staff member…" : "Explain why this request is being rejected…"}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className={`text-sm px-5 py-2 rounded-xl font-semibold text-white transition-colors disabled:opacity-60 ${action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
              {saving ? "Processing…" : action === "approve" ? "Approve & Apply" : "Reject Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HrProfileRequestsPage() {
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [modal, setModal] = useState<{ request: ProfileChangeRequest; action: "approve" | "reject" } | null>(null);
  const { error: toastError } = useToast();

  const load = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    try {
      const res = await hrProfileRequestApi.list(status);
      setRequests((res.data as any).data ?? []);
    } catch {
      toastError("Error", "Failed to load profile change requests.");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { load(statusFilter); }, [statusFilter, load]);

  const handleDone = (updated: ProfileChangeRequest) => {
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
    if (statusFilter === "pending") {
      setRequests(prev => prev.filter(r => r.id !== updated.id));
    }
    setModal(null);
  };

  const tabs: { key: StatusFilter; label: string; icon: string }[] = [
    { key: "pending",  label: "Pending",  icon: "pending_actions" },
    { key: "approved", label: "Approved", icon: "check_circle"    },
    { key: "rejected", label: "Rejected", icon: "cancel"          },
    { key: "all",      label: "All",      icon: "list"            },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {modal && (
        <ReviewModal
          request={modal.request}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}

      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/hr" className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <h1 className="page-title">Profile Change Requests</h1>
        </div>
        <p className="page-subtitle">Review and approve staff profile update requests.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {tabs.map(t => (
          <button key={t.key} type="button"
            onClick={() => setStatusFilter(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${statusFilter === t.key ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-100 rounded w-48" />
                  <div className="h-3 bg-neutral-100 rounded w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-neutral-200 mb-3">task_alt</span>
          <p className="text-neutral-500 font-medium">No {statusFilter === "all" ? "" : statusFilter} requests</p>
          <p className="text-xs text-neutral-400 mt-1">
            {statusFilter === "pending" ? "All profile change requests have been reviewed." : "Nothing to show."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
            const initials = req.user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";
            return (
              <div key={req.id} className="card p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                    {initials}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{req.user?.name ?? "Unknown"}</p>
                      <span className={`badge ${cfg.cls} text-[10px]`}>{cfg.label}</span>
                      {req.user?.department && (
                        <span className="text-xs text-neutral-400">{(req.user.department as any).name}</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">{req.user?.email}</p>

                    {/* Changed fields */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.keys(req.requested_changes).map(f => (
                        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-primary/8 border border-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                          {FIELD_LABELS[f] ?? f}
                        </span>
                      ))}
                    </div>

                    {req.notes && (
                      <p className="mt-2 text-xs text-neutral-500 italic">"{req.notes}"</p>
                    )}

                    {req.review_notes && req.status !== "pending" && (
                      <div className={`mt-2 text-xs rounded-lg px-3 py-1.5 ${req.status === "approved" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
                        <span className="font-semibold">HR note: </span>{req.review_notes}
                      </div>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-xs text-neutral-400">{formatDateRelative(req.created_at)}</p>
                    {req.status === "pending" && (
                      <div className="flex gap-2">
                        <button type="button"
                          onClick={() => setModal({ request: req, action: "reject" })}
                          className="text-xs font-semibold text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">
                          Reject
                        </button>
                        <button type="button"
                          onClick={() => setModal({ request: req, action: "approve" })}
                          className="text-xs font-semibold text-white bg-green-600 rounded-lg px-3 py-1.5 hover:bg-green-700 transition-colors">
                          Approve
                        </button>
                      </div>
                    )}
                    {req.status !== "pending" && req.reviewer && (
                      <p className="text-[10px] text-neutral-400">By {req.reviewer.name}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
