"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authAccess";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { StatusPill } from "@/components/ui/StatusPill";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ClearanceEditor } from "@/components/lifecycle/ClearanceEditor";

type LifecycleTask = {
  id: number;
  title?: string;
  assignee_role?: string;
  due_date?: string | null;
  mandatory?: boolean;
  status?: string;
  clearance_status?: string | null;
  revision?: number;
};

type LifecycleException = {
  id: number;
  task_instance_id?: number;
  exception_type?: string;
  reason?: string;
  status?: string;
  resolution_notes?: string | null;
};

function apiError(err: unknown, fallback: string): string {
  const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const first = Object.values(ax.response?.data?.errors ?? {})[0]?.[0];
  return first || ax.response?.data?.message || fallback;
}

export default function LifecycleCaseDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = Number(params.id);
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();
  const user = getStoredUser();
  const canReopen = hasPermission(user, ["lifecycle.admin"]);
  const canClearance = hasPermission(user, ["lifecycle.complete-department-tasks", "lifecycle.admin"]);
  const canApproveException = hasPermission(user, ["lifecycle.approve-exceptions", "lifecycle.admin"]);
  const canTerminal = hasPermission(user, ["lifecycle.manage-separation", "lifecycle.admin"]);
  const canFinalise = hasPermission(user, ["lifecycle.finalise-separation", "lifecycle.admin"]);
  const [exceptionReasons, setExceptionReasons] = useState<Record<number, string>>({});
  const [exceptionNotes, setExceptionNotes] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [latestRevision, setLatestRevision] = useState<number | null>(null);

  const caseQuery = useQuery({
    queryKey: ["lifecycle", "case", caseId],
    queryFn: async () => (await lifecycleApi.showCase(caseId)).data.data,
    enabled: Number.isFinite(caseId),
  });

  const timelineQuery = useQuery({
    queryKey: ["lifecycle", "case", caseId, "timeline"],
    queryFn: async () => (await lifecycleApi.timeline(caseId)).data.data,
    enabled: Number.isFinite(caseId),
  });

  const terminalQuery = useQuery({
    queryKey: ["lifecycle", "case", caseId, "terminal-payment"],
    queryFn: async () => {
      try {
        return (await lifecycleApi.assertTerminalPayment(caseId)).data;
      } catch (err) {
        const ax = err as { response?: { data?: { allowed?: boolean; message?: string }; status?: number } };
        if (ax.response?.status === 422) {
          return { allowed: false, message: ax.response.data?.message ?? "Terminal payment is blocked." };
        }
        throw err;
      }
    },
    enabled: Number.isFinite(caseId) && caseQuery.data?.lifecycle_type === "separation",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["lifecycle", "case", caseId] });
    queryClient.invalidateQueries({ queryKey: ["lifecycle", "my-tasks"] });
  };

  const onMutateError = (err: unknown, fallback: string) => {
    const message = apiError(err, fallback);
    setActionError(message);
    toastError(message);
  };

  const completeTask = useMutation({
    mutationFn: ({ taskId, revision }: { taskId: number; revision: number }) =>
      lifecycleApi.completeTask(taskId, revision),
    onSuccess: () => {
      setActionError(null);
      success("Task completed");
      invalidate();
    },
    onError: (err) => onMutateError(err, "Could not complete this task."),
  });

  const reopenTask = useMutation({
    mutationFn: ({ taskId, revision }: { taskId: number; revision: number }) =>
      lifecycleApi.reopenTask(taskId, revision),
    onSuccess: () => {
      setActionError(null);
      success("Task reopened");
      invalidate();
    },
    onError: (err) => onMutateError(err, "Could not reopen this task."),
  });

  const updateClearance = useMutation({
    mutationFn: ({ taskId, clearance_status, revision }: { taskId: number; clearance_status: string; revision: number }) =>
      lifecycleApi.updateClearance(taskId, { clearance_status, revision }),
    onSuccess: () => {
      setActionError(null);
      success("Clearance updated");
      invalidate();
    },
    onError: (err) => onMutateError(err, "Could not update clearance."),
  });

  const requestException = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: number; reason: string }) =>
      lifecycleApi.requestException(taskId, reason),
    onSuccess: (_res, vars) => {
      setActionError(null);
      setExceptionReasons((prev) => ({ ...prev, [vars.taskId]: "" }));
      success("Exception requested");
      invalidate();
    },
    onError: (err) => onMutateError(err, "Could not request an exception."),
  });

  const approveException = useMutation({
    mutationFn: ({ exceptionId, notes }: { exceptionId: number; notes?: string }) =>
      lifecycleApi.approveException(exceptionId, notes),
    onSuccess: () => {
      setActionError(null);
      success("Exception approved");
      invalidate();
    },
    onError: (err) => onMutateError(err, "Could not approve this exception."),
  });

  const approveTerminal = useMutation({
    mutationFn: (revision: number) => lifecycleApi.approveTerminalPayment(caseId, revision),
    onSuccess: (res) => {
      const revision = (res.data as { data?: { revision?: number } })?.data?.revision;
      if (revision != null) setLatestRevision(Number(revision));
      setActionError(null);
      success("Terminal payment approved");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["lifecycle", "case", caseId, "terminal-payment"] });
    },
    onError: (err) => onMutateError(err, "Could not approve terminal payment."),
  });

  const finalise = useMutation({
    mutationFn: (revision: number) => lifecycleApi.finaliseSeparation(caseId, revision),
    onSuccess: () => {
      setActionError(null);
      success("Separation finalised");
      invalidate();
    },
    onError: (err) => onMutateError(err, "Could not finalise this case."),
  });

  const data = caseQuery.data;
  useEffect(() => {
    if (data?.revision != null) setLatestRevision(Number(data.revision));
  }, [data?.revision]);
  const stages = (data?.stages as Array<{ name: string; tasks: LifecycleTask[] }>) ?? [];
  const exceptions = (data?.exceptions as LifecycleException[] | undefined) ?? [];
  const isSeparation = data?.lifecycle_type === "separation";
  const caseRevision = latestRevision ?? Number(data?.revision ?? 1);
  const pending = completeTask.isPending || reopenTask.isPending || updateClearance.isPending
    || requestException.isPending || approveException.isPending || approveTerminal.isPending || finalise.isPending;

  return (
    <div className="page-container">
      <ModulePageHeader
        title={String(data?.reference ?? "Lifecycle case")}
        subtitle={`${String(data?.lifecycle_type ?? "").replaceAll("_", " ")} journey`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Employee Lifecycle", href: "/lifecycle" },
              { label: String(data?.reference ?? "Case") },
            ]}
          />
        }
        meta={data ? <StatusPill value={String(data.status ?? "")} /> : null}
      />

      <QueryStatus isLoading={caseQuery.isLoading} isError={caseQuery.isError} error="Failed to load case." />
      {actionError ? <div className="alert alert-error" role="alert">{actionError}</div> : null}

      {data ? (
        <>
          <FormSection title="Summary">
            <LabelledRecord
              value={{
                employee: (data.employee as { name?: string })?.name ?? "—",
                start_date: data.start_date ? formatDateShort(String(data.start_date)) : "—",
                notice_end: data.notice_end_date ? formatDateShort(String(data.notice_end_date)) : "—",
                clearance: data.clearance_status ?? "—",
                terminal_payment: data.terminal_payment_blocked ? "Blocked pending clearance" : "Allowed",
                terminal_approved: data.terminal_payment_approved_at
                  ? formatDateShort(String(data.terminal_payment_approved_at))
                  : "Not approved",
                readiness: (data.readiness as { ready?: boolean })?.ready ? "Ready" : "Not ready",
              }}
            />
          </FormSection>

          {stages.map((stage) => (
            <FormSection key={stage.name} title={stage.name}>
              {(stage.tasks ?? []).length === 0 ? (
                <EmptyState title="No tasks in this stage" />
              ) : (
                <ul className="space-y-3">
                  {(stage.tasks ?? []).map((task) => {
                    const taskId = Number(task.id);
                    const revision = Number(task.revision ?? 1);
                    const clearance = task.clearance_status ? String(task.clearance_status) : "";
                    return (
                      <li key={String(task.id)} className="rounded-xl border border-neutral-200 p-4 space-y-3 dark:border-neutral-700">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-neutral-100">{String(task.title)}</p>
                            <p className="text-xs text-neutral-500 mt-1">
                              {String(task.assignee_role ?? "")}
                              {task.due_date ? ` · Due ${formatDateShort(String(task.due_date))}` : ""}
                              {task.mandatory === false ? " · Optional" : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill value={String(task.status)} />
                            {clearance ? <StatusPill value={clearance} /> : null}
                            {task.status !== "completed" && !clearance ? (
                              <button
                                type="button"
                                className="btn-secondary text-xs"
                                disabled={pending}
                                onClick={() => completeTask.mutate({ taskId, revision })}
                              >
                                Complete
                              </button>
                            ) : null}
                            {task.status === "completed" && canReopen ? (
                              <button
                                type="button"
                                className="btn-secondary text-xs"
                                disabled={pending}
                                onClick={() => reopenTask.mutate({ taskId, revision })}
                              >
                                Reopen
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {isSeparation && task.clearance_status != null && canClearance ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <ClearanceEditor
                              taskId={taskId}
                              current={clearance}
                              disabled={pending}
                              testId="lifecycle-clearance-status"
                              onSave={(status) =>
                                updateClearance.mutate({
                                  taskId,
                                  clearance_status: status,
                                  revision,
                                })
                              }
                            />
                            {clearance === "not_cleared" ? (
                              <FormField label="Exception reason" htmlFor={`lifecycle-exception-reason-${taskId}`}>
                                <div className="flex gap-2">
                                  <input
                                    id={`lifecycle-exception-reason-${taskId}`}
                                    data-testid="lifecycle-exception-reason"
                                    className="form-input flex-1"
                                    value={exceptionReasons[taskId] ?? ""}
                                    onChange={(e) =>
                                      setExceptionReasons((prev) => ({ ...prev, [taskId]: e.target.value }))
                                    }
                                    placeholder="Why this clearance may be waived"
                                  />
                                  <button
                                    type="button"
                                    className="btn-secondary text-xs whitespace-nowrap"
                                    disabled={pending || !(exceptionReasons[taskId] ?? "").trim()}
                                    onClick={() =>
                                      requestException.mutate({
                                        taskId,
                                        reason: (exceptionReasons[taskId] ?? "").trim(),
                                      })
                                    }
                                  >
                                    Request exception
                                  </button>
                                </div>
                              </FormField>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </FormSection>
          ))}

          <FormSection title="Exceptions">
            {exceptions.length === 0 ? (
              <EmptyState title="No clearance exceptions" description="Exceptions appear here when a clearance is waived." />
            ) : (
              <ul className="space-y-3">
                {exceptions.map((exception) => (
                  <li key={exception.id} className="rounded-xl border border-neutral-200 p-4 space-y-2 dark:border-neutral-700">
                    <LabelledRecord
                      value={{
                        type: exception.exception_type,
                        status: exception.status,
                        reason: exception.reason,
                        notes: exception.resolution_notes ?? "—",
                      }}
                    />
                    {exception.status === "pending" && canApproveException ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <FormField label="Resolution notes" htmlFor={`lifecycle-exception-notes-${exception.id}`}>
                          <input
                            id={`lifecycle-exception-notes-${exception.id}`}
                            className="form-input w-full min-w-[16rem]"
                            value={exceptionNotes[exception.id] ?? ""}
                            onChange={(e) =>
                              setExceptionNotes((prev) => ({ ...prev, [exception.id]: e.target.value }))
                            }
                          />
                        </FormField>
                        <button
                          type="button"
                          className="btn-primary text-xs"
                          disabled={pending || !canApproveException}
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Approve this exception?",
                              message: "This records an authorised waiver. It does not post payroll.",
                              confirmText: "Approve",
                            });
                            if (!ok) return;
                            approveException.mutate({
                              exceptionId: exception.id,
                              notes: (exceptionNotes[exception.id] ?? "").trim() || undefined,
                            });
                          }}
                        >
                          Approve exception
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </FormSection>

          {isSeparation ? (
            <FormSection title="Separation closeout">
              <div className="space-y-3">
                <LabelledRecord
                  value={{
                    terminal_payment: terminalQuery.data?.allowed ? "Allowed" : "Blocked",
                    note: terminalQuery.data?.message ?? (data.terminal_payment_blocked
                      ? "Clearance must finish before payroll can release terminal payment."
                      : "Clearance is resolved. Approval records the payroll gate; it does not post a payment."),
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={pending || caseQuery.isFetching || !canTerminal || !terminalQuery.data?.allowed || Boolean(data.terminal_payment_approved_at)}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Approve terminal payment gate?",
                        message: "This records that clearance is resolved. It does not post a payment.",
                        confirmText: "Approve gate",
                      });
                      if (ok) approveTerminal.mutate(caseRevision);
                    }}
                  >
                    {data.terminal_payment_approved_at ? "Terminal payment approved" : "Approve terminal payment"}
                  </button>
                  <button
                    type="button"
                    data-testid="lifecycle-finalise"
                    className="btn-primary text-sm"
                    disabled={pending || caseQuery.isFetching || !canFinalise || data.status === "completed"}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Finalise this separation?",
                        message: "This closes the case after mandatory clearances are resolved. It does not post payroll.",
                        confirmText: "Finalise",
                        variant: "danger",
                      });
                      if (ok) finalise.mutate(caseRevision);
                    }}
                  >
                    Finalise separation
                  </button>
                </div>
              </div>
            </FormSection>
          ) : null}

          <FormSection title="Timeline" icon="history">
            {(timelineQuery.data ?? []).length === 0 ? (
              <EmptyState title="No events recorded yet" />
            ) : (
              <ol className="relative space-y-4 pl-2">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-neutral-100 dark:bg-neutral-800" aria-hidden />
                {(timelineQuery.data ?? []).map((event) => (
                  <li key={String(event.id)} className="relative flex gap-3 pl-8">
                    <span className="absolute left-2.5 top-1 flex h-3 w-3 rounded-full border-2 border-primary bg-white dark:bg-neutral-900" />
                    <span className="text-neutral-400 whitespace-nowrap text-xs pt-0.5">
                      {event.created_at ? formatDateShort(String(event.created_at)) : "—"}
                    </span>
                    <span className="text-sm">
                      {String(event.event_type).replaceAll("_", " ")} · {String(event.actor ?? "System")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </FormSection>
        </>
      ) : null}
    </div>
  );
}
