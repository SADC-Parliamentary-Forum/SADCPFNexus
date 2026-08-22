"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

export default function LifecycleCaseDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = Number(params.id);
  const queryClient = useQueryClient();

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

  const completeTask = useMutation({
    mutationFn: ({ taskId, revision }: { taskId: number; revision: number }) =>
      lifecycleApi.completeTask(taskId, revision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle", "case", caseId] });
    },
  });

  const data = caseQuery.data;
  const stages = (data?.stages as Array<{ name: string; tasks: Array<Record<string, unknown>> }>) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title={String(data?.reference ?? "Lifecycle case")}
        subtitle={`${String(data?.lifecycle_type ?? "")} · ${String(data?.status ?? "")}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Employee Lifecycle", href: "/lifecycle" },
              { label: String(data?.reference ?? "Case") },
            ]}
          />
        }
      />

      {caseQuery.isLoading ? <p className="text-sm text-neutral-500">Loading case…</p> : null}
      {caseQuery.isError ? <p className="text-sm text-red-600">Failed to load case.</p> : null}

      {data ? (
        <>
          <FormSection title="Summary">
            <LabelledRecord
              value={{
                employee: (data.employee as { name?: string })?.name ?? "—",
                start_date: data.start_date ? formatDateShort(String(data.start_date)) : "—",
                notice_end: data.notice_end_date ? formatDateShort(String(data.notice_end_date)) : "—",
                terminal_payment: data.terminal_payment_blocked ? "Blocked pending clearance" : "Allowed",
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
                  {(stage.tasks ?? []).map((task) => (
                    <li key={String(task.id)} className="card p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-neutral-900">{String(task.title)}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {String(task.assignee_role ?? "")}
                          {task.due_date ? ` · Due ${formatDateShort(String(task.due_date))}` : ""}
                          {task.mandatory === false ? " · Optional" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-muted capitalize">{String(task.status)}</span>
                        {task.status !== "completed" ? (
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            disabled={completeTask.isPending}
                            onClick={() =>
                              completeTask.mutate({
                                taskId: Number(task.id),
                                revision: Number(task.revision ?? 1),
                              })
                            }
                          >
                            Complete
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          ))}

          <FormSection title="Timeline">
            {(timelineQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">No events recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(timelineQuery.data ?? []).map((event) => (
                  <li key={String(event.id)} className="flex gap-3">
                    <span className="text-neutral-400 whitespace-nowrap">
                      {event.created_at ? formatDateShort(String(event.created_at)) : "—"}
                    </span>
                    <span>
                      {String(event.event_type)} · {String(event.actor ?? "System")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
        </>
      ) : null}
    </div>
  );
}
