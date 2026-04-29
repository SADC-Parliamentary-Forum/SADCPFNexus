"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workflowApi, type ApprovalRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

const MODULE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string; href: (id: number) => string }> = {
  travel:      { icon: "flight_takeoff",         color: "text-primary",                         bg: "bg-primary/10",                         label: "Travel",      href: (id) => `/travel/${id}` },
  leave:       { icon: "event_available",         color: "text-green-600 dark:text-green-300",   bg: "bg-green-50 dark:bg-green-900/20",       label: "Leave",       href: (id) => `/leave/${id}` },
  imprest:     { icon: "account_balance_wallet",  color: "text-amber-600 dark:text-amber-300",   bg: "bg-amber-50 dark:bg-amber-900/20",       label: "Imprest",     href: (id) => `/imprest/${id}` },
  procurement: { icon: "shopping_cart",           color: "text-rose-600 dark:text-rose-300",     bg: "bg-rose-50 dark:bg-rose-900/20",         label: "Procurement", href: (id) => `/procurement/${id}` },
  advance:     { icon: "payments",                color: "text-purple-600 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-900/20",     label: "Advance",     href: (id) => `/finance/advances/${id}` },
  finance:     { icon: "payments",                color: "text-purple-600 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-900/20",     label: "Finance",     href: (id) => `/finance/advances/${id}` },
  governance:  { icon: "gavel",                   color: "text-teal-600 dark:text-teal-300",     bg: "bg-teal-50 dark:bg-teal-900/20",         label: "Governance",  href: (id) => `/governance/${id}` },
};

const DEFAULT_MODULE = { icon: "description", color: "text-neutral-600 dark:text-neutral-400", bg: "bg-neutral-100 dark:bg-neutral-700/40", label: "Request", href: (id: number) => `#${id}` };

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const currentUser = getStoredUser();
  const [filter, setFilter] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: requests = [], isLoading: loading, isError: error } = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => workflowApi.getPending().then((res) => res.data.data as ApprovalRequest[]),
    staleTime: 30_000,
  });

  const moduleTypes = useMemo(() => {
    const types = new Set(requests.map((r) => r.workflow?.module_type ?? "request"));
    return ["all", ...Array.from(types)];
  }, [requests]);

  const filtered = useMemo(() =>
    filter === "all" ? requests : requests.filter((r) => (r.workflow?.module_type ?? "request") === filter),
    [requests, filter]
  );

  const removeFromCache = (id: number) => {
    queryClient.setQueryData<ApprovalRequest[]>(["approvals", "pending"], (prev) => prev?.filter((r) => r.id !== id) ?? []);
  };

  const handleApprove = async (req: ApprovalRequest) => {
    setActionLoading(req.id);
    try {
      await workflowApi.approve(req.id);
      removeFromCache(req.id);
      toast("success", "Approved", `Request ${req.approvable?.reference_number ?? `#${req.approvable_id}`} has been approved.`);
    } catch {
      toast("error", "Action Failed", "Could not approve the request.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActionLoading(rejectTarget.id);
    try {
      await workflowApi.reject(rejectTarget.id, rejectReason.trim());
      removeFromCache(rejectTarget.id);
      toast("success", "Rejected", `Request ${rejectTarget.approvable?.reference_number ?? `#${rejectTarget.approvable_id}`} has been rejected.`);
      setRejectTarget(null);
      setRejectReason("");
    } catch {
      toast("error", "Action Failed", "Could not reject the request.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-title">Pending Approvals</h1>
        <p className="page-subtitle">Review and action requests awaiting your decision.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">Failed to load pending approvals.</div>
      )}

      {/* Filter tabs */}
      {!loading && requests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {moduleTypes.map((t) => (
            <button key={t} type="button" onClick={() => setFilter(t)}
              className={`filter-tab capitalize${filter === t ? " active" : ""}`}>
              {t === "all" ? `All (${requests.length})` : (MODULE_CONFIG[t]?.label ?? t)}
              {t !== "all" && ` (${requests.filter((r) => (r.workflow?.module_type ?? "request") === t).length})`}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-neutral-100 dark:bg-neutral-700/40" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-neutral-100 dark:bg-neutral-700/40 rounded" />
                <div className="h-3 w-32 bg-neutral-100 dark:bg-neutral-700/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white dark:bg-neutral-800 shadow-sm border border-neutral-100 dark:border-neutral-700/50 mb-4">
            <span className="material-symbols-outlined text-4xl text-neutral-200 dark:text-neutral-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <p className="font-bold text-neutral-500 dark:text-neutral-400">You&apos;re all caught up!</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {filter === "all" ? "No requests currently awaiting your approval." : `No ${filter} requests pending.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const moduleType = req.workflow?.module_type ?? "request";
            const mc = MODULE_CONFIG[moduleType] ?? DEFAULT_MODULE;
            const approvable = req.approvable;
            const isActing = actionLoading === req.id;
            const isOwnRequest =
              currentUser?.id != null &&
              (approvable?.requester?.id === currentUser.id ||
               (approvable as any)?.requester_id === currentUser.id);
            return (
              <div key={req.id} className="card p-5 hover:border-primary/30 hover:shadow-elevated transition-all">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Left: icon + info */}
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${mc.bg}`}>
                      <span className={`material-symbols-outlined text-[24px] ${mc.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{mc.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                          {approvable?.reference_number ?? `Request #${req.approvable_id}`}
                        </h3>
                        <span className="text-[10px] font-bold uppercase py-0.5 px-2 rounded-full bg-neutral-100 dark:bg-neutral-700/40 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                          {mc.label}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">{approvable?.requester?.name ?? "Staff member"}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        Submitted {formatDateShort(req.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={mc.href(req.approvable_id)}
                      className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      View
                    </Link>
                    {isOwnRequest ? (
                      <span className="inline-flex items-center gap-1 py-2 px-3 text-xs font-medium rounded-lg bg-neutral-100 dark:bg-neutral-700/40 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                        <span className="material-symbols-outlined text-[13px]">person</span>
                        Your request
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => { setRejectTarget(req); setRejectReason(""); }}
                          className="flex items-center gap-1 py-2 px-3 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleApprove(req)}
                          className="flex items-center gap-1 py-2 px-3 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors disabled:opacity-50"
                        >
                          {isActing ? (
                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          )}
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                  <span className="material-symbols-outlined text-[20px] text-red-600 dark:text-red-400" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Reject request</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{rejectTarget.approvable?.reference_number ?? `#${rejectTarget.approvable_id}`}</p>
                </div>
              </div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Reason for rejection <span className="text-red-500">*</span></label>
              <textarea
                className="form-input w-full h-28 resize-none"
                placeholder="Please provide a clear reason…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button type="button" onClick={() => setRejectTarget(null)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
              <button
                type="button"
                disabled={!rejectReason.trim() || actionLoading !== null}
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
