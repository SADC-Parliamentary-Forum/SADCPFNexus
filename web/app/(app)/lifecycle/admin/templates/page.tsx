"use client";

import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";

export default function LifecycleTemplatesAdminPage() {
  const templatesQuery = useQuery({
    queryKey: ["lifecycle", "templates"],
    queryFn: async () => (await lifecycleApi.listTemplates()).data.data,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
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
        {templatesQuery.isLoading ? <p className="text-sm text-neutral-500">Loading templates…</p> : null}
        {templatesQuery.isError ? <p className="text-sm text-red-600">Failed to load templates.</p> : null}
        {!templatesQuery.isLoading && (templatesQuery.data ?? []).length === 0 ? (
          <EmptyState title="No templates seeded" description="Run LifecycleJourneyTemplateSeeder for this tenant." />
        ) : (
          <ul className="space-y-3">
            {(templatesQuery.data ?? []).map((tpl) => (
              <li key={String(tpl.id)} className="card p-4">
                <p className="font-semibold text-neutral-900">{String(tpl.name)}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {String(tpl.code)} · {String(tpl.lifecycle_type)}
                  {tpl.published_version
                    ? ` · v${String((tpl.published_version as { version_number?: number }).version_number ?? "")}`
                    : " · no published version"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
