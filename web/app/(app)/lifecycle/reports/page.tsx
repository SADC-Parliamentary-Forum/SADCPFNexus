"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi, type LifecycleAnalytics, type LifecycleCaseSummary } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateShort } from "@/lib/utils";

const TYPES: Array<{ key: string; label: string }> = [
  { key: "onboarding", label: "Onboarding" },
  { key: "separation", label: "Separation" },
  { key: "transfer", label: "Transfers" },
  { key: "promotion", label: "Promotions" },
  { key: "probation", label: "Probation" },
];

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{value}</p>
    </div>
  );
}

export default function LifecycleReportsPage() {
  const analyticsQuery = useQuery({
    queryKey: ["lifecycle", "analytics"],
    queryFn: async () => (await lifecycleApi.analytics()).data.data,
  });
  const onboardingQuery = useQuery({
    queryKey: ["lifecycle", "reports", "onboarding"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "onboarding" })).data.data,
  });
  const separationQuery = useQuery({
    queryKey: ["lifecycle", "reports", "separation"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "separation" })).data.data,
  });
  const transferQuery = useQuery({
    queryKey: ["lifecycle", "reports", "transfer"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "transfer" })).data.data,
  });
  const promotionQuery = useQuery({
    queryKey: ["lifecycle", "reports", "promotion"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "promotion" })).data.data,
  });
  const probationQuery = useQuery({
    queryKey: ["lifecycle", "reports", "probation"],
    queryFn: async () => (await lifecycleApi.listCases({ lifecycle_type: "probation" })).data.data,
  });

  const analytics: LifecycleAnalytics | undefined = analyticsQuery.data;
  const aging = analytics?.clearance_aging;

  return (
    <div className="page-container">
      <ModulePageHeader
        title="Lifecycle reports"
        subtitle="Cycle time, bottlenecks, and clearance aging for onboarding, separation, transfer, promotion, and probation."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Employee Lifecycle", href: "/lifecycle" }, { label: "Reports" }]} />
        }
      />

      <QueryStatus isError={analyticsQuery.isError} error="Could not load analytics. Refresh or try again." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Open exceptions" value={analytics?.exceptions_open ?? "—"} />
        <Kpi label="Clearance 0–7 days" value={aging?.["0_7"] ?? "—"} />
        <Kpi label="Clearance 8–14 days" value={aging?.["8_14"] ?? "—"} />
        <Kpi label="Clearance 15+ days" value={aging?.["15_plus"] ?? "—"} />
      </div>

      <FormSection title="Cycle time by journey">
        <QueryStatus isLoading={analyticsQuery.isLoading} />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Journey</th>
                <th>Open</th>
                <th>Completed</th>
                <th>Avg cycle (days)</th>
              </tr>
            </thead>
            <tbody>
              {TYPES.map((type) => {
                const row = analytics?.by_type[type.key];
                return (
                  <tr key={type.key}>
                    <td>{type.label}</td>
                    <td className="tabular-nums">{row?.open ?? "—"}</td>
                    <td className="tabular-nums">{row?.completed ?? "—"}</td>
                    <td className="tabular-nums">
                      {row?.avg_cycle_days == null ? "—" : row.avg_cycle_days}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormSection>

      <FormSection title="Open-task bottlenecks">
        {(analytics?.bottlenecks ?? []).length === 0 && !analyticsQuery.isLoading ? (
          <p className="text-sm text-neutral-500">No open tasks to rank.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(analytics?.bottlenecks ?? []).map((item) => (
              <li key={item.task_key} className="flex justify-between gap-4 border-b border-neutral-100 py-2 dark:border-neutral-800">
                <span>
                  {item.title}{" "}
                  <span className="text-neutral-500">({item.open_count} open)</span>
                </span>
                <span className="tabular-nums text-neutral-600">{item.avg_age_days} days</span>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {([
        { title: "Onboarding cases", rows: onboardingQuery.data ?? [], loading: onboardingQuery.isLoading },
        { title: "Transfer cases", rows: transferQuery.data ?? [], loading: transferQuery.isLoading },
        { title: "Promotion cases", rows: promotionQuery.data ?? [], loading: promotionQuery.isLoading },
        { title: "Probation cases", rows: probationQuery.data ?? [], loading: probationQuery.isLoading },
        { title: "Separation cases", rows: separationQuery.data ?? [], loading: separationQuery.isLoading },
      ] as Array<{ title: string; rows: LifecycleCaseSummary[]; loading: boolean }>).map((section) => (
        <FormSection key={section.title} title={section.title}>
          <QueryStatus isLoading={section.loading} />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Employee</th>
                  <th>Start</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/lifecycle/cases/${row.id}`} className="font-medium text-primary">
                        {row.reference}
                      </Link>
                    </td>
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
        </FormSection>
      ))}
    </div>
  );
}
