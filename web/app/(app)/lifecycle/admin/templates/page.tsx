"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authAccess";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

function apiError(err: unknown, fallback: string): string {
  const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const first = Object.values(ax.response?.data?.errors ?? {})[0]?.[0];
  return first || ax.response?.data?.message || fallback;
}

type TemplateRow = {
  id: number;
  code?: string;
  name?: string;
  lifecycle_type?: string;
  published_version?: { id?: number; version_number?: number } | null;
  draft_version?: { id?: number; version_number?: number; status?: string } | null;
};

export default function LifecycleTemplatesAdminPage() {
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();
  const user = getStoredUser();
  const canEdit = hasPermission(user, ["lifecycle.templates.edit", "lifecycle.admin"]);
  const canPublish = hasPermission(user, ["lifecycle.templates.publish", "lifecycle.admin"]);

  const templatesQuery = useQuery({
    queryKey: ["lifecycle", "templates"],
    queryFn: async () => (await lifecycleApi.listTemplates()).data.data,
  });

  const cloneDraft = useMutation({
    mutationFn: async (tpl: TemplateRow) => {
      const publishedId = Number(tpl.published_version?.id);
      if (!Number.isFinite(publishedId) || publishedId <= 0) {
        throw new Error("No published version to clone.");
      }
      const version = (await lifecycleApi.getTemplate(publishedId)).data.data;
      return lifecycleApi.createTemplate({
        code: tpl.code,
        name: tpl.name,
        lifecycle_type: tpl.lifecycle_type,
        definition: version.definition,
      });
    },
    onSuccess: () => {
      success("Draft created from the published journey");
      queryClient.invalidateQueries({ queryKey: ["lifecycle", "templates"] });
    },
    onError: (err) => toastError(apiError(err, "Could not create a draft.")),
  });

  const publish = useMutation({
    mutationFn: (id: number) => lifecycleApi.publishTemplate(id),
    onSuccess: () => {
      success("Draft published. Previous published version is archived.");
      queryClient.invalidateQueries({ queryKey: ["lifecycle", "templates"] });
    },
    onError: (err) => toastError(apiError(err, "Could not publish this draft.")),
  });

  return (
    <div className="page-container">
      <ModulePageHeader
        title="Journey templates"
        subtitle="Operational stages and tasks only — notice, probation, and terminal-payment gates stay in HR settings."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Employee Lifecycle", href: "/lifecycle" },
              { label: "Administration" },
              { label: "Templates" },
            ]}
          />
        }
      />

      <FormSection title="Published journeys">
        <QueryStatus
          isLoading={templatesQuery.isLoading}
          isError={templatesQuery.isError}
          error="Failed to load templates."
        />
        {!templatesQuery.isLoading && !templatesQuery.isError && (templatesQuery.data ?? []).length === 0 ? (
          <EmptyState title="No templates seeded" description="Run LifecycleJourneyTemplateSeeder for this tenant." />
        ) : null}
        {!templatesQuery.isLoading && (templatesQuery.data ?? []).length > 0 ? (
          <ul className="space-y-3">
            {(templatesQuery.data ?? []).map((raw) => {
              const tpl = raw as TemplateRow;
              const draft = tpl.draft_version;
              return (
                <li key={String(tpl.id)} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">{String(tpl.name)}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {String(tpl.code)} · {String(tpl.lifecycle_type)}
                      {tpl.published_version
                        ? ` · published v${String(tpl.published_version.version_number ?? "")}`
                        : " · no published version"}
                      {draft ? ` · draft v${String(draft.version_number ?? "")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={cloneDraft.isPending || publish.isPending || !canEdit || !tpl.published_version?.id || Boolean(draft?.id)}
                      onClick={() => cloneDraft.mutate(tpl)}
                    >
                      {draft?.id ? "Draft already open" : "New draft from published"}
                    </button>
                    {draft?.id && canPublish ? (
                      <button
                        type="button"
                        data-testid="lifecycle-template-publish"
                        className="btn-primary text-xs"
                        disabled={cloneDraft.isPending || publish.isPending}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Publish this draft?",
                            message: "The current published version becomes archived. Open cases keep the version they started on.",
                            confirmText: "Publish",
                          });
                          if (ok) publish.mutate(Number(draft.id));
                        }}
                      >
                        Publish draft
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </FormSection>
    </div>
  );
}
