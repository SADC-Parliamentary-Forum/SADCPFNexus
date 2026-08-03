"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi } from "@/lib/api";

export default function AssignmentsCapacityPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments-capacity"],
    queryFn: () => assignmentsApi.capacity().then((r) => r.data.data),
  });

  const assignees = (data?.assignees ?? []) as Array<{
    user_id: number;
    name?: string;
    job_title?: string | null;
    open_count?: number;
    overdue_count?: number;
    load_score?: number;
    load_band?: string;
  }>;
  const summary = data?.summary ?? {};

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/assignments" className="hover:text-neutral-700">Assignments</Link>
            <span>/</span>
            <span className="text-neutral-700">Capacity</span>
          </div>
          <h1 className="page-title">Team capacity</h1>
          <p className="page-subtitle">
            Open workload by assignee (priority-weighted). Not a performance score.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/assignments/calendar" className="btn-secondary text-sm">Calendar &amp; ICS</Link>
          <Link href="/assignments/workload" className="btn-secondary text-sm">Workload forecast</Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading capacity…</p>}
      {isError && <p className="text-sm text-red-700">Failed to load capacity view.</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Assignees</p>
          <p className="mt-1 text-2xl font-semibold">{summary.assignee_count ?? 0}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Open</p>
          <p className="mt-1 text-2xl font-semibold">{summary.open_total ?? 0}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Overdue</p>
          <p className="mt-1 text-2xl font-semibold">{summary.overdue_total ?? 0}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Open</th>
              <th className="px-4 py-3">Overdue</th>
              <th className="px-4 py-3">Load</th>
              <th className="px-4 py-3">Band</th>
            </tr>
          </thead>
          <tbody>
            {assignees.map((row) => (
              <tr key={row.user_id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-900">{row.name}</div>
                  {row.job_title && <div className="text-xs text-neutral-500">{row.job_title}</div>}
                </td>
                <td className="px-4 py-3">{row.open_count ?? 0}</td>
                <td className="px-4 py-3">{row.overdue_count ?? 0}</td>
                <td className="px-4 py-3">{row.load_score ?? 0}</td>
                <td className="px-4 py-3 capitalize">{row.load_band ?? "—"}</td>
              </tr>
            ))}
            {!isLoading && assignees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No open assignments in scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
