"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, type Assignment, type AssignmentStats } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const priorityConfig: Record<string, { label: string; cls: string; dot: string }> = {
  low:      { label: "Low",      cls: "badge-muted",    dot: "bg-neutral-400" },
  medium:   { label: "Medium",   cls: "badge-primary",  dot: "bg-blue-400" },
  high:     { label: "High",     cls: "badge-warning",  dot: "bg-amber-400" },
  critical: { label: "Critical", cls: "badge-danger",   dot: "bg-red-500" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:               { label: "Draft",              cls: "badge-muted" },
  issued:              { label: "Issued",             cls: "badge-primary" },
  awaiting_acceptance: { label: "Awaiting Acceptance",cls: "badge-warning" },
  accepted:            { label: "Accepted",           cls: "badge-primary" },
  active:              { label: "Active",             cls: "badge-success" },
  at_risk:             { label: "At Risk",            cls: "badge-warning" },
  blocked:             { label: "Blocked",            cls: "badge-danger" },
  delayed:             { label: "Delayed",            cls: "badge-danger" },
  completed:           { label: "Completed",          cls: "badge-success" },
  closed:              { label: "Closed",             cls: "badge-muted" },
  returned:            { label: "Returned",           cls: "badge-warning" },
  cancelled:           { label: "Cancelled",          cls: "badge-muted" },
};

function KpiCard({ label, value, icon, color, href }: {
  label: string; value: number; icon: string; color: string; href?: string;
}) {
  const inner = (
    <div className="card p-5 flex items-center gap-4 hover:shadow-elevated transition-all">
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-neutral-900">{value}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

function AssignmentRow({ a }: { a: Assignment }) {
  const p = priorityConfig[a.priority] ?? { label: a.priority, cls: "badge-muted", dot: "bg-neutral-400" };
  const s = statusConfig[a.status] ?? { label: a.status, cls: "badge-muted" };
  const isOverdue = !["closed", "cancelled"].includes(a.status) && new Date(a.due_date) < new Date();

  return (
    <Link
      href={`/assignments/${a.id}`}
      className="card block p-4 hover:border-primary/30 hover:shadow-elevated transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
            <span className="material-symbols-outlined text-primary text-[18px]">task_alt</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-mono text-neutral-400">{a.reference_number}</span>
              <span className={`badge ${s.cls}`}>{s.label}</span>
              <span className={`badge ${p.cls}`}>{p.label}</span>
              {isOverdue && <span className="badge badge-danger">Overdue</span>}
            </div>
            <p className="text-sm font-semibold text-neutral-900 truncate">{a.title}</p>
            <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-neutral-500">
              {a.assignee && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">person</span>
                  {a.assignee.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                Due {formatDateShort(a.due_date)}
              </span>
              {a.department && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">corporate_fare</span>
                  {a.department.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${a.progress_percent}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-400 w-6 text-right">{a.progress_percent}%</span>
          </div>
          {a.blocker_type && (
            <span className="flex items-center gap-1 text-[10px] text-red-500">
              <span className="material-symbols-outlined text-[12px]">block</span>
              Blocked
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function AssignmentsDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["assignments", "stats"],
    queryFn: () => assignmentsApi.stats().then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: recentRes, isLoading: listLoading } = useQuery({
    queryKey: ["assignments", "list", "recent"],
    queryFn: () =>
      assignmentsApi.list({ per_page: 8 }).then((r) => (r.data as any).data as Assignment[]),
    staleTime: 30_000,
  });

  const recent = recentRes ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Assignments & Oversight</h1>
          <p className="page-subtitle">Monitor accountability, task progress, and team performance.</p>
        </div>
        <Link href="/assignments/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          New Assignment
        </Link>
      </div>

      {/* KPI Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-5 h-20 animate-pulse bg-neutral-100" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Assignments"  value={stats.total}      icon="assignment"          color="bg-blue-50 text-blue-600"   href="/assignments/all" />
          <KpiCard label="Active"             value={stats.active}     icon="play_circle"         color="bg-green-50 text-green-600" href="/assignments/all?status=active" />
          <KpiCard label="Overdue"            value={stats.overdue}    icon="event_busy"          color="bg-red-50 text-red-600"     href="/assignments/overdue" />
          <KpiCard label="Due This Week"      value={stats.due_soon}   icon="schedule"            color="bg-amber-50 text-amber-600" />
          <KpiCard label="Awaiting Acceptance" value={stats.awaiting}  icon="pending_actions"     color="bg-purple-50 text-purple-600" href="/assignments/pending" />
          <KpiCard label="Blocked"            value={stats.blocked}    icon="block"               color="bg-red-50 text-red-600"     href="/assignments/blocked" />
          <KpiCard label="My Pending"         value={stats.my_pending} icon="assignment_late"     color="bg-orange-50 text-orange-600" />
          <KpiCard label="Closed"             value={stats.completed}  icon="check_circle"        color="bg-neutral-50 text-neutral-500" />
        </div>
      ) : null}

      {/* Recent Assignments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-700">Recent Assignments</h2>
          <Link href="/assignments/all" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all
            <span className="material-symbols-outlined text-[13px]">chevron_right</span>
          </Link>
        </div>

        {listLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 h-16 animate-pulse bg-neutral-50" />
            ))}
          </div>
        ) : recent.length > 0 ? (
          <div className="space-y-3">
            {recent.map((a) => <AssignmentRow key={a.id} a={a} />)}
          </div>
        ) : (
          <div className="card p-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
              <span className="material-symbols-outlined text-3xl text-neutral-300">task_alt</span>
            </div>
            <p className="mt-4 text-sm font-semibold text-neutral-600">No assignments yet</p>
            <p className="text-xs text-neutral-400 mt-1">Create your first assignment to get started.</p>
            <Link href="/assignments/create" className="btn-primary mt-5 inline-flex">
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              New Assignment
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
