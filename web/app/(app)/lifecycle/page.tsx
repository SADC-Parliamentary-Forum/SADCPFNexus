"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { StatusPill } from "@/components/ui/StatusPill";
import { LIFECYCLE_HUB_CARDS } from "@/lib/hubs/lifecycle";
import { formatDateShort } from "@/lib/utils";

export default function LifecycleDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["lifecycle", "dashboard"],
    queryFn: async () => (await lifecycleApi.dashboard()).data.data,
  });
  const casesQuery = useQuery({
    queryKey: ["lifecycle", "cases"],
    queryFn: async () => (await lifecycleApi.listCases()).data.data,
  });

  const stats = dashboardQuery.data;
  const cases = casesQuery.data ?? [];

  return (
    <div className="page-container">
      <ModulePageHeader
        title="Employee Lifecycle"
        subtitle="Onboarding, separation, and internal journeys with departmental tasks, clearance, and audit trail."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Employee Lifecycle" }]} />}
      />

      {dashboardQuery.isLoading ? (
        <QueryStatus isLoading loadingRows={5} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            { label: "Open onboarding", value: stats?.onboarding_open ?? 0, href: "/lifecycle/onboarding" },
            { label: "Open internal journeys", value: stats?.internal_open ?? 0, href: "/lifecycle/journeys" },
            { label: "Open separation", value: stats?.separation_open ?? 0, href: "/lifecycle/separation" },
            { label: "Awaiting clearance", value: stats?.awaiting_clearance ?? 0, href: "/lifecycle/separation" },
            { label: "Ready onboarding", value: stats?.ready_onboarding ?? 0, href: "/lifecycle/onboarding" },
          ].map((kpi) => (
            <Link key={kpi.label} href={kpi.href} className="card p-5 hover:shadow-elevated transition-all">
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{kpi.value}</p>
              <p className="text-xs text-neutral-500 mt-1">{kpi.label}</p>
            </Link>
          ))}
        </div>
      )}

      <ModuleHubCards cards={LIFECYCLE_HUB_CARDS} />

      <FormSection title="Recent cases" description="Latest onboarding, separation, and internal journey cases.">
        <QueryStatus
          isLoading={casesQuery.isLoading}
          isError={casesQuery.isError}
          error="Failed to load cases."
        />
        {!casesQuery.isLoading && !casesQuery.isError && cases.length === 0 ? (
          <EmptyState title="No lifecycle cases yet" description="Start onboarding, an internal journey, or separation from the tools above." />
        ) : null}
        {!casesQuery.isLoading && cases.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Employee</th>
                  <th>Start</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/lifecycle/cases/${row.id}`} className="text-primary font-medium">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="capitalize">{row.lifecycle_type}</td>
                    <td>{row.employee_name ?? "—"}</td>
                    <td>{row.start_date ? formatDateShort(row.start_date) : "—"}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </FormSection>
    </div>
  );
}
