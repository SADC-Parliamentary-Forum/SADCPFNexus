"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeDashboardData } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  not_submitted: "badge-muted",
  submitted: "badge-warning",
  returned: "badge-danger",
  reviewed: "badge-primary",
  accepted: "badge-success",
  closed: "badge-muted",
};

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-600 w-40 truncate" title={label}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }} />
      </div>
      <span className="text-xs font-semibold text-neutral-700 w-8 text-right">{value}</span>
    </div>
  );
}

export default function MandeDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "dashboard"],
    queryFn: () => mandeApi.getDashboard().then((r) => r.data.data as MeDashboardData),
    staleTime: 30_000,
  });

  const k = data?.kpis;
  const maxGoal = Math.max(1, ...(data?.by_strategic_goal ?? []).map((g) => g.total));
  const maxArea = Math.max(1, ...(data?.by_thematic_area ?? []).map((a) => a.total));

  const KPIS = [
    { label: "Approved PIFs", value: k?.approved_pifs ?? 0, icon: "account_tree", color: "text-primary", bg: "bg-primary/10" },
    { label: "Awaiting Report", value: k?.awaiting_report ?? 0, icon: "pending_actions", color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Pending Review", value: k?.pending_review ?? 0, icon: "rate_review", color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Evidence Pending", value: k?.evidence_pending ?? 0, icon: "folder_open", color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Overdue Reports", value: k?.overdue_reports ?? 0, icon: "event_busy", color: "text-red-600", bg: "bg-red-50" },
    { label: "Indicators Updated", value: k?.indicators_updated ?? 0, icon: "speed", color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">M&amp;E Dashboard</h1>
          <p className="page-subtitle">Results monitoring across approved programmes — reporting, evidence and review status.</p>
        </div>
        <Link href="/mande/activity-reports/create" className="btn-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Activity Report
        </Link>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">Failed to load M&amp;E dashboard.</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="card px-4 py-4 flex flex-col gap-2">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${kpi.bg}`}>
              <span className={`material-symbols-outlined text-[20px] ${kpi.color}`}>{kpi.icon}</span>
            </div>
            <p className="text-2xl font-bold text-neutral-900 leading-none">{isLoading ? "—" : kpi.value}</p>
            <p className="text-[11px] text-neutral-500 leading-tight">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Activities by strategic goal */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">Activities by Strategic Goal</h2>
          <div className="space-y-2">
            {(data?.by_strategic_goal ?? []).map((g, i) => (
              <Bar key={i} label={g.goal_title} value={g.total} max={maxGoal} color="bg-indigo-400" />
            ))}
            {!isLoading && (data?.by_strategic_goal?.length ?? 0) === 0 && (
              <p className="text-xs text-neutral-400">No activity reports yet.</p>
            )}
          </div>
        </div>

        {/* Activities by thematic area */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">Activities by Thematic Area</h2>
          <div className="space-y-2">
            {(data?.by_thematic_area ?? []).map((a, i) => (
              <Bar key={i} label={a.area_name} value={a.total} max={maxArea} color="bg-teal-400" />
            ))}
            {!isLoading && (data?.by_thematic_area?.length ?? 0) === 0 && (
              <p className="text-xs text-neutral-400">No activity reports yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Review queue */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">M&amp;E Review Queue</h2>
          <Link href="/mande/review-queue" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {(data?.review_queue?.length ?? 0) === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">No reports awaiting review.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Reference</th><th>Activity</th><th>PIF</th><th>Status</th><th>Submitted</th><th></th></tr>
            </thead>
            <tbody>
              {data!.review_queue.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.reference_number}</td>
                  <td className="font-medium text-neutral-900">{r.activity_title}</td>
                  <td className="text-xs text-neutral-500">{r.pif_number ?? "—"}</td>
                  <td><span className={`badge ${STATUS_BADGE[r.review_status] ?? "badge-muted"}`}>{r.review_status.replace("_", " ")}</span></td>
                  <td className="text-xs text-neutral-400">{r.submitted_at ? formatDateShort(r.submitted_at) : "—"}</td>
                  <td><Link href={`/mande/activity-reports/${r.id}`} className="text-primary text-xs hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
