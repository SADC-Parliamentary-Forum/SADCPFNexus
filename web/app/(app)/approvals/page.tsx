"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workflowApi, type ApprovalRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type InboxStatus = "awaiting" | "due" | "overdue" | "delegated" | "acting" | "completed";

const TABS: { id: InboxStatus; label: string }[] = [
  { id: "awaiting", label: "Awaiting" },
  { id: "due", label: "Due soon" },
  { id: "overdue", label: "Overdue" },
  { id: "delegated", label: "Delegated" },
  { id: "acting", label: "Acting" },
  { id: "completed", label: "Completed" },
];

const MODULE_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string; label: string; href: (id: number) => string }
> = {
  travel: {
    icon: "flight_takeoff",
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Travel",
    href: (id) => `/travel/${id}`,
  },
  leave: {
    icon: "event_available",
    color: "text-green-600 dark:text-green-300",
    bg: "bg-green-50 dark:bg-green-900/20",
    label: "Leave",
    href: (id) => `/leave/${id}`,
  },
  imprest: {
    icon: "account_balance_wallet",
    color: "text-amber-600 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    label: "Imprest",
    href: (id) => `/imprest/${id}`,
  },
  purchase_order: {
    icon: "receipt_long",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "LPO",
    href: (id) => `/procurement/purchase-orders/${id}`,
  },
  procurement: {
    icon: "shopping_cart",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "Procurement",
    href: (id) => `/procurement/${id}`,
  },
  advance: {
    icon: "payments",
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Advance",
    href: (id) => `/salary-advances/${id}`,
  },
  finance: {
    icon: "payments",
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Finance",
    href: (id) => `/salary-advances/${id}`,
  },
  governance: {
    icon: "gavel",
    color: "text-teal-600 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    label: "Governance",
    href: (id) => `/governance/${id}`,
  },
  correspondence: {
    icon: "mail",
    color: "text-sky-600 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-900/20",
    label: "Correspondence",
    href: (id) => `/correspondence/${id}`,
  },
  salary_advance: {
    icon: "payments",
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Salary Advance",
    href: (id) => `/salary-advances/${id}`,
  },
  programmes: {
    icon: "assignment",
    color: "text-indigo-600 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    label: "Programme",
    href: (id) => `/pif/${id}`,
  },
  hr: {
    icon: "badge",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "HR",
    // No single canonical HR request detail route yet — route to the inbox instead of a dead anchor.
    href: () => `/approvals`,
  },
  supplier: {
    icon: "storefront",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "Supplier",
    href: (id) => `/procurement/vendors/${id}`,
  },
  risk: {
    icon: "warning",
    color: "text-orange-600 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    label: "Risk",
    href: (id) => `/risk/${id}`,
  },
  weekly_report: {
    icon: "summarize",
    color: "text-cyan-600 dark:text-cyan-300",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    label: "Weekly Report",
    href: (id) => `/weekly-summaries/${id}`,
  },
  mande: {
    icon: "insights",
    color: "text-indigo-600 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    label: "M&E Report",
    href: (id) => `/mande/activity-reports/${id}`,
  },
  budget_submission: {
    icon: "account_balance",
    color: "text-teal-600 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    label: "Budget",
    href: (id) => `/budget/submissions/${id}`,
  },
  timesheet: {
    icon: "schedule",
    color: "text-amber-600 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    label: "Timesheet",
    href: (id) => `/timesheets/${id}`,
  },
};

/** Human labels for engine stage_type — never a generic "Approve" for a differentiated action (PRD §8). */
const STAGE_ACTION_LABELS: Record<string, string> = {
  recommend: "Recommend",
  certify: "Certify",
  verify: "Verify",
  authorise: "Authorise",
  approve: "Approve",
  sign: "Sign",
  acknowledge: "Acknowledge",
  accept: "Accept",
  review: "Review",
  prepare: "Prepare",
};

function stageActionLabel(req: ApprovalRequest): string {
  const stageType = req.workflow?.steps?.find((s) => s.step_order === req.current_step_index)?.stage_type;
  return STAGE_ACTION_LABELS[stageType ?? ""] ?? "Approve";
}

const DEFAULT_MODULE = {
  icon: "description",
  color: "text-neutral-600 dark:text-neutral-400",
  bg: "bg-neutral-100 dark:bg-neutral-700/40",
  label: "Request",
  // Unknown module types fall back to the general approvals inbox rather than a dead `#id` anchor.
  href: (_id: number) => `/approvals`,
};

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const currentUser = getStoredUser();
  const { toast } = useToast();
  const [tab, setTab] = useState<InboxStatus>("awaiting");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<{
    id: number;
    mode: "legacy" | "task";
    label: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selfApproveTarget, setSelfApproveTarget] = useState<{ id: number; label: string; actionLabel: string } | null>(
    null,
  );
  const [selfApproveComment, setSelfApproveComment] = useState("");
  const [recuseTarget, setRecuseTarget] = useState<{ id: number; label: string } | null>(null);
  const [recuseReason, setRecuseReason] = useState("");

  const { data: pending = [], isLoading: pendingLoading, isError: pendingError } = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => workflowApi.getPending().then((res) => res.data.data as ApprovalRequest[]),
    staleTime: 30_000,
    enabled: tab === "awaiting",
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["approvals", "inbox", tab],
    queryFn: async () => {
      const res = await workflowApi.getInbox({ status: tab });
      return res.data.data ?? [];
    },
    staleTime: 20_000,
  });

  const moduleTypes = useMemo(() => {
    const types = new Set(pending.map((r) => r.workflow?.module_type ?? "request"));
    return ["all", ...Array.from(types)];
  }, [pending]);

  const filteredPending = useMemo(
    () =>
      moduleFilter === "all"
        ? pending
        : pending.filter((r) => (r.workflow?.module_type ?? "request") === moduleFilter),
    [pending, moduleFilter],
  );

  const inboxRows = useMemo((): any[] => {
    if (tab === "awaiting" && tasks.length === 0) {
      return pending.map((p) => ({
        id: p.id,
        approval_request_id: p.id,
        stage_type: p.workflow?.module_type,
        status: "awaiting",
        due_at: null,
        assignment_reason: "Pending approval",
        approval_request: p,
      }));
    }
    return tasks as any[];
  }, [tab, tasks, pending]);

  const removeFromCache = (id: number) => {
    queryClient.setQueryData<ApprovalRequest[]>(["approvals", "pending"], (prev) =>
      prev?.filter((r) => r.id !== id) ?? [],
    );
  };

  const handleApproveLegacy = async (req: ApprovalRequest) => {
    setActionLoading(req.id);
    try {
      await workflowApi.approve(req.id);
      removeFromCache(req.id);
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast(
        "success",
        "Approved",
        `Request ${req.approvable?.reference_number ?? `#${req.approvable_id}`} has been approved.`,
      );
    } catch {
      toast("error", "Action Failed", "Could not approve the request.");
    } finally {
      setActionLoading(null);
    }
  };

  const decideTask = async (task: any, decision: "approve" | "reject", comment?: string) => {
    setActionLoading(task.id);
    try {
      if (task.approval_request_id && !task.uuid) {
        if (decision === "approve") await workflowApi.approve(task.approval_request_id);
        else await workflowApi.reject(task.approval_request_id, comment || "Rejected");
      } else {
        await workflowApi.decideTask(task.id, {
          decision_type: decision,
          comment: decision === "reject" ? comment || null : null,
          idempotency_key: `inbox-${task.id}-${decision}-${Date.now()}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast("success", decision === "approve" ? "Approved" : "Rejected", "Decision recorded.");
    } catch {
      toast("error", "Action failed", "Could not record decision.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    const reason = rejectReason.trim();
    setActionLoading(rejectTarget.id);
    try {
      if (rejectTarget.mode === "legacy") {
        await workflowApi.reject(rejectTarget.id, reason);
        removeFromCache(rejectTarget.id);
      } else {
        const task = inboxRows.find((r: any) => r.id === rejectTarget.id);
        if (task?.approval_request_id && !task.uuid) {
          await workflowApi.reject(task.approval_request_id, reason);
        } else if (task) {
          await workflowApi.decideTask(task.id, {
            decision_type: "reject",
            comment: reason,
            idempotency_key: `inbox-${task.id}-reject-${Date.now()}`,
          });
        } else {
          await workflowApi.reject(rejectTarget.id, reason);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast("success", "Rejected", `Request ${rejectTarget.label} has been rejected.`);
      setRejectTarget(null);
      setRejectReason("");
    } catch {
      toast("error", "Action Failed", "Could not reject the request.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelfApproveConfirm = async () => {
    if (!selfApproveTarget || !selfApproveComment.trim()) return;
    setActionLoading(selfApproveTarget.id);
    try {
      await workflowApi.approve(selfApproveTarget.id, selfApproveComment.trim());
      removeFromCache(selfApproveTarget.id);
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast(
        "success",
        "Self-authorised",
        `Request ${selfApproveTarget.label} has been approved in your institutional capacity.`,
      );
      setSelfApproveTarget(null);
      setSelfApproveComment("");
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        "This workflow does not permit self-authorisation. It must be actioned by another approver.";
      toast("error", "Action Failed", message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecuseConfirm = async () => {
    if (!recuseTarget || !recuseReason.trim()) return;
    setActionLoading(recuseTarget.id);
    try {
      await workflowApi.recuse(recuseTarget.id, recuseReason.trim());
      removeFromCache(recuseTarget.id);
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast(
        "success",
        "Recused",
        `You have declared a conflict of interest and been removed as an approver for ${recuseTarget.label}.`,
      );
      setRecuseTarget(null);
      setRecuseReason("");
    } catch (err: any) {
      const message = err?.response?.data?.message ?? "Could not record the recusal.";
      toast("error", "Action Failed", message);
    } finally {
      setActionLoading(null);
    }
  };

  const loading = tab === "awaiting" ? pendingLoading || tasksLoading : tasksLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Approvals"
        subtitle="Review awaiting, due, overdue, delegated, acting and completed approval tasks."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Approvals" }]} />}
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`filter-tab ${tab === t.id ? "active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "awaiting" && !pendingLoading && pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {moduleTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setModuleFilter(t)}
              className={`filter-tab capitalize${moduleFilter === t ? " active" : ""}`}
            >
              {t === "all"
                ? `All (${pending.length})`
                : `${MODULE_CONFIG[t]?.label ?? t} (${pending.filter((r) => (r.workflow?.module_type ?? "request") === t).length})`}
            </button>
          ))}
        </div>
      )}

      {pendingError && tab === "awaiting" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load pending approvals.
        </div>
      )}

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : tab === "awaiting" && filteredPending.length > 0 ? (
        <div className="space-y-3">
          {filteredPending.map((req) => {
            const moduleType = req.workflow?.module_type ?? "request";
            const mc = MODULE_CONFIG[moduleType] ?? DEFAULT_MODULE;
            const approvable = req.approvable;
            const isActing = actionLoading === req.id;
            const isOwnRequest =
              currentUser?.id != null &&
              (approvable?.requester?.id === currentUser.id ||
                (approvable as any)?.requester_id === currentUser.id);
            return (
              <div
                key={req.id}
                className="card p-5 transition-all hover:border-primary/30 hover:shadow-elevated"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${mc.bg}`}
                    >
                      <span
                        className={`material-symbols-outlined text-[24px] ${mc.color}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {mc.icon}
                      </span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {approvable?.reference_number ?? `Request #${req.approvable_id}`}
                        </h3>
                        <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-500 dark:border-neutral-700 dark:bg-neutral-700/40 dark:text-neutral-400">
                          {mc.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
                        {approvable?.requester?.name ?? "Staff member"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        Submitted {formatDateShort(req.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Link
                      href={mc.href(req.approvable_id)}
                      className="btn-secondary flex items-center gap-1 px-3 py-2 text-xs font-semibold"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      View
                    </Link>
                    {isOwnRequest ? (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => {
                          setSelfApproveTarget({
                            id: req.id,
                            label: approvable?.reference_number ?? `#${req.approvable_id}`,
                            actionLabel: stageActionLabel(req),
                          });
                          setSelfApproveComment("");
                        }}
                        className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-400"
                      >
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        Self-Authorisation
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isActing}
                          title="Declare a conflict of interest and remove yourself as an approver on this step"
                          onClick={() => {
                            setRecuseTarget({
                              id: req.id,
                              label: approvable?.reference_number ?? `#${req.approvable_id}`,
                            });
                            setRecuseReason("");
                          }}
                          className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                        >
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          Recuse
                        </button>
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => {
                            setRejectTarget({
                              id: req.id,
                              mode: "legacy",
                              label: approvable?.reference_number ?? `#${req.approvable_id}`,
                            });
                            setRejectReason("");
                          }}
                          className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleApproveLegacy(req)}
                          className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                        >
                          {isActing ? (
                            <span className="material-symbols-outlined animate-spin text-[14px]">
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          )}
                          {stageActionLabel(req)}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : tab !== "awaiting" || filteredPending.length === 0 ? (
        inboxRows.length === 0 || (tab === "awaiting" && filteredPending.length === 0 && tasks.length === 0) ? (
          <div className="card">
            <EmptyState
              icon={tab === "awaiting" ? "check_circle" : "inbox"}
              title={tab === "awaiting" ? "You're all caught up!" : "No items in this view"}
              description={
                tab === "awaiting"
                  ? moduleFilter === "all"
                    ? "No requests currently awaiting your approval."
                    : `No ${moduleFilter} requests pending.`
                  : "Switch tabs or check back when new approval tasks arrive."
              }
            />
          </div>
        ) : tab !== "awaiting" ? (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="data-table min-w-full text-sm">
              <caption className="sr-only">Approval tasks — {tab}</caption>
              <thead className="bg-neutral-50 text-left dark:bg-neutral-900/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 font-medium">Why me</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inboxRows.map((task: any) => (
                  <tr key={task.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2 capitalize">
                      {task.stage_type ?? task.decision_type ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {task.approval_request?.workflow?.module_type ?? "—"}
                      {task.approval_request?.reference ? (
                        <span className="block text-xs text-neutral-500">
                          {task.approval_request.reference}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {task.due_at ? formatDateShort(task.due_at) : "—"}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-neutral-600 dark:text-neutral-300">
                      {task.assignment_reason ?? "—"}
                    </td>
                    <td className="space-x-2 px-3 py-2">
                      {tab !== "completed" && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading === task.id}
                            onClick={() => decideTask(task, "approve")}
                            className="text-primary hover:underline disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === task.id}
                            onClick={() => {
                              setRejectTarget({
                                id: task.id,
                                mode: "task",
                                label: String(
                                  task.approval_request?.reference ??
                                    task.approval_request_id ??
                                    task.id,
                                ),
                              });
                              setRejectReason("");
                            }}
                            className="text-rose-600 hover:underline disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      ) : null}

      {rejectTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                  <span
                    className="material-symbols-outlined text-[20px] text-red-600 dark:text-red-400"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    cancel
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Reject request
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{rejectTarget.label}</p>
                </div>
              </div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Reason for rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                className="form-input h-28 w-full resize-none"
                placeholder="Please provide a clear reason…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || actionLoading !== null}
                onClick={handleRejectConfirm}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {selfApproveTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20">
                  <span
                    className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    person
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Self-Authorisation
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{selfApproveTarget.label}</p>
                </div>
              </div>
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                You are the applicant on this request and are also acting in your institutional capacity to{" "}
                {selfApproveTarget.actionLabel.toLowerCase()} it. This action is recorded as a self-authorisation
                and flagged in the audit trail. If this workflow does not permit self-authorisation, the action
                will be blocked and it must instead be actioned by another approver.
              </div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Comment <span className="text-red-500">*</span>
                <span className="ml-1 font-normal text-neutral-400">(required for self-authorisation)</span>
              </label>
              <textarea
                className="form-input h-28 w-full resize-none"
                placeholder="Explain why you are authorising your own request…"
                value={selfApproveComment}
                onChange={(e) => setSelfApproveComment(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={() => setSelfApproveTarget(null)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selfApproveComment.trim() || actionLoading !== null}
                onClick={handleSelfApproveConfirm}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Confirm self-authorisation
              </button>
            </div>
          </div>
        </div>
      )}

      {recuseTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700/40">
                  <span
                    className="material-symbols-outlined text-[20px] text-neutral-600 dark:text-neutral-300"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    block
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Declare conflict of interest
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{recuseTarget.label}</p>
                </div>
              </div>
              <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
                You will be removed as an approver for this step and an alternate approver will be notified. This
                does not approve or reject the request — it only removes you from the decision.
              </p>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                className="form-input h-28 w-full resize-none"
                placeholder="Describe the conflict of interest…"
                value={recuseReason}
                onChange={(e) => setRecuseReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={() => setRecuseTarget(null)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!recuseReason.trim() || actionLoading !== null}
                onClick={handleRecuseConfirm}
                className="flex items-center gap-2 rounded-lg bg-neutral-700 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                Confirm recusal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
