"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Journey type filter; labels are catalog keys translated where they render. */
const TYPES = [
  { value: "", label: "lifecycle.journeys.filter.all" },
  { value: "transfer", label: "lifecycle.journeys.filter.transfer" },
  { value: "promotion", label: "lifecycle.journeys.filter.promotion" },
  { value: "probation", label: "lifecycle.journeys.filter.probation" },
] as const;

export default function LifecycleInternalJourneysPage() {
  const { t } = useI18n();
  const [type, setType] = useState("");
  const casesQuery = useQuery({
    queryKey: ["lifecycle", "cases", "internal", type],
    queryFn: async () => {
      const params: Record<string, string> = { status: "in_progress" };
      if (type) params.lifecycle_type = type;
      const rows = (await lifecycleApi.listCases(params)).data.data ?? [];
      if (type) return rows;
      return rows.filter((row) => ["transfer", "promotion", "probation"].includes(row.lifecycle_type));
    },
  });
  const cases = casesQuery.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.journeys.title")}
        subtitle={t("lifecycle.journeys.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" }, { label: t("lifecycle.journeys.title") }]} />
        }
        actions={
          <Link href="/lifecycle/journeys/new" className="btn-primary">
            {t("lifecycle.journeys.start")}
          </Link>
        }
      />

      <FormSection title={t("lifecycle.common.openCases")}>
        <div className="mb-4">
          <label htmlFor="lifecycle-internal-type" className="sr-only">
            {t("lifecycle.journeys.typeLabel")}
          </label>
          <select
            id="lifecycle-internal-type"
            className="input w-full max-w-xs"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </div>
        {casesQuery.isLoading ? <p className="text-sm text-neutral-500">{t("common.loading")}</p> : null}
        {casesQuery.isError ? <p className="text-sm text-red-600">{t("lifecycle.journeys.loadFailed")}</p> : null}
        {!casesQuery.isLoading && cases.length === 0 ? (
          <EmptyState title={t("lifecycle.journeys.empty")} description={t("lifecycle.journeys.emptyHint")} />
        ) : (
          <ul className="space-y-3">
            {cases.map((row) => (
              <li key={row.id}>
                <Link href={`/lifecycle/cases/${row.id}`} className="card block p-4 hover:border-primary/30">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900">{row.reference}</p>
                      <p className="text-sm text-neutral-600">
                        {row.employee_name ?? t("lifecycle.common.employee")} · <span className="capitalize">{row.lifecycle_type}</span>
                      </p>
                    </div>
                    <div className="text-right text-xs text-neutral-500">
                      <p>{row.start_date ? formatDateShort(row.start_date) : "—"}</p>
                      <p className="capitalize">{row.status}</p>
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
