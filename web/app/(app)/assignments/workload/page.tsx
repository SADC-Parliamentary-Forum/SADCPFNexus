"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi } from "@/lib/api";

export default function AssignmentsWorkloadPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments-workload"],
    queryFn: () => assignmentsApi.workloadForecast({ weeks: 4 }).then((r) => r.data.data),
  });

  const assignees = (data?.assignees ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Workload forecast</h1>
          <p className="page-subtitle">Hours/capacity projection (estimated hours; default 8h when unset).</p>
        </div>
        <Link href="/assignments/capacity" className="btn-secondary text-sm">Capacity bands</Link>
      </div>
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
