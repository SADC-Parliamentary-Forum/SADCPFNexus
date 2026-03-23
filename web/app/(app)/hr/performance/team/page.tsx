"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { performanceTrackerApi, type PerformanceTracker } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  PerformanceTracker["status"],
  { label: string; badge: string }
> = {
  excellent: { label: "Excellent", badge: "badge-success" },
  strong: { label: "Strong", badge: "badge-primary" },
  satisfactory: { label: "Satisfactory", badge: "badge-muted" },
  watchlist: { label: "Watchlist", badge: "badge-warning" },
  at_risk: { label: "At Risk", badge: "badge-danger" },
  critical_review_required: { label: "Critical Review", badge: "badge-danger" },
};

const TREND_CONFIG: Record<
  PerformanceTracker["trend"],
  { label: string; icon: string; className: string }
> = {
  improving: { label: "Improving", icon: "arrow_upward", className: "text-green-600" },
  stable: { label: "Stable", icon: "remove", className: "text-neutral-500" },
  declining: { label: "Declining", icon: "trending_down", className: "text-red-600" },
  inconsistent: { label: "Inconsistent", icon: "shuffle", className: "text-amber-600" },
  insufficient_data: { label: "Insufficient Data", icon: "help_outline", className: "text-neutral-400" },
};

function TeamMemberCard({ tracker }: { tracker: PerformanceTracker }) {
  const router = useRouter();
  const statusConf = STATUS_CONFIG[tracker.status];
  const trendConf = TREND_CONFIG[tracker.trend];

  const completionRate = tracker.assignment_completion_rate ?? 0;
  const updateCompliance = (tracker as unknown as Record<string, unknown>).update_compliance_score as number | null ?? null;
  const commendations = (tracker as unknown as Record<string, unknown>).commendation_count as number ?? 0;
  const workloadScore = (tracker as unknown as Record<string, unknown>).workload_score as number | null ?? null;

  return (
    <div
      className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/hr/performance/${tracker.id}`)}
    >
      {/* Employee header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
            {tracker.employee?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-semibold text-neutral-900 text-sm">
              {tracker.employee?.name ?? `Employee #${tracker.employee_id}`}
            </p>
            <p className="text-xs text-neutral-400">{tracker.employee?.email}</p>
          </div>
        </div>
        <span className={cn("badge text-xs", statusConf.badge)}>{statusConf.label}</span>
      </div>

      <div className="text-xs text-neutral-400 mb-3">
        {formatDateShort(tracker.cycle_start)} – {formatDateShort(tracker.cycle_end)}
      </div>

      {/* Completion progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>Task completion</span>
          <span className="font-semibold text-neutral-700">{Math.round(completionRate)}%</span>
        </div>
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${completionRate >= 80 ? "bg-green-500" : completionRate >= 60 ? "bg-primary" : completionRate >= 40 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <div className="text-center p-2 bg-neutral-50 rounded-lg">
          <p className={cn("text-sm font-bold", tracker.overdue_task_count > 0 ? "text-red-600" : "text-neutral-700")}>
            {tracker.overdue_task_count}
          </p>
          <p className="text-[10px] text-neutral-500">Overdue</p>
        </div>
        <div className="text-center p-2 bg-neutral-50 rounded-lg">
          <p className="text-sm font-bold text-neutral-700">{tracker.timesheet_hours_logged ?? 0}h</p>
          <p className="text-[10px] text-neutral-500">Hours</p>
        </div>
        <div className="text-center p-2 bg-neutral-50 rounded-lg">
          <p className={cn("text-sm font-bold", commendations > 0 ? "text-green-600" : "text-neutral-400")}>
            {commendations}
          </p>
          <p className="text-[10px] text-neutral-500">Commend.</p>
        </div>
        <div className="text-center p-2 bg-neutral-50 rounded-lg">
          <p className="text-sm font-bold text-neutral-700">
            {updateCompliance != null ? `${updateCompliance}/10` : "—"}
          </p>
          <p className="text-[10px] text-neutral-500">Updates</p>
        </div>
      </div>

      {/* Workload indicator */}
      {workloadScore != null && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-neutral-500">Workload</span>
          <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${workloadScore >= 8 ? "bg-amber-400" : "bg-primary"}`}
              style={{ width: `${(workloadScore / 10) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-neutral-600">{workloadScore}/10</span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between flex-wrap gap-1 pt-2 border-t border-neutral-50">
        <span className={cn("flex items-center gap-1 text-xs font-medium", trendConf.className)}>
          <span className="material-symbols-outlined text-[14px]">{trendConf.icon}</span>
          {trendConf.label}
        </span>
        <div className="flex items-center gap-1">
          {tracker.active_warning_flag && <span className="badge badge-danger text-[10px] py-0.5 px-1.5">Warning</span>}
          {tracker.hr_attention_required && <span className="badge badge-warning text-[10px] py-0.5 px-1.5">HR</span>}
          {tracker.management_attention_required && <span className="badge badge-warning text-[10px] py-0.5 px-1.5">Mgmt</span>}
          {commendations > 0 && <span className="badge badge-success text-[10px] py-0.5 px-1.5">★ {commendations}</span>}
        </div>
      </div>
    </div>
  );
}

export default function TeamPerformancePage() {
  const router = useRouter();
  const [trackers, setTrackers] = useState<PerformanceTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await performanceTrackerApi.team();
        setTrackers(res.data.data);
      } catch {
        setError("Failed to load team performance data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute summary stats
  const total = trackers.length;
  const excellent = trackers.filter((t) => t.status === "excellent" || t.status === "strong").length;
  const watchlist = trackers.filter((t) => t.status === "watchlist").length;
  const atRisk = trackers.filter((t) => t.status === "at_risk" || t.status === "critical_review_required").length;
  const avgCompletion =
    trackers.length > 0
      ? trackers.reduce((acc, t) => acc + (t.assignment_completion_rate ?? 0), 0) / trackers.length
      : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-neutral-400 mb-1">
            <button onClick={() => router.push("/hr")} className="hover:text-neutral-600">HR</button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <button onClick={() => router.push("/hr/performance")} className="hover:text-neutral-600">Performance</button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">My Team</span>
          </nav>
          <h1 className="page-title">My Team Performance</h1>
          <p className="page-subtitle">Overview of your direct reports&apos; performance trackers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={cn("btn-secondary flex items-center gap-2", viewMode === "cards" ? "bg-primary/10 text-primary border-primary/30" : "")}
            onClick={() => setViewMode("cards")}
            title="Card view"
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
          </button>
          <button
            className={cn("btn-secondary flex items-center gap-2", viewMode === "table" ? "bg-primary/10 text-primary border-primary/30" : "")}
            onClick={() => setViewMode("table")}
            title="Table view"
          >
            <span className="material-symbols-outlined text-[18px]">table_rows</span>
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => router.push("/hr/performance/hr-dashboard")}
          >
            <span className="material-symbols-outlined text-[18px]">insights</span>
            HR Dashboard
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => router.push("/hr/performance")}
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            All Trackers
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Team Members", value: total, icon: "group", color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Excellent / Strong", value: excellent, icon: "emoji_events", color: "text-green-600", bg: "bg-green-50" },
            { label: "Watchlist", value: watchlist, icon: "warning", color: "text-amber-600", bg: "bg-amber-50" },
            { label: "At Risk", value: atRisk, icon: "crisis_alert", color: "text-red-600", bg: "bg-red-50" },
            { label: "Avg Completion", value: `${Math.round(avgCompletion)}%`, icon: "donut_large", color: "text-purple-600", bg: "bg-purple-50" },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2 flex-shrink-0", stat.bg)}>
                  <span className={cn("material-symbols-outlined text-[22px]", stat.color)}>{stat.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-800">{stat.value}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="card p-8 text-center text-red-500">
          <span className="material-symbols-outlined text-5xl">error</span>
          <p className="mt-2">{error}</p>
        </div>
      )}

      {/* Table view */}
      {!loading && !error && viewMode === "table" && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-neutral-900">Team performance — table view</h3>
          </div>
          {trackers.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <span className="material-symbols-outlined text-5xl block mb-2">group</span>
              <p>No direct reports found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>Trend</th>
                    <th>Completion</th>
                    <th>Overdue</th>
                    <th>Hours</th>
                    <th>Update Compliance</th>
                    <th>Workload</th>
                    <th>Commend.</th>
                    <th>Flags</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {trackers.map((t) => {
                    const s = STATUS_CONFIG[t.status];
                    const tr = TREND_CONFIG[t.trend];
                    const updateCompliance = (t as unknown as Record<string, unknown>).update_compliance_score as number | null ?? null;
                    const commendations = (t as unknown as Record<string, unknown>).commendation_count as number ?? 0;
                    const workloadScore = (t as unknown as Record<string, unknown>).workload_score as number | null ?? null;
                    return (
                      <tr key={t.id}>
                        <td className="font-medium text-neutral-900">{t.employee?.name ?? `#${t.employee_id}`}</td>
                        <td><span className={cn("badge text-xs", s.badge)}>{s.label}</span></td>
                        <td>
                          <span className={cn("flex items-center gap-1 text-xs font-medium", tr.className)}>
                            <span className="material-symbols-outlined text-[13px]">{tr.icon}</span>
                            {tr.label}
                          </span>
                        </td>
                        <td className="text-sm">
                          {t.assignment_completion_rate != null ? `${Math.round(t.assignment_completion_rate)}%` : "—"}
                        </td>
                        <td className="text-sm">
                          {t.overdue_task_count > 0 ? (
                            <span className="text-red-600 font-semibold">{t.overdue_task_count}</span>
                          ) : <span className="text-neutral-400">0</span>}
                        </td>
                        <td className="text-sm text-neutral-600">{t.timesheet_hours_logged ?? 0}h</td>
                        <td className="text-sm text-neutral-600">
                          {updateCompliance != null ? `${updateCompliance}/10` : "—"}
                        </td>
                        <td className="text-sm text-neutral-600">
                          {workloadScore != null ? `${workloadScore}/10` : "—"}
                        </td>
                        <td className="text-sm">
                          {commendations > 0 ? <span className="text-green-600 font-semibold">★ {commendations}</span> : <span className="text-neutral-300">—</span>}
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {t.active_warning_flag && <span className="badge badge-danger text-[10px] py-0.5">Warning</span>}
                            {t.hr_attention_required && <span className="badge badge-warning text-[10px] py-0.5">HR</span>}
                          </div>
                        </td>
                        <td className="text-right">
                          <button className="text-sm font-semibold text-primary hover:underline" onClick={() => router.push(`/hr/performance/${t.id}`)}>
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cards grid */}
      {viewMode === "cards" && (loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-neutral-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-3 bg-neutral-100 rounded animate-pulse w-3/4" />
                </div>
              </div>
              <div className="h-16 bg-neutral-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : trackers.length === 0 ? (
        <div className="card p-12 text-center text-neutral-400">
          <span className="material-symbols-outlined text-5xl block mb-2">group</span>
          <p className="font-medium">No direct reports found</p>
          <p className="text-sm mt-1">Team performance data will appear here once trackers are assigned</p>
        </div>
      ) : (
        <>
          {/* At-risk / watchlist section */}
          {(watchlist > 0 || atRisk > 0) && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>
                Needs Attention
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trackers
                  .filter((t) => t.status === "watchlist" || t.status === "at_risk" || t.status === "critical_review_required")
                  .map((t) => <TeamMemberCard key={t.id} tracker={t} />)}
              </div>
            </div>
          )}

          {/* Rest of team */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">people</span>
              All Team Members
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trackers.map((t) => <TeamMemberCard key={t.id} tracker={t} />)}
            </div>
          </div>
        </>
      ))}
    </div>
  );
}
