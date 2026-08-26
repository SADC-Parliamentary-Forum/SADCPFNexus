"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { AUDIT_HUB_CARDS } from "@/lib/hubs/audit";
import { QueryStatus } from "@/components/ui/QueryStatus";

const VIEW_LABELS = {
  auditor: "Auditor",
  management: "Management",
  sg: "SG",
} as const;

export default function AuditDashboardPage() {
  const [view, setView] = useState<"auditor" | "management" | "sg">("auditor");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "dashboard", view],
    queryFn: async () => (await auditApi.dashboard(view)).data.data,
  });

  return (
    <div className="page-container">
      <ModulePageHeader
        title="Audit Management"
        subtitle="Engagements, findings, and corrective actions. Findings never auto-close."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Audit Management" }]} />}
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Dashboard view">
            {(Object.keys(VIEW_LABELS) as Array<keyof typeof VIEW_LABELS>).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`filter-tab ${view === v ? "active" : ""}`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        }
      />

      <QueryStatus isLoading={isLoading} isError={isError} error="Unable to load dashboard." loadingRows={4} />

      {data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data)
            .filter(([k]) => k !== "role")
            .map(([key, value]) => (
              <div key={key} className="card p-5">
                <p className="text-xs uppercase tracking-wide text-neutral-500">{key.replaceAll("_", " ")}</p>
                <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{String(value)}</p>
              </div>
            ))}
        </div>
      ) : null}

      <ModuleHubCards cards={AUDIT_HUB_CARDS} />
    </div>
  );
}
