"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LifecycleCaseDetailPage() {
  const { t } = useI18n();
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
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={String(data?.reference ?? t("lifecycle.case.fallbackTitle"))}
        subtitle={`${String(data?.lifecycle_type ?? "")} · ${String(data?.status ?? "")}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" },
              { label: String(data?.reference ?? t("lifecycle.case.crumb")) },
            ]}
          />
        }
      />

      {caseQuery.isLoading ? <p className="text-sm text-neutral-500">{t("lifecycle.case.loading")}</p> : null}
      {caseQuery.isError ? <p className="text-sm text-red-600">{t("lifecycle.case.loadFailed")}</p> : null}

      {data ? (
        <>
          <FormSection title={t("lifecycle.case.summary")}>
            <LabelledRecord
              value={{
                employee: (data.employee as { name?: string })?.name ?? "—",
                start_date: data.start_date ? formatDateShort(String(data.start_date)) : "—",
                notice_end: data.notice_end_date ? formatDateShort(String(data.notice_end_date)) : "—",
                terminal_payment: data.terminal_payment_blocked ? t("lifecycle.case.paymentBlocked") : t("lifecycle.case.paymentAllowed"),
                readiness: (data.readiness as { ready?: boolean })?.ready ? t("lifecycle.onboarding.ready") : t("lifecycle.case.notReady"),
                outstanding_assets: Array.isArray(data.outstanding_assets)
                  ? String((data.outstanding_assets as unknown[]).length)
                  : "0",
              }}
            />
          </FormSection>

          {Array.isArray(data.outstanding_assets) && data.outstanding_assets.length > 0 ? (
            <FormSection title={t("lifecycle.case.outstandingAssets")}>
              <p className="mb-3 text-sm text-amber-800">
                {t("lifecycle.case.outstandingAssetsHint")}
              </p>
              <ul className="space-y-2 text-sm">
                {(data.outstanding_assets as Array<{ id: number; tag_number?: string; name?: string; status?: string }>).map((asset) => (
                  <li key={asset.id} className="flex justify-between gap-3 border-b border-neutral-100 py-2">
                    <span className="font-mono">{asset.tag_number}</span>
                    <span>{asset.name}</span>
                    <span className="capitalize text-neutral-500">{asset.status}</span>
                  </li>
                ))}
              </ul>
            </FormSection>
          ) : null}

          {stages.map((stage) => (
            <FormSection key={stage.name} title={stage.name}>
              {(stage.tasks ?? []).length === 0 ? (
                <EmptyState title={t("lifecycle.case.noTasks")} />
              ) : (
                <ul className="space-y-3">
                  {(stage.tasks ?? []).map((task) => (
                    <li key={String(task.id)} className="card p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-neutral-900">{String(task.title)}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {String(task.assignee_role ?? "")}
                          {task.due_date ? ` · ${t("lifecycle.myTasks.due", { date: formatDateShort(String(task.due_date)) })}` : ""}
                          {task.mandatory === false ? ` · ${t("lifecycle.case.optional")}` : ""}
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
                            {t("lifecycle.case.complete")}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          ))}

          <FormSection title={t("lifecycle.case.timeline")}>
            {(timelineQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">{t("lifecycle.case.noEvents")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(timelineQuery.data ?? []).map((event) => (
                  <li key={String(event.id)} className="flex gap-3">
                    <span className="text-neutral-400 whitespace-nowrap">
                      {event.created_at ? formatDateShort(String(event.created_at)) : "—"}
                    </span>
                    <span>
                      {String(event.event_type)} · {String(event.actor ?? t("lifecycle.case.system"))}
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
