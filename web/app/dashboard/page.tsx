"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  authApi, dashboardApi, travelApi, leaveApi, imprestApi, workplanApi, assignmentsApi,
  type AuthUser, type DashboardStats, type TravelRequest, type LeaveRequest, type ImprestRequest,
  type Assignment, type AssignmentStats,
} from "@/lib/api";
import { canAccessRoute, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import Link from "next/link";

const statConfig = [
  { key: "pending_approvals" as const, label: "Pending Approvals", icon: "pending_actions", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", href: "/approvals" },
  { key: "active_travels" as const, label: "Active Travels", icon: "flight_takeoff", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", href: "/travel" },
  { key: "leave_requests" as const, label: "Leave Requests", icon: "event_available", color: "text-green-600", bg: "bg-green-50", border: "border-green-100", href: "/leave" },
  { key: "open_requisitions" as const, label: "Open Requisitions", icon: "shopping_cart", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100", href: "/procurement" },
];

const quickActions = [
  { label: "New Travel Request",   href: "/travel/create",           icon: "flight_takeoff",         color: "text-primary",    bg: "bg-primary/10"  },
  { label: "Apply for Leave",      href: "/leave/create",            icon: "event_available",         color: "text-green-600",  bg: "bg-green-50"    },
  { label: "Request Imprest",      href: "/imprest/create",          icon: "account_balance_wallet",  color: "text-amber-600",  bg: "bg-amber-50"    },
  { label: "Salary Advance",       href: "/finance/advances/create", icon: "payments",                color: "text-purple-600", bg: "bg-purple-50"   },
  { label: "Procurement Request",  href: "/procurement/create",      icon: "shopping_cart",           color: "text-rose-600",   bg: "bg-rose-50"     },
  { label: "Timesheet",            href: "/hr/timesheets",           icon: "schedule",                color: "text-teal-600",   bg: "bg-teal-50"     },
];

const modules = [
  { label: "Travel",      href: "/travel",      icon: "flight_takeoff",         desc: "Missions & DSA"      },
  { label: "Leave",       href: "/leave",       icon: "event_available",        desc: "Leave management"    },
  { label: "Finance",     href: "/finance",     icon: "payments",               desc: "Payslips & advances" },
  { label: "Imprest",     href: "/imprest",     icon: "account_balance_wallet", desc: "Petty cash"          },
  { label: "Procurement", href: "/procurement", icon: "shopping_cart",          desc: "Requisitions"        },
  { label: "HR",          href: "/hr",          icon: "people",                 desc: "Timesheets & leave"  },
  { label: "Admin",       href: "/admin",       icon: "admin_panel_settings",   desc: "Users & settings"    },
];

interface ActivityItem {
  id: number;
  module: string;
  ref: string;
  status: string;
  date: string;
  href: string;
  icon: string;
  color: string;
}

const STATUS_BADGE: Record<string, string> = {
  approved: "badge-success", submitted: "badge-warning", pending_approval: "badge-warning",
  rejected: "badge-danger", draft: "badge-muted", cancelled: "badge-muted", liquidated: "badge-primary",
};

// ─── Widget config ─────────────────────────────────────────────────────────────
type WidgetId = "kpi_cards" | "quick_actions" | "recent_activity" | "upcoming_events" | "modules" | "assignments";
const ALL_WIDGETS: { id: WidgetId; label: string; icon: string }[] = [
  { id: "kpi_cards",        label: "KPI Summary Cards",   icon: "bar_chart"          },
  { id: "quick_actions",    label: "Quick Actions",        icon: "bolt"               },
  { id: "recent_activity",  label: "Recent Activity",      icon: "history"            },
  { id: "upcoming_events",  label: "Upcoming Events",      icon: "event"              },
  { id: "modules",          label: "Modules Grid",         icon: "grid_view"          },
  { id: "assignments",      label: "My Assignments",       icon: "assignment"         },
];
const WIDGET_PREFS_KEY = "sadcpf_dashboard_widgets";
function loadWidgetPrefs(): Record<WidgetId, boolean> {
  const defaults: Record<WidgetId, boolean> = {
    kpi_cards: true, quick_actions: true, recent_activity: true,
    upcoming_events: true, modules: true, assignments: true,
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(WIDGET_PREFS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch { return defaults; }
}

function StatPill({ label, value, color = "text-neutral-900", href }: {
  label: string; value: number; color?: string; href?: string;
}) {
  const inner = (
    <div className="flex flex-col items-center py-3 px-2 hover:bg-neutral-50 transition-colors cursor-pointer">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-neutral-400 mt-0.5">{label}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

function getDayOfMonth(dateStr: string): number | string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const n = d.getDate();
  return Number.isNaN(n) ? "" : n;
}

// Stable reference for query keys / date math — evaluated once on the client.
const _now = new Date();

export default function DashboardPage() {
  // ─── Widget customization ──────────────────────────────────────────────────
  const [widgetPrefs, setWidgetPrefs] = useState<Record<WidgetId, boolean>>({
    kpi_cards: true, quick_actions: true, recent_activity: true,
    upcoming_events: true, modules: true, assignments: true,
  });
  const [showCustomize, setShowCustomize] = useState(false);
  useEffect(() => { setWidgetPrefs(loadWidgetPrefs()); }, []);
  const toggleWidget = useCallback((id: WidgetId) => {
    setWidgetPrefs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const w = (id: WidgetId) => widgetPrefs[id] !== false;

  // ─── Greeting + date (client-only to avoid SSR hydration mismatch) ────────
  const [greeting, setGreeting] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    setDateLabel(now.toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    }));
  }, []);

  // ─── Query 1: current user (shared cache key — Header & Sidebar reuse it) ─
  const { data: user, isLoading: userLoading } = useQuery<AuthUser>({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me().then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // ─── Query 2: KPI stats ───────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: () => dashboardApi.getStats().then((r) => r.data),
    staleTime: 60_000,
  });

  const loading = userLoading || statsLoading;

  // ─── Query 3: recent activity (travel + leave + imprest in one round-trip) ─
  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityItem[]>({
    queryKey: ["dashboard", "activity"],
    queryFn: async () => {
      const [travRes, lvRes, impRes] = await Promise.all([
        travelApi.list({ per_page: 5 }).catch(() => null),
        leaveApi.list({ per_page: 5 }).catch(() => null),
        imprestApi.list({ per_page: 5 }).catch(() => null),
      ]);
      const items: ActivityItem[] = [];
      (((travRes?.data as { data?: TravelRequest[] })?.data) ?? []).forEach((r) =>
        items.push({ id: r.id, module: "Travel", ref: r.reference_number, status: r.status, date: r.created_at, href: `/travel/${r.id}`, icon: "flight_takeoff", color: "text-primary bg-primary/10" })
      );
      (((lvRes?.data as { data?: LeaveRequest[] })?.data) ?? []).forEach((r) =>
        items.push({ id: r.id, module: "Leave", ref: r.reference_number, status: r.status, date: r.created_at, href: `/leave/${r.id}`, icon: "event_available", color: "text-green-600 bg-green-50" })
      );
      (((impRes?.data as { data?: ImprestRequest[] })?.data) ?? []).forEach((r) =>
        items.push({ id: r.id, module: "Imprest", ref: r.reference_number, status: r.status, date: r.created_at, href: `/imprest/${r.id}`, icon: "account_balance_wallet", color: "text-amber-600 bg-amber-50" })
      );
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return items.slice(0, 8);
    },
    staleTime: 60_000,
  });

  // ─── Query 4: upcoming workplan events + social (cached 5 min) ────────────
  const { data: upcomingEvents = [] } = useQuery<{ id: number | string; title: string; date: string; type: string }[]>({
    queryKey: ["dashboard", "upcoming", _now.getFullYear(), _now.getMonth()],
    queryFn: async () => {
      const today = _now.toISOString().slice(0, 10);
      const [workplanRes, socialRes] = await Promise.all([
        workplanApi.list({ year: _now.getFullYear(), month: _now.getMonth() + 1 }).catch(() => null),
        dashboardApi.getUpcomingSocial().catch(() => null),
      ]);
      const work: { id: number | string; title: string; date: string; type: string }[] = [];
      const all = workplanRes?.data
        ? Array.isArray(workplanRes.data) ? workplanRes.data : (workplanRes.data as { data?: unknown[] })?.data ?? []
        : [];
      (Array.isArray(all) ? all : []).forEach((item) => {
        const e = item as { id?: number; title?: string; date?: string; type?: string };
        const date = e.date ?? "";
        if (date >= today) work.push({ id: e.id ?? 0, title: e.title ?? "", date, type: e.type ?? "milestone" });
      });
      const social = socialRes?.data?.data ?? [];
      return [...work, ...social].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
    },
    staleTime: 5 * 60_000,
  });

  // ─── Query 5: assignment stats (always fetch — filtered server-side by role) ─
  const { data: assignStats } = useQuery<AssignmentStats>({
    queryKey: ["dashboard", "assignment-stats"],
    queryFn: () => assignmentsApi.stats().then((r) => r.data),
    staleTime: 60_000,
  });

  // ─── Query 6: attention-needed assignments (overdue or blocked/at-risk) ─────
  const { data: urgentAssignments = [] } = useQuery<Assignment[]>({
    queryKey: ["dashboard", "urgent-assignments"],
    queryFn: () =>
      assignmentsApi.list({ per_page: 5, overdue: "true" } as any)
        .then((r) => (r.data as any).data as Assignment[]),
    staleTime: 60_000,
  });

  // ─── Derived ───────────────────────────────────────────────────────────────
  const modulesToShow = modules.filter((m) => canAccessRoute(user ?? null, m.href));
  const quickActionsToShow = quickActions.filter((q) => canAccessRoute(user ?? null, q.href));
  const isAdmin = isSystemAdmin(user ?? null);
  const isSG = user?.roles?.some((r) => r === "Secretary General" || r === "SG") ?? false;
  const showFullAssignments = isAdmin || isSG;

  const EVENT_COLOR: Record<string, string> = {
    meeting: "bg-primary/10 text-primary", travel: "bg-blue-50 text-blue-600",
    leave: "bg-green-50 text-green-600", milestone: "bg-purple-50 text-purple-600",
    deadline: "bg-red-50 text-red-600", birthday: "bg-pink-50 text-pink-600",
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Greeting header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {dateLabel} · Here&apos;s your workspace overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCustomize(true)}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs"
          >
            <span className="material-symbols-outlined text-[15px]">tune</span>
            Customize
          </button>
          {isAdmin && (
            <Link href="/admin" className="btn-secondary flex items-center gap-2 py-2 px-3 text-xs">
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              Admin Panel
            </Link>
          )}
        </div>
      </div>

      {/* Customization Modal */}
      {showCustomize && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-sm w-full shadow-2xl border border-neutral-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-primary text-[20px]">dashboard_customize</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Customize Dashboard</h3>
                <p className="text-xs text-neutral-400">Show or hide sections</p>
              </div>
              <button type="button" onClick={() => setShowCustomize(false)} className="ml-auto text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-2">
              {ALL_WIDGETS.map((w_) => (
                <label key={w_.id} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 cursor-pointer hover:bg-neutral-100 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-neutral-400">{w_.icon}</span>
                    <span className="text-sm font-medium text-neutral-800">{w_.label}</span>
                  </div>
                  <div
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${widgetPrefs[w_.id] ? "bg-primary" : "bg-neutral-200"}`}
                    onClick={() => toggleWidget(w_.id)}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${widgetPrefs[w_.id] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-400 mt-4 text-center">Preferences are saved in your browser.</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {w("kpi_cards") && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statConfig.map(({ key, label, icon, color, bg, border, href }) => (
          <Link key={key} href={href} className={`card p-5 border ${border} hover:shadow-elevated transition-all hover:border-primary/30 group`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{label}</p>
                <p className="mt-2 text-3xl font-bold text-neutral-900">
                  {loading
                    ? <span className="inline-block h-8 w-12 animate-pulse rounded-md bg-neutral-100" />
                    : stats ? String(stats[key]) : "—"}
                </p>
                <p className="mt-1 text-xs text-neutral-400 group-hover:text-primary transition-colors">View →</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg}`}>
                <span className={`material-symbols-outlined ${color} text-[22px]`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Two-column: Recent Activity + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-neutral-400 text-[18px]">history</span>
              <h3 className="text-sm font-semibold text-neutral-900">Recent Activity</h3>
            </div>
            <Link href="/travel" className="text-xs text-neutral-400 hover:text-primary transition-colors">View all</Link>
          </div>
          {activityLoading ? (
            <div className="divide-y divide-neutral-50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex gap-3 items-center">
                  <div className="h-8 w-8 rounded-full bg-neutral-100 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-neutral-100 animate-pulse rounded" />
                    <div className="h-2.5 w-24 bg-neutral-100 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <span className="material-symbols-outlined text-4xl text-neutral-200">inbox</span>
              <p className="mt-2 text-sm text-neutral-400">No recent activity</p>
              <div className="flex justify-center gap-3 mt-4">
                <Link href="/travel/create" className="btn-primary text-xs py-2 px-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">add</span>New Travel
                </Link>
                <Link href="/leave/create" className="btn-secondary text-xs py-2 px-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">add</span>Apply Leave
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {activity.map((a) => {
                const [iconColor, bgColor] = a.color.split(" ");
                return (
                  <Link key={`${a.module}-${a.id}`} href={a.href} className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors group">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${bgColor}`}>
                      <span className={`material-symbols-outlined text-[15px] ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-800 truncate">{a.ref}</span>
                        <span className="text-[10px] text-neutral-400 uppercase font-medium">{a.module}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">{formatDateShort(a.date)}</p>
                    </div>
                    <span className={`badge text-[10px] ${STATUS_BADGE[a.status] ?? "badge-muted"}`}>{a.status.replace(/_/g, " ")}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Workplan Events */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-neutral-400 text-[18px]">calendar_month</span>
              <h3 className="text-sm font-semibold text-neutral-900">Upcoming Events</h3>
            </div>
            <Link href="/workplan" className="text-xs text-neutral-400 hover:text-primary transition-colors">View all</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <span className="material-symbols-outlined text-3xl text-neutral-200">calendar_today</span>
              <p className="text-xs text-neutral-400 mt-2">No upcoming events</p>
              <Link href="/workplan/new" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">Add event</Link>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {upcomingEvents.map((e) => {
                const isSocial = e.type === "birthday" || typeof e.id === "string";
                const content = (
                  <>
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${EVENT_COLOR[e.type] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {e.type === "birthday"
                        ? <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>cake</span>
                        : getDayOfMonth(e.date)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-800 truncate">{e.title}</p>
                      <p className="text-[10px] text-neutral-400">{formatDateShort(e.date)}</p>
                    </div>
                  </>
                );
                return isSocial ? (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">{content}</div>
                ) : (
                  <Link key={e.id} href={`/workplan/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors">{content}</Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Assignments snapshot */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">task_alt</span>
            <h3 className="text-sm font-semibold text-neutral-900">
              {showFullAssignments ? "Assignments Overview" : "My Assignments"}
            </h3>
          </div>
          <Link href="/assignments" className="text-xs text-neutral-400 hover:text-primary transition-colors">
            View all
          </Link>
        </div>

        {/* Stats row */}
        {assignStats && (
          <div className={`grid divide-x divide-neutral-50 border-b border-neutral-50 ${showFullAssignments ? "grid-cols-4 sm:grid-cols-8" : "grid-cols-2 sm:grid-cols-4"}`}>
            {showFullAssignments ? (
              <>
                <StatPill label="Total" value={assignStats.total} href="/assignments/all" />
                <StatPill label="Active" value={assignStats.active} href="/assignments/all?status=active" color="text-green-600" />
                <StatPill label="Awaiting" value={assignStats.awaiting} href="/assignments/pending" color="text-purple-600" />
                <StatPill label="Blocked" value={assignStats.blocked} href="/assignments/blocked" color="text-red-500" />
                <StatPill label="Overdue" value={assignStats.overdue} href="/assignments/overdue" color="text-red-600" />
                <StatPill label="Due Soon" value={assignStats.due_soon} color="text-amber-600" />
                <StatPill label="Completed" value={assignStats.completed} color="text-neutral-400" />
                <StatPill label="My Pending" value={assignStats.my_pending} color="text-blue-600" />
              </>
            ) : (
              <>
                <StatPill label="My Active" value={assignStats.active} color="text-green-600" href="/assignments/all?status=active" />
                <StatPill label="My Pending" value={assignStats.my_pending} color="text-blue-600" />
                <StatPill label="Overdue" value={assignStats.overdue} href="/assignments/overdue" color="text-red-600" />
                <StatPill label="Due Soon" value={assignStats.due_soon} color="text-amber-600" />
              </>
            )}
          </div>
        )}

        {/* Urgent assignments list */}
        {urgentAssignments.length > 0 ? (
          <div className="divide-y divide-neutral-50">
            {urgentAssignments.map((a) => {
              const isOverdue = !["closed", "cancelled"].includes(a.status) && new Date(a.due_date) < new Date();
              const statusCls = a.status === "blocked" ? "badge-danger" : a.status === "at_risk" ? "badge-warning" : a.status === "delayed" ? "badge-warning" : isOverdue ? "badge-danger" : "badge-muted";
              const statusLabel = a.status === "at_risk" ? "At Risk" : a.status === "blocked" ? "Blocked" : a.status === "delayed" ? "Delayed" : isOverdue ? "Overdue" : a.status;
              return (
                <Link key={a.id} href={`/assignments/${a.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors group">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 mt-0.5">
                    <span className="material-symbols-outlined text-red-400 text-[16px]">
                      {a.status === "blocked" ? "block" : a.status === "at_risk" ? "warning" : "event_busy"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[10px] font-mono text-neutral-400">{a.reference_number}</span>
                      <span className={`badge text-[10px] ${statusCls}`}>{statusLabel}</span>
                    </div>
                    <p className="text-xs font-semibold text-neutral-800 truncate">{a.title}</p>
                    {showFullAssignments && a.assignee && (
                      <p className="text-[10px] text-neutral-400">{a.assignee.name}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-1">
                      <div className="w-14 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
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
          <div className="px-5 py-7 text-center">
            <span className="material-symbols-outlined text-3xl text-neutral-200">check_circle</span>
            <p className="text-xs text-neutral-400 mt-1.5">No urgent assignments</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">bolt</span>
            <h3 className="text-sm font-semibold text-neutral-900">Quick Actions</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-neutral-50">
          {quickActionsToShow.map((action) => (
            <Link key={action.href} href={action.href} className="flex flex-col items-center gap-2.5 p-5 hover:bg-neutral-50 transition-colors group">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.bg} group-hover:scale-105 transition-transform`}>
                <span className={`material-symbols-outlined ${action.color} text-[22px]`}>{action.icon}</span>
              </div>
              <span className="text-xs font-medium text-neutral-600 text-center leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Modules grid */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">All Modules</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {modulesToShow.map((m) => (
            <Link key={m.href} href={m.href} className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary/30 hover:shadow-elevated transition-all group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 group-hover:bg-primary/10 transition-colors">
                <span className="material-symbols-outlined text-neutral-500 group-hover:text-primary text-[20px] transition-colors">{m.icon}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-800">{m.label}</p>
                <p className="text-[10px] text-neutral-400">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
