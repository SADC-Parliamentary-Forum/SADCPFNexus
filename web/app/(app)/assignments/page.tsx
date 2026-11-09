"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, type Assignment, type AssignmentStats } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { ASSIGNMENTS_HUB_CARDS } from "@/lib/hubs/assignments";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const priorityConfig: Record<string, { label: string; cls: string; dot: string }> = {
  low:      { label: "assignments.priority.low",      cls: "badge-muted",    dot: "bg-neutral-400" },
  medium:   { label: "assignments.priority.medium",   cls: "badge-primary",  dot: "bg-blue-400" },
  high:     { label: "assignments.priority.high",     cls: "badge-warning",  dot: "bg-amber-400" },
  critical: { label: "assignments.priority.critical", cls: "badge-danger",   dot: "bg-red-500" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:               { label: "assignments.status.draft",              cls: "badge-muted" },
  issued:              { label: "assignments.status.issued",             cls: "badge-primary" },
  awaiting_acceptance: { label: "assignments.status.awaiting_acceptance",cls: "badge-warning" },
  accepted:            { label: "assignments.status.accepted",           cls: "badge-primary" },
  active:              { label: "assignments.status.active",             cls: "badge-success" },
  at_risk:             { label: "assignments.status.at_risk",            cls: "badge-warning" },
  blocked:             { label: "assignments.status.blocked",            cls: "badge-danger" },
  delayed:             { label: "assignments.status.delayed",            cls: "badge-danger" },
  completed:           { label: "assignments.status.completed",          cls: "badge-success" },
  closed:              { label: "assignments.status.closed",             cls: "badge-muted" },
  returned:            { label: "assignments.status.returned",           cls: "badge-warning" },
  cancelled:           { label: "assignments.status.cancelled",          cls: "badge-muted" },
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
  const { t } = useI18n();
  const pc = priorityConfig[a.priority];
  const sc = statusConfig[a.status];
  const p = pc ? { ...pc, label: t(pc.label) } : { label: a.priority, cls: "badge-muted", dot: "bg-neutral-400" };
  const s = sc ? { ...sc, label: t(sc.label) } : { label: a.status, cls: "badge-muted" };
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
              {isOverdue && <span className="badge badge-danger">{t("assignments.overdueBadge")}</span>}
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
                {t("assignments.dueOn", { date: formatDateShort(a.due_date) })}
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
              {t("assignments.status.blocked")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function AssignmentsDashboard() {
  const { t } = useI18n();
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
  const user = getStoredUser();
  const canOversee =
    isSystemAdmin(user) || hasPermission(user, ["assignments.team", "assignments.admin", "assignments.review"]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("assignments.hub.title")}
        subtitle={t("assignments.hub.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.assignments") }]} />}
        actions={
          <Link href="/assignments/create" className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add_task</span>
            {t("assignments.newAssignment")}
          </Link>
        }
      />

      {/* KPI Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-neutral-100 p-5" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label={t("assignments.hub.kpi.myPending")} value={stats.my_pending} icon="assignment_late" color="bg-orange-50 text-orange-600" href="/assignments/mine" />
          <KpiCard label={t("assignments.status.active")} value={stats.active} icon="play_circle" color="bg-green-50 text-green-600" href="/assignments/all?status=active" />
          <KpiCard label={t("assignments.hub.kpi.dueThisWeek")} value={stats.due_soon} icon="schedule" color="bg-amber-50 text-amber-600" />
          {canOversee ? (
            <>
              <KpiCard label={t("assignments.overdueBadge")} value={stats.overdue} icon="event_busy" color="bg-red-50 text-red-600" href="/assignments/overdue" />
              <KpiCard label={t("assignments.hub.kpi.awaitingAcceptance")} value={stats.awaiting} icon="pending_actions" color="bg-primary/10 text-primary" href="/assignments/pending" />
              <KpiCard label={t("assignments.status.blocked")} value={stats.blocked} icon="block" color="bg-red-50 text-red-600" href="/assignments/blocked" />
            </>
          ) : null}
        </div>
      ) : null}

      {/* Recent Assignments */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">{t("assignments.hub.recent")}</h2>
          <Link href="/assignments/all" className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
            {t("assignments.hub.viewAll")}
            <span className="material-symbols-outlined text-[13px]">chevron_right</span>
          </Link>
        </div>

        {listLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card h-16 animate-pulse bg-neutral-50 p-4" />
            ))}
          </div>
        ) : recent.length > 0 ? (
          <div className="space-y-3">
            {recent.map((a) => <AssignmentRow key={a.id} a={a} />)}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon="task_alt"
              title={t("assignments.hub.emptyTitle")}
              description={t("assignments.hub.emptyDescription")}
              action={
                <Link href="/assignments/create" className="btn-primary inline-flex">
                  <span className="material-symbols-outlined text-[18px]">add_task</span>
                  {t("assignments.newAssignment")}
                </Link>
              }
            />
          </div>
        )}
      </div>

      <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-700">{t("assignments.hub.moreTools")}</summary>
        <div className="mt-3">
          <ModuleHubCards cards={ASSIGNMENTS_HUB_CARDS.filter((card) => card.href !== "/assignments/create")} />
        </div>
      </details>
    </div>
  );
}
