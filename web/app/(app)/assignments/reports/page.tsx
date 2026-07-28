"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { assignmentsApi } from "@/lib/api";

export default function AssignmentReportsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments", "reports"],
    queryFn: () => assignmentsApi.reportsSummary().then((r) => r.data),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Assignment Reports</h1>
        <p className="page-subtitle">
          Institutional workload and blocker analysis. Automated performance scores and leaderboards are disabled.
        </p>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Failed to load report.</p>}

      {data && (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Performance scoring: <strong>{data.performance_scoring}</strong> (PRD §116 — no leaderboards).
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Total", data.stats.total],
              ["Overdue", data.stats.overdue],
              ["Blocked", data.stats.blocked],
              ["Escalated", data.stats.escalated ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="card p-4">
                <p className="text-2xl font-bold text-neutral-900">{value as number}</p>
                <p className="text-xs text-neutral-500">{label as string}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">By source</h2>
              <ul className="space-y-1 text-sm">
                {Object.entries(data.by_source ?? {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="font-mono">{v}</span>
                  </li>
                ))}
                {Object.keys(data.by_source ?? {}).length === 0 && (
                  <li className="text-neutral-500">No source-linked assignments yet.</li>
                )}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">Blockers</h2>
              <ul className="space-y-1 text-sm">
                {Object.entries(data.blockers ?? {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k || "unspecified"}</span>
                    <span className="font-mono">{v}</span>
                  </li>
                ))}
                {Object.keys(data.blockers ?? {}).length === 0 && (
                  <li className="text-neutral-500">No active blockers.</li>
                )}
              </ul>
            </div>
          </div>

          <Link href="/assignments/register" className="btn-secondary inline-flex">
            Open Assignment Register
          </Link>
        </>
      )}
    </div>
  );
}
