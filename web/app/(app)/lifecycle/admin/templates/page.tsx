"use client";

import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LifecycleTemplatesAdminPage() {
  const { t } = useI18n();
  const templatesQuery = useQuery({
    queryKey: ["lifecycle", "templates"],
    queryFn: async () => (await lifecycleApi.listTemplates()).data.data,
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.templates.title")}
        subtitle={t("lifecycle.templates.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" },
              { label: t("lifecycle.templates.crumbAdmin") },
              { label: t("lifecycle.templates.crumbTemplates") },
            ]}
          />
        }
      />

      <FormSection title={t("lifecycle.templates.published")}>
        {templatesQuery.isLoading ? <p className="text-sm text-neutral-500">{t("lifecycle.templates.loading")}</p> : null}
        {templatesQuery.isError ? <p className="text-sm text-red-600">{t("lifecycle.templates.loadFailed")}</p> : null}
        {!templatesQuery.isLoading && (templatesQuery.data ?? []).length === 0 ? (
          <EmptyState title={t("lifecycle.templates.empty")} description={t("lifecycle.templates.emptyHint")} />
        ) : (
          <ul className="space-y-3">
            {(templatesQuery.data ?? []).map((tpl) => (
              <li key={String(tpl.id)} className="card p-4">
                <p className="font-semibold text-neutral-900">{String(tpl.name)}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {String(tpl.code)} · {String(tpl.lifecycle_type)}
                  {tpl.published_version
                    ? ` · v${String((tpl.published_version as { version_number?: number }).version_number ?? "")}`
                    : ` · ${t("lifecycle.templates.noVersion")}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
