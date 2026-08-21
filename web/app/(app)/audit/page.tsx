"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { AUDIT_HUB_CARDS } from "@/lib/hubs/audit";

export default function AuditDashboardPage() {
  const [view, setView] = useState<"auditor" | "management" | "sg">("auditor");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "dashboard", view],
    queryFn: async () => (await auditApi.dashboard(view)).data.data,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ModulePageHeader
        title="Audit Management"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Audit Management" }]} />}
      />
        <div className="flex gap-2">
          {(["auditor", "management", "sg"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm rounded border ${view === v ? "bg-neutral-900 text-white" : "bg-white"}`}
            >
              {v === "sg" ? "SG" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading dashboard…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load dashboard.</p>}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(data)
            .filter(([k]) => k !== "role")
            .map(([key, value]) => (
              <div key={key} className="border border-neutral-200 rounded-lg p-4 bg-white">
                <div className="text-xs uppercase tracking-wide text-neutral-500">{key.replaceAll("_", " ")}</div>
                <div className="text-2xl font-semibold mt-2">{String(value)}</div>
              </div>
            ))}
        </div>
      )}

      <ModuleHubCards cards={AUDIT_HUB_CARDS} />
    </div>
  );
}
