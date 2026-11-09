"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LifecycleMyTasksPage() {
  const { t } = useI18n();
  const tasksQuery = useQuery({
    queryKey: ["lifecycle", "my-tasks"],
    queryFn: async () => (await lifecycleApi.myTasks()).data.data,
  });
  const tasks = tasksQuery.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.myTasks.title")}
        subtitle={t("lifecycle.myTasks.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" }, { label: t("lifecycle.myTasks.crumb") }]} />
        }
      />

      <FormSection title={t("lifecycle.myTasks.assigned")}>
        {tasksQuery.isLoading ? <p className="text-sm text-neutral-500">{t("common.loading")}</p> : null}
        {tasksQuery.isError ? <p className="text-sm text-red-600">{t("lifecycle.myTasks.loadFailed")}</p> : null}
        {!tasksQuery.isLoading && tasks.length === 0 ? (
          <EmptyState title={t("lifecycle.myTasks.empty")} description={t("lifecycle.myTasks.emptyHint")} />
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li key={String(task.id)}>
                <Link
                  href={`/lifecycle/cases/${task.case_id ?? ""}`}
                  className="card block p-4 hover:border-primary/30"
                >
                  <p className="font-semibold text-neutral-900">{String(task.title ?? t("lifecycle.myTasks.taskFallback"))}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {String(task.case_reference ?? "")}
                    {task.due_date ? ` · ${t("lifecycle.myTasks.due", { date: formatDateShort(String(task.due_date)) })}` : ""}
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
