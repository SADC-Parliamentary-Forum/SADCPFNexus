"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { decisionsApi } from "@/lib/api";

export default function DecisionsDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["decisions", "dashboard"],
    queryFn: async () => (await decisionsApi.dashboard()).data.data,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/decisions" className="text-sm text-neutral-500 hover:text-primary">← Decision Register</Link>
          <h1 className="mt-2 text-2xl font-semibold">Decisions dashboard</h1>
        </div>
        <Link href="/decisions/create" className="btn-primary">New decision</Link>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Failed to load dashboard.</p>}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total" value={data.total} />
          <Stat label="Overdue" value={data.overdue} />
          <Stat label="Open critical actions" value={data.open_critical_actions} />
          <Stat label="Adopted" value={data.by_status.adopted ?? 0} />
          <Stat label="In progress" value={data.by_status.in_progress ?? 0} />
          <Stat label="Implemented" value={data.by_status.implemented ?? 0} />
          <Stat label="Draft" value={data.by_status.draft ?? 0} />
          <Stat label="Closed" value={data.by_status.closed ?? 0} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
