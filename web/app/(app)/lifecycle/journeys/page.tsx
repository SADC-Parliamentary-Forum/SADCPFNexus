"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { lifecycleApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
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
    <div className="mx-auto max-w-6xl space-y-5">
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
            className="input w-full max-w-xs"
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
        {casesQuery.isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : null}
        {casesQuery.isError ? <p className="text-sm text-red-600">Failed to load internal journeys.</p> : null}
        {!casesQuery.isLoading && cases.length === 0 ? (
          <EmptyState title="No open internal journeys" description="Start a transfer, promotion, or probation review from the button above." />
        ) : (
          <ul className="space-y-3">
            {cases.map((row) => (
              <li key={row.id}>
                <Link href={`/lifecycle/cases/${row.id}`} className="card block p-4 hover:border-primary/30">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900">{row.reference}</p>
                      <p className="text-sm text-neutral-600">
                        {row.employee_name ?? "Employee"} · <span className="capitalize">{row.lifecycle_type}</span>
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
