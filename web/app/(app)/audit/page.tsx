"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { AUDIT_HUB_CARDS } from "@/lib/hubs/audit";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AuditDashboardPage() {
  const { t } = useI18n();
  const [view, setView] = useState<"auditor" | "management" | "sg">("auditor");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "dashboard", view],
    queryFn: async () => (await auditApi.dashboard(view)).data.data,
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ModulePageHeader
          title="audit.hub"
          subtitle="audit.hub.subtitle"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "audit.hub" }]} />}
        />
        <div className="flex flex-wrap gap-2">
          {(["auditor", "management", "sg"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${view === v ? "btn-primary border-transparent" : "btn-secondary"}`}
            >
              {t(`audit.view.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">{t("audit.loading")}</p>}
      {isError && <p className="text-sm text-red-600">{t("audit.loadError")}</p>}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(data)
            .filter(([k]) => k !== "role")
            .map(([key, value]) => {
              const labelKey = `audit.kpi.${key}`;
              const label = t(labelKey);
              return (
                <div key={key} className="card p-4">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    {label === labelKey ? key.replaceAll("_", " ") : label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{String(value)}</div>
                </div>
              );
            })}
        </div>
      )}

      <ModuleHubCards cards={AUDIT_HUB_CARDS} />
    </div>
  );
}
