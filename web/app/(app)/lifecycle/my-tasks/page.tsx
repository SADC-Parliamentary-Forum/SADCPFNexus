"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authAccess";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { ClearanceEditor } from "@/components/lifecycle/ClearanceEditor";

function apiError(err: unknown, fallback: string): string {
  const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const first = Object.values(ax.response?.data?.errors ?? {})[0]?.[0];
  return first || ax.response?.data?.message || fallback;
}

export default function LifecycleMyTasksPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const user = getStoredUser();
  const canClearance = hasPermission(user, ["lifecycle.complete-department-tasks", "lifecycle.admin"]);

  const tasksQuery = useQuery({
    queryKey: ["lifecycle", "my-tasks"],
    queryFn: async () => (await lifecycleApi.myTasks()).data.data,
  });
  const tasks = tasksQuery.data ?? [];

  const completeTask = useMutation({
    mutationFn: ({ taskId, revision }: { taskId: number; revision: number }) =>
      lifecycleApi.completeTask(taskId, revision),
    onSuccess: () => {
      success("Task completed");
      queryClient.invalidateQueries({ queryKey: ["lifecycle"] });
    },
    onError: (err) => toastError(apiError(err, "Could not complete this task.")),
  });

  const updateClearance = useMutation({
    mutationFn: ({ taskId, clearance_status, revision }: { taskId: number; clearance_status: string; revision: number }) =>
      lifecycleApi.updateClearance(taskId, { clearance_status, revision }),
    onSuccess: () => {
      success("Clearance updated");
      queryClient.invalidateQueries({ queryKey: ["lifecycle"] });
    },
    onError: (err) => toastError(apiError(err, "Could not update clearance.")),
  });

  return (
    <div className="page-container">
      <ModulePageHeader
        title="My lifecycle tasks"
        subtitle="Complete departmental tasks and clearance from this queue. Open the case for exceptions and finalise."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Employee Lifecycle", href: "/lifecycle" }, { label: "My tasks" }]} />
        }
      />

      <FormSection title="Assigned to you">
        <QueryStatus isLoading={tasksQuery.isLoading} isError={tasksQuery.isError} error="Failed to load tasks." />
        {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length === 0 ? (
          <EmptyState title="No lifecycle tasks" description="Tasks from your cases and departmental queues appear here." />
        ) : null}
        {!tasksQuery.isLoading && tasks.length > 0 ? (
          <ul className="space-y-3">
            {tasks.map((task) => {
              const taskId = Number(task.id);
              const revision = Number(task.revision ?? 1);
              const clearance = task.clearance_status ? String(task.clearance_status) : "";
              return (
                <li key={String(task.id)} className="rounded-xl border border-neutral-200 p-4 space-y-3 dark:border-neutral-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link href={`/lifecycle/cases/${task.case_id ?? ""}`} className="min-w-0 hover:text-primary">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{String(task.title ?? "Task")}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {String(task.case_reference ?? "")}
                        {task.employee_name ? ` · ${String(task.employee_name)}` : ""}
                        {task.due_date ? ` · Due ${formatDateShort(String(task.due_date))}` : ""}
                      </p>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={String(task.status ?? "")} />
                      {task.status !== "completed" && !clearance ? (
                        <button
                          type="button"
                          data-testid="lifecycle-my-task-complete"
                          className="btn-secondary text-xs"
                          disabled={completeTask.isPending || updateClearance.isPending}
                          onClick={() => completeTask.mutate({ taskId, revision })}
                        >
                          Complete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {clearance && canClearance ? (
                    <ClearanceEditor
                      taskId={taskId}
                      current={clearance}
                      disabled={completeTask.isPending || updateClearance.isPending}
                      testId="lifecycle-my-task-clearance"
                      onSave={(status) =>
                        updateClearance.mutate({
                          taskId,
                          clearance_status: status,
                          revision,
                        })
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </FormSection>
    </div>
  );
}
