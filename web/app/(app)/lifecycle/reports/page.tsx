"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { formatDateShort } from "@/lib/utils";

export default function LifecycleReportsPage() {
  const onboardingQuery = useQuery({
    queryKey: ["lifecycle", "reports", "onboarding"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "onboarding" })).data.data,
  });
  const separationQuery = useQuery({
    queryKey: ["lifecycle", "reports", "separation"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "separation" })).data.data,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Lifecycle reports"
        subtitle="Phase 1 case lists — exit analytics deferred to Phase 2."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Employee Lifecycle", href: "/lifecycle" }, { label: "Reports" }]} />
        }
      />

      {[
        { title: "Onboarding cases", rows: onboardingQuery.data ?? [], loading: onboardingQuery.isLoading },
        { title: "Separation cases", rows: separationQuery.data ?? [], loading: separationQuery.isLoading },
      ].map((section) => (
        <FormSection key={section.title} title={section.title}>
          {section.loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b">
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Start</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">
                      <Link href={`/lifecycle/cases/${row.id}`} className="text-primary">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{row.employee_name ?? "—"}</td>
                    <td className="py-2 pr-4">{row.start_date ? formatDateShort(row.start_date) : "—"}</td>
                    <td className="py-2 capitalize">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormSection>
      ))}
    </div>
  );
}
