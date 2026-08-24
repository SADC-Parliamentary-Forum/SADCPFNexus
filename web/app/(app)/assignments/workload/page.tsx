"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { assignmentsApi } from "@/lib/api";

export default function AssignmentsWorkloadPage() {
  const [weeks, setWeeks] = useState(4);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments-workload", weeks],
    queryFn: () => assignmentsApi.workloadForecast({ weeks }).then((r) => r.data.data),
  });

  const assignees = (data?.assignees ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
        title="Workload forecast"
        subtitle="Hours versus available capacity from estimated hours (8h default when unset). Not a surveillance ranking."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Workload forecast" }]} />}
      />
        <Link href="/assignments/capacity" className="btn-secondary text-sm">Capacity bands</Link>
      </div>
      <label className="card inline-flex items-center gap-2 p-3 text-sm" data-testid="workload-weeks">
        Weeks
        <select className="form-input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
          {[2, 4, 8, 12].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-700">Failed to load forecast.</p>}
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">Assignee</th><th className="p-2">Open</th><th className="p-2">Est. hours</th><th className="p-2">Available</th><th className="p-2">Util %</th><th className="p-2">Band</th></tr></thead>
          <tbody>
            {assignees.map((a) => (
              <tr key={String(a.user_id)} className="border-t border-neutral-200">
                <td className="p-2">{String(a.name)}</td>
                <td className="p-2">{String(a.open_count)}</td>
                <td className="p-2">{String(a.estimated_hours_total)}</td>
                <td className="p-2">{String(a.available_hours)}</td>
                <td className="p-2">{String(a.utilization_pct)}</td>
                <td className="p-2">{String(a.load_band)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
