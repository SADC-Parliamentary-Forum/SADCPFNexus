"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateShort } from "@/lib/utils";

const TYPES = [
  { value: "", label: "All internal" },
  { value: "transfer", label: "Transfers" },
  { value: "promotion", label: "Promotions" },
  { value: "probation", label: "Probation" },
] as const;

export default function LifecycleInternalJourneysPage() {
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
    <div className="page-container">
      <ModulePageHeader
        title="Internal journeys"
        subtitle="Open transfer, promotion, and probation cases from published templates."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Employee Lifecycle", href: "/lifecycle" }, { label: "Internal journeys" }]} />
        }
        actions={
          <Link href="/lifecycle/journeys/new" className="btn-primary">
            Start journey
          </Link>
        }
      />

      <FormSection title="Open cases">
        <div className="mb-4">
          <label htmlFor="lifecycle-internal-type" className="sr-only">
            Journey type
          </label>
          <select
            id="lifecycle-internal-type"
            className="form-input w-full max-w-xs"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <QueryStatus
          isLoading={casesQuery.isLoading}
          isError={casesQuery.isError}
          error="Failed to load internal journeys."
        />
        {!casesQuery.isLoading && !casesQuery.isError && cases.length === 0 ? (
          <EmptyState title="No open internal journeys" description="Start a transfer, promotion, or probation review from the button above." />
        ) : null}
        {!casesQuery.isLoading && cases.length > 0 ? (
          <ul className="space-y-3">
            {cases.map((row) => (
              <li key={row.id}>
                <Link href={`/lifecycle/cases/${row.id}`} className="card block p-4 hover:border-primary/30 hover:shadow-elevated transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{row.reference}</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {row.employee_name ?? "Employee"} · <span className="capitalize">{row.lifecycle_type}</span>
                      </p>
                    </div>
                    <div className="text-right text-xs text-neutral-500 space-y-1">
                      <p>{row.start_date ? formatDateShort(row.start_date) : "—"}</p>
                      <StatusPill value={row.status} />
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
