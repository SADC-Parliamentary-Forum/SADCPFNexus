"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const priorityConfig: Record<string, { label: string; cls: string }> = {
  low:      { label: "Low",      cls: "badge-muted" },
  medium:   { label: "Medium",   cls: "badge-primary" },
  high:     { label: "High",     cls: "badge-warning" },
  critical: { label: "Critical", cls: "badge-danger" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:               { label: "Draft",               cls: "badge-muted" },
  issued:              { label: "Issued",              cls: "badge-primary" },
  awaiting_acceptance: { label: "Awaiting Acceptance", cls: "badge-warning" },
  accepted:            { label: "Accepted",            cls: "badge-primary" },
  active:              { label: "Active",              cls: "badge-success" },
  at_risk:             { label: "At Risk",             cls: "badge-warning" },
  blocked:             { label: "Blocked",             cls: "badge-danger" },
  delayed:             { label: "Delayed",             cls: "badge-danger" },
  completed:           { label: "Completed",           cls: "badge-success" },
  closed:              { label: "Closed",              cls: "badge-muted" },
  returned:            { label: "Returned",            cls: "badge-warning" },
  cancelled:           { label: "Cancelled",           cls: "badge-muted" },
};

const STATUSES = ["All", "Draft", "Issued", "Awaiting Acceptance", "Active", "At Risk", "Blocked", "Completed", "Closed"];
const statusMap: Record<string, string | undefined> = {
  "All": undefined, "Draft": "draft", "Issued": "issued",
  "Awaiting Acceptance": "awaiting_acceptance", "Active": "active",
  "At Risk": "at_risk", "Blocked": "blocked", "Completed": "completed", "Closed": "closed",
};

export default function AllAssignmentsPage() {
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const { data: res, isLoading, isError } = useQuery({
    queryKey: ["assignments", "list", statusFilter, search],
    queryFn: () => {
      const params: Record<string, string> = { per_page: "50" };
      const s = statusMap[statusFilter];
      if (s) params.status = s;
      if (search) params.search = search;
      return assignmentsApi.list(params).then((r) => (r.data as any).data as Assignment[]);
    },
    staleTime: 30_000,
  });

  const assignments = res ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">All Assignments</h1>
          <p className="page-subtitle">Full list of assignments across the Secretariat.</p>
        </div>
        <Link href="/assignments/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          New Assignment
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">search</span>
        <input
          type="text"
          placeholder="Search assignments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input pl-9"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`filter-tab ${statusFilter === f ? "active" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load assignments.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 h-16 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : assignments.length > 0 ? (
        <div className="space-y-3">
          {assignments.map((a) => {
            const s = statusConfig[a.status] ?? { label: a.status, cls: "badge-muted" };
            const p = priorityConfig[a.priority] ?? { label: a.priority, cls: "badge-muted" };
            const isOverdue = !["closed", "cancelled"].includes(a.status) && new Date(a.due_date) < new Date();
            return (
              <Link
                key={a.id}
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
                      <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-neutral-500">
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${a.progress_percent}%` }} />
                    </div>
                    <span className="text-[10px] text-neutral-400">{a.progress_percent}%</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card p-14 text-center">
          <span className="material-symbols-outlined text-4xl text-neutral-300 block">task_alt</span>
          <p className="mt-3 text-sm text-neutral-500">No assignments found.</p>
        </div>
      )}
    </div>
  );
}
