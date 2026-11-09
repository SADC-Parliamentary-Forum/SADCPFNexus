"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const priorityConfig: Record<string, { label: string; cls: string }> = {
  low:      { label: "assignments.priority.low",      cls: "badge-muted" },
  medium:   { label: "assignments.priority.medium",   cls: "badge-primary" },
  high:     { label: "assignments.priority.high",     cls: "badge-warning" },
  critical: { label: "assignments.priority.critical", cls: "badge-danger" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:               { label: "assignments.status.draft",               cls: "badge-muted" },
  issued:              { label: "assignments.status.issued",              cls: "badge-primary" },
  awaiting_acceptance: { label: "assignments.status.awaiting_acceptance", cls: "badge-warning" },
  accepted:            { label: "assignments.status.accepted",            cls: "badge-primary" },
  active:              { label: "assignments.status.active",              cls: "badge-success" },
  at_risk:             { label: "assignments.status.at_risk",             cls: "badge-warning" },
  blocked:             { label: "assignments.status.blocked",             cls: "badge-danger" },
  delayed:             { label: "assignments.status.delayed",             cls: "badge-danger" },
  completed:           { label: "assignments.status.completed",           cls: "badge-success" },
  closed:              { label: "assignments.status.closed",              cls: "badge-muted" },
  returned:            { label: "assignments.status.returned",            cls: "badge-warning" },
  cancelled:           { label: "assignments.status.cancelled",           cls: "badge-muted" },
};

const STATUSES = ["all", "draft", "issued", "awaiting_acceptance", "active", "at_risk", "blocked", "completed", "closed"];

export default function AllAssignmentsPage() {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: res, isLoading, isError } = useQuery({
    queryKey: ["assignments", "list", statusFilter, search],
    queryFn: () => {
      const params: Record<string, string> = { per_page: "50" };
      if (statusFilter !== "all") params.status = statusFilter;
      if (search) params.search = search;
      return assignmentsApi.list(params).then((r) => (r.data as any).data as Assignment[]);
    },
    staleTime: 30_000,
  });

  const assignments = res ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <ModulePageHeader
        title={t("assignments.all.title")}
        subtitle={t("assignments.all.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assignments.all.title") }]} />}
      />
        <Link href="/assignments/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          {t("assignments.newAssignment")}
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">search</span>
        <input
          type="text"
          placeholder={t("assignments.searchPlaceholder")}
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
            {t(f === "all" ? "assignments.filter.all" : `assignments.status.${f}`)}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {t("assignments.loadFailed")}
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
            const sc = statusConfig[a.status];
            const pc = priorityConfig[a.priority];
            const s = sc ? { label: t(sc.label), cls: sc.cls } : { label: a.status, cls: "badge-muted" };
            const p = pc ? { label: t(pc.label), cls: pc.cls } : { label: a.priority, cls: "badge-muted" };
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
                        {isOverdue && <span className="badge badge-danger">{t("assignments.overdueBadge")}</span>}
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
                          {t("assignments.dueOn", { date: formatDateShort(a.due_date) })}
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
        <div className="card">
          <EmptyState icon="task_alt" title={t("assignments.noneFound")} />
        </div>
      )}
    </div>
  );
}
