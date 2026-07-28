"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const priorityConfig: Record<string, { label: string; cls: string }> = {
  low: { label: "Low", cls: "badge-muted" },
  medium: { label: "Medium", cls: "badge-primary" },
  high: { label: "High", cls: "badge-warning" },
  urgent: { label: "Urgent", cls: "badge-warning" },
  critical: { label: "Critical", cls: "badge-danger" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "badge-muted" },
  issued: { label: "Issued", cls: "badge-primary" },
  awaiting_acceptance: { label: "Awaiting Acceptance", cls: "badge-warning" },
  accepted: { label: "Accepted", cls: "badge-primary" },
  active: { label: "Active", cls: "badge-success" },
  at_risk: { label: "At Risk", cls: "badge-warning" },
  blocked: { label: "Blocked", cls: "badge-danger" },
  delayed: { label: "Delayed", cls: "badge-danger" },
  completed: { label: "Completed", cls: "badge-success" },
  closed: { label: "Closed", cls: "badge-muted" },
  returned: { label: "Returned", cls: "badge-warning" },
  cancelled: { label: "Cancelled", cls: "badge-muted" },
};

type Fetcher = (params: Record<string, string>) => Promise<{ data: unknown }>;

export function AssignmentFilteredList({
  title,
  subtitle,
  queryKey,
  fetcher,
  fixedParams = {},
}: {
  title: string;
  subtitle: string;
  queryKey: string;
  fetcher: Fetcher;
  fixedParams?: Record<string, string>;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments", queryKey, fixedParams],
    queryFn: async () => {
      const res = await fetcher({ per_page: "50", ...fixedParams });
      const body = res.data as { data?: Assignment[] } | Assignment[];
      if (Array.isArray(body)) return body;
      return (body.data ?? []) as Assignment[];
    },
    staleTime: 30_000,
  });

  const assignments = data ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <Link href="/assignments/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          New Assignment
        </Link>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Failed to load assignments.</p>}

      {!isLoading && !isError && assignments.length === 0 && (
        <div className="card p-8 text-center text-neutral-500 text-sm">No assignments in this view.</div>
      )}

      <div className="space-y-3">
        {assignments.map((a) => {
          const p = priorityConfig[a.priority] ?? { label: a.priority, cls: "badge-muted" };
          const s = statusConfig[a.status] ?? { label: a.status, cls: "badge-muted" };
          const overdue = a.is_overdue_flag || a.deadline_state === "overdue";
          return (
            <Link
              key={a.id}
              href={`/assignments/${a.id}`}
              className="card block p-4 hover:border-primary/30 hover:shadow-elevated transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-neutral-400">{a.reference_number}</span>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    <span className={`badge ${p.cls}`}>{p.label}</span>
                    {overdue && <span className="badge badge-danger">Overdue</span>}
                    {a.deadline_state && a.deadline_state !== "overdue" && (
                      <span className="badge badge-muted">{a.deadline_state.replaceAll("_", " ")}</span>
                    )}
                    {a.source_type && a.source_type !== "manual" && (
                      <span className="badge badge-primary">{a.source_type}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-neutral-900 truncate">{a.title}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-neutral-500">
                    {a.assignee && <span>{a.assignee.name}</span>}
                    <span>Due {formatDateShort(a.due_date)}</span>
                    {a.review_status && a.review_status !== "none" && (
                      <span>Review: {a.review_status}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-neutral-400">{a.progress_percent}%</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export { assignmentsApi };
