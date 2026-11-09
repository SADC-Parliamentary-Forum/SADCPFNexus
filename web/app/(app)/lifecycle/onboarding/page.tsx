"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LifecycleOnboardingQueuePage() {
  const { t } = useI18n();
  const casesQuery = useQuery({
    queryKey: ["lifecycle", "cases", "onboarding"],
    queryFn: async () =>
      (await lifecycleApi.listCases({ lifecycle_type: "onboarding", status: "in_progress" })).data.data,
  });
  const cases = casesQuery.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.onboarding.title")}
        subtitle={t("lifecycle.onboarding.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" }, { label: t("lifecycle.onboarding.crumb") }]} />
        }
        actions={
          <Link href="/lifecycle/onboarding/create" className="btn-primary">
            {t("lifecycle.onboarding.start")}
          </Link>
        }
      />

      <FormSection title={t("lifecycle.common.openCases")}>
        {casesQuery.isLoading ? <p className="text-sm text-neutral-500">{t("common.loading")}</p> : null}
        {casesQuery.isError ? <p className="text-sm text-red-600">{t("lifecycle.onboarding.loadFailed")}</p> : null}
        {!casesQuery.isLoading && cases.length === 0 ? (
          <EmptyState title={t("lifecycle.onboarding.empty")} description={t("lifecycle.onboarding.emptyHint")} />
        ) : (
          <ul className="space-y-3">
            {cases.map((row) => (
              <li key={row.id}>
                <Link href={`/lifecycle/cases/${row.id}`} className="card block p-4 hover:border-primary/30">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900">{row.reference}</p>
                      <p className="text-sm text-neutral-600">{row.employee_name ?? t("lifecycle.common.employee")}</p>
                    </div>
                    <div className="text-right text-xs text-neutral-500">
                      <p>{row.start_date ? formatDateShort(row.start_date) : "—"}</p>
                      <p>{row.readiness?.ready ? t("lifecycle.onboarding.ready") : t("lifecycle.onboarding.inProgress")}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
