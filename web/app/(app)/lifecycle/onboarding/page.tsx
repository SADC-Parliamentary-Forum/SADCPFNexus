"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateShort } from "@/lib/utils";

export default function LifecycleOnboardingQueuePage() {
  const casesQuery = useQuery({
    queryKey: ["lifecycle", "cases", "onboarding"],
    queryFn: async () =>
      (await lifecycleApi.listCases({ lifecycle_type: "onboarding", status: "in_progress" })).data.data,
  });
  const cases = casesQuery.data ?? [];

  return (
    <div className="page-container">
      <ModulePageHeader
        title="Onboarding queue"
        subtitle="Open onboarding cases and readiness status."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Employee Lifecycle", href: "/lifecycle" }, { label: "Onboarding" }]} />
        }
        actions={
          <Link href="/lifecycle/onboarding/create" className="btn-primary">
            Start onboarding
          </Link>
        }
      />

      <FormSection title="Open cases">
        <QueryStatus
          isLoading={casesQuery.isLoading}
          isError={casesQuery.isError}
          error="Failed to load onboarding cases."
        />
        {!casesQuery.isLoading && !casesQuery.isError && cases.length === 0 ? (
          <EmptyState title="No open onboarding cases" description="Start a case when an appointment is accepted." />
        ) : null}
        {!casesQuery.isLoading && cases.length > 0 ? (
          <ul className="space-y-3">
            {cases.map((row) => (
              <li key={row.id}>
                <Link href={`/lifecycle/cases/${row.id}`} className="card block p-4 hover:border-primary/30 hover:shadow-elevated transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{row.reference}</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">{row.employee_name ?? "Employee"}</p>
                    </div>
                    <div className="text-right text-xs text-neutral-500 space-y-1">
                      <p>{row.start_date ? formatDateShort(row.start_date) : "—"}</p>
                      <StatusPill value={row.readiness?.ready ? "ready" : "in_progress"} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </FormSection>
    </div>
  );
}
