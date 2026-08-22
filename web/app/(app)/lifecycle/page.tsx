"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
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
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Employee Lifecycle"
        subtitle="Onboarding and separation journeys with departmental tasks, clearance, and audit trail."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Employee Lifecycle" }]} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Open onboarding", value: stats?.onboarding_open ?? 0, href: "/lifecycle/onboarding" },
          { label: "Open separation", value: stats?.separation_open ?? 0, href: "/lifecycle/separation" },
          { label: "Awaiting clearance", value: stats?.awaiting_clearance ?? 0, href: "/lifecycle/separation" },
          { label: "Ready onboarding", value: stats?.ready_onboarding ?? 0, href: "/lifecycle/onboarding" },
        ].map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="card p-5 hover:shadow-elevated transition-all">
            <p className="text-2xl font-bold text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-500 mt-1">{kpi.label}</p>
          </Link>
        ))}
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-800">More lifecycle tools</summary>
        <div className="mt-4">
          <ModuleHubCards cards={LIFECYCLE_HUB_CARDS} />
        </div>
      </details>

      <FormSection title="Recent cases" description="Latest onboarding and separation cases.">
        {casesQuery.isLoading ? <p className="text-sm text-neutral-500">Loading cases…</p> : null}
        {casesQuery.isError ? <p className="text-sm text-red-600">Failed to load cases.</p> : null}
        {!casesQuery.isLoading && cases.length === 0 ? (
          <EmptyState title="No lifecycle cases yet" description="Start onboarding or separation from the tools above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b">
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Start</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, 20).map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">
                      <Link href={`/lifecycle/cases/${row.id}`} className="text-primary font-medium">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 capitalize">{row.lifecycle_type}</td>
                    <td className="py-2 pr-4">{row.employee_name ?? "—"}</td>
                    <td className="py-2 pr-4">{row.start_date ? formatDateShort(row.start_date) : "—"}</td>
                    <td className="py-2 capitalize">{row.status.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>
    </div>
  );
}
