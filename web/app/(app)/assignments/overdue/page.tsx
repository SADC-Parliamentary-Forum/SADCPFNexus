"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export default function OverdueAssignmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["assignments", "list", "overdue"],
    queryFn: () =>
      assignmentsApi.list({ overdue: "true", per_page: 50 } as any)
        .then((r) => (r.data as any).data as Assignment[]),
    staleTime: 30_000,
  });

  const items = data ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/assignments" className="text-sm text-neutral-500 hover:text-primary">Assignments</Link>
        <span className="material-symbols-outlined text-[14px] text-neutral-400">chevron_right</span>
        <span className="text-sm font-medium text-neutral-700">Overdue</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
          <span className="material-symbols-outlined text-red-600 text-[20px]">event_busy</span>
        </div>
        <div>
          <h1 className="page-title">Overdue Assignments</h1>
          <p className="page-subtitle">Assignments that have passed their due date and are still open.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 h-16 animate-pulse bg-neutral-50" />
        ))}</div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((a) => {
            const daysOverdue = Math.ceil((Date.now() - new Date(a.due_date).getTime()) / 86400000);
            return (
              <Link key={a.id} href={`/assignments/${a.id}`} className="card block p-4 border-red-200 hover:border-red-300 hover:shadow-elevated transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-neutral-400">{a.reference_number}</span>
                      <span className="badge badge-danger">{daysOverdue}d overdue</span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">{a.title}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {a.assignee ? a.assignee.name : "No assignee"} • Due {formatDateShort(a.due_date)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-neutral-400 text-[20px]">chevron_right</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card p-14 text-center">
          <span className="material-symbols-outlined text-4xl text-green-400 block">check_circle</span>
          <p className="mt-3 text-sm text-neutral-600">No overdue assignments.</p>
        </div>
      )}
    </div>
  );
}
