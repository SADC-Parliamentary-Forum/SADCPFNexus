"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateShort } from "@/lib/utils";

export default function LifecycleMyTasksPage() {
  const tasksQuery = useQuery({
    queryKey: ["lifecycle", "my-tasks"],
    queryFn: async () => (await lifecycleApi.myTasks()).data.data,
  });
  const tasks = tasksQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="My lifecycle tasks"
        subtitle="Operational tasks from open onboarding and separation cases."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Employee Lifecycle", href: "/lifecycle" }, { label: "My tasks" }]} />
        }
      />

      <FormSection title="Assigned to you">
        {tasksQuery.isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : null}
        {tasksQuery.isError ? <p className="text-sm text-red-600">Failed to load tasks.</p> : null}
        {!tasksQuery.isLoading && tasks.length === 0 ? (
          <EmptyState title="No lifecycle tasks" description="Tasks from your cases and departmental queues appear here." />
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li key={String(task.id)}>
                <Link
                  href={`/lifecycle/cases/${task.case_id ?? ""}`}
                  className="card block p-4 hover:border-primary/30"
                >
                  <p className="font-semibold text-neutral-900">{String(task.title ?? "Task")}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {String(task.case_reference ?? "")}
                    {task.due_date ? ` · Due ${formatDateShort(String(task.due_date))}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
