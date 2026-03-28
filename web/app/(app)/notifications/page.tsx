"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userNotificationsApi, alertsApi, type UserNotification, type AlertsSummary } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

// ─── Alerts helpers ──────────────────────────────────────────────────────────

const DAYS_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function DeadlineBadge({ days }: { days: number }) {
  if (days < 0)  return <span className="badge badge-danger">Overdue</span>;
  if (days < 3)  return <span className="badge badge-danger">{days}d left</span>;
  if (days <= 7) return <span className="badge badge-warning">{days}d left</span>;
  return <span className="badge badge-success">{days}d left</span>;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Notifications helpers ───────────────────────────────────────────────────

const MODULE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  travel:      { icon: "flight_takeoff",         color: "text-primary",     bg: "bg-primary/10" },
  leave:       { icon: "event_available",        color: "text-green-600",   bg: "bg-green-50" },
  imprest:     { icon: "account_balance_wallet", color: "text-amber-600",   bg: "bg-amber-50" },
  procurement: { icon: "shopping_cart",          color: "text-purple-600",  bg: "bg-purple-50" },
  assignment:  { icon: "task_alt",               color: "text-blue-600",    bg: "bg-blue-50" },
  finance:     { icon: "payments",               color: "text-emerald-600", bg: "bg-emerald-50" },
};

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Alerts tab ──────────────────────────────────────────────────────────────

function AlertsTab() {
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchSummary = useCallback(() => {
    alertsApi.getSummary()
      .then((r) => { setSummary(r.data); setError(null); })
      .catch(() => setError("Failed to load alerts."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSummary();
    const id = setInterval(fetchSummary, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchSummary]);

  const awayToday      = summary?.away_today ?? [];
  const activeMissions = summary?.active_missions ?? [];
  const deadlines      = summary?.upcoming_deadlines ?? [];
  const weekEvents     = summary?.events_this_week ?? [];
  const urgentDeadlines = deadlines.filter((d) => daysUntil(d.deadline_date) < 3).length;

  function Spinner() {
    return (
      <div className="py-8 text-center text-sm text-neutral-400 flex items-center justify-center gap-2">
        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-neutral-900">{loading ? "—" : awayToday.length}</p>
            <p className="text-xs text-neutral-500 mt-1">Staff Away Today</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-teal-600">{loading ? "—" : activeMissions.length}</p>
            <p className="text-xs text-neutral-500 mt-1">Active Missions</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{loading ? "—" : urgentDeadlines}</p>
            <p className="text-xs text-neutral-500 mt-1">Urgent Deadlines</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-primary">{loading ? "—" : weekEvents.length}</p>
            <p className="text-xs text-neutral-500 mt-1">Events This Week</p>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={fetchSummary}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Who's Away Today */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">person_off</span>
              </div>
              <h2 className="text-sm font-semibold text-neutral-900">Who&apos;s Away Today</h2>
            </div>
            <span className="text-xs text-neutral-400">{awayToday.length} staff absent</span>
          </div>
          {loading ? <Spinner /> : awayToday.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-400">All staff are present today.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {awayToday.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-800 text-xs font-bold">
                    {initials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{s.name}</p>
                    <p className="text-xs text-neutral-500">Until {formatDateShort(s.to_date)}</p>
                  </div>
                  <span className={`badge ${s.type === "leave" ? "badge-warning" : "badge-primary"} capitalize`}>
                    {s.type === "leave" ? "On Leave" : "On Mission"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Missions */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
                <span className="material-symbols-outlined text-teal-600 text-[18px]">flight_takeoff</span>
              </div>
              <h2 className="text-sm font-semibold text-neutral-900">Active Missions Board</h2>
            </div>
            <span className="text-xs text-neutral-400">{activeMissions.length} in progress</span>
          </div>
          {loading ? <Spinner /> : activeMissions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-400">No active missions at this time.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Traveller</th><th>Destination</th><th>Departure</th><th>Return</th></tr>
                </thead>
                <tbody>
                  {activeMissions.map((m) => (
                    <tr key={m.id}>
                      <td className="font-medium text-neutral-900">{m.requester_name}</td>
                      <td className="text-neutral-600">{m.destination_country}</td>
                      <td className="text-xs text-neutral-500">{formatDateShort(m.departure_date)}</td>
                      <td><span className="badge badge-primary">{formatDateShort(m.return_date)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
              <span className="material-symbols-outlined text-red-500 text-[18px]">timer</span>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900">Upcoming Deadlines</h2>
          </div>
          <span className="text-xs text-neutral-400">Next 14 days</span>
        </div>
        {loading ? <Spinner /> : deadlines.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-400">No upcoming deadlines in the next 14 days.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {[...deadlines].sort((a, b) => daysUntil(a.deadline_date) - daysUntil(b.deadline_date)).map((d, i) => {
              const days = daysUntil(d.deadline_date);
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${
                    days < 0 ? "bg-red-100" : days < 3 ? "bg-red-50" : days <= 7 ? "bg-amber-50" : "bg-green-50"
                  }`}>
                    <span className={`material-symbols-outlined text-[18px] ${
                      days < 0 ? "text-red-600" : days < 3 ? "text-red-500" : days <= 7 ? "text-amber-500" : "text-green-600"
                    }`}>schedule</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{d.title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Due: {formatDateShort(d.deadline_date)}
                      {d.responsible && ` · ${d.responsible}`}
                      {` · ${d.module}`}
                    </p>
                  </div>
                  <DeadlineBadge days={days} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Events This Week */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">calendar_view_week</span>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900">Events This Week</h2>
          </div>
          <a href="/workplan" className="text-xs text-primary hover:underline font-medium">View full workplan →</a>
        </div>
        {loading ? <Spinner /> : weekEvents.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-400">No events scheduled this week.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
            {weekEvents.map((e) => {
              const d = new Date((e.date ?? "") + "T00:00:00");
              const valid = !Number.isNaN(d.getTime());
              const dayLabel  = valid ? DAYS_LABEL[d.getDay()] : "—";
              const dayNum    = valid ? d.getDate() : "—";
              const monthLabel = valid ? d.toLocaleDateString("en-GB", { month: "short" }) : "";
              const yearLabel  = valid && d.getFullYear() !== new Date().getFullYear()
                ? ` ${d.getFullYear()}` : "";
              const typeColors: Record<string, string> = {
                meeting: "border-primary/30 bg-primary/5", travel: "border-teal-200 bg-teal-50",
                leave: "border-amber-200 bg-amber-50",     milestone: "border-purple-200 bg-purple-50",
                deadline: "border-red-200 bg-red-50",
              };
              const labelColors: Record<string, string> = {
                meeting: "text-primary", travel: "text-teal-700", leave: "text-amber-700",
                milestone: "text-purple-700", deadline: "text-red-700",
              };
              return (
                <div key={e.id} className={`rounded-xl border p-4 ${typeColors[e.type] || "border-neutral-100 bg-neutral-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${labelColors[e.type] || "text-neutral-500"}`}>{dayLabel}</span>
                    <span className="text-lg font-bold text-neutral-800 leading-tight">
                      {dayNum} <span className="text-sm font-semibold text-neutral-500">{monthLabel}{yearLabel}</span>
                    </span>
                  </div>
                  <p className={`text-sm font-semibold ${labelColors[e.type] || "text-neutral-700"}`}>{e.title}</p>
                  {e.responsible && <p className="text-xs text-neutral-400 mt-1">{e.responsible}</p>}
                  <p className="text-xs text-neutral-400 mt-0.5 capitalize">{e.type}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notifications (inbox) tab ────────────────────────────────────────────────

type InboxFilter = "all" | "unread" | "read";

function InboxTab() {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [page, setPage]     = useState(1);
  const [toast, setToast]   = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["notifications", "list", filter, page],
    queryFn: () => userNotificationsApi.list({ filter, page, per_page: 20 }).then(r => r.data),
    staleTime: 10_000,
  });

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => userNotificationsApi.unreadCount().then(r => r.data.count),
    staleTime: 15_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  const handleMarkRead = async (n: UserNotification) => {
    if (n.read_at) return;
    try { await userNotificationsApi.markRead(n.id); invalidate(); } catch { /* ignore */ }
    if (n.meta?.url) router.push(n.meta.url);
  };

  const handleMarkAllRead = async () => {
    try {
      await userNotificationsApi.markAllRead();
      invalidate();
      showToast("success", "All notifications marked as read.");
    } catch {
      showToast("error", "Failed to mark all as read.");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await userNotificationsApi.destroy(id); invalidate(); } catch { /* ignore */ }
  };

  const notifications: UserNotification[] = data?.data ?? [];
  const unreadCount = countData ?? 0;

  const filterTabs: { key: InboxFilter; label: string }[] = [
    { key: "all",    label: "All" },
    { key: "unread", label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
    { key: "read",   label: "Read" },
  ];

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b border-neutral-200 flex-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1); }}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                filter === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn-secondary text-sm flex items-center gap-2 ml-4 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            Mark all read
          </button>
        )}
      </div>

      <div className="card overflow-hidden divide-y divide-neutral-100">
        {(isLoading || isFetching) && notifications.length === 0 ? (
          <div className="space-y-0 animate-pulse divide-y divide-neutral-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <div className="h-10 w-10 rounded-full bg-neutral-100 flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-neutral-100 rounded w-2/3" />
                  <div className="h-2.5 bg-neutral-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 mb-4">
              <span className="material-symbols-outlined text-3xl text-neutral-300">notifications_off</span>
            </div>
            <p className="text-sm font-semibold text-neutral-500">
              {filter === "unread" ? "No unread notifications" : filter === "read" ? "No read notifications" : "No notifications yet"}
            </p>
            <p className="text-xs text-neutral-400 mt-1">Notifications will appear here when you have approvals, rejections, or assignments.</p>
          </div>
        ) : notifications.map(n => {
          const isUnread = !n.read_at;
          const mod = n.meta?.module ?? "";
          const ic  = MODULE_ICONS[mod] ?? { icon: "notifications", color: "text-neutral-500", bg: "bg-neutral-100" };
          return (
            <div
              key={n.id}
              onClick={() => handleMarkRead(n)}
              className={`group flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-neutral-50 transition-colors ${isUnread ? "bg-primary/[0.03]" : ""}`}
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${ic.bg}`}>
                <span className={`material-symbols-outlined text-[20px] ${ic.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{ic.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm leading-snug ${isUnread ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"}`}>
                    {n.subject}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isUnread && <span className="h-2 w-2 rounded-full bg-primary" />}
                    <span className="text-[11px] text-neutral-400 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
                {n.body && (
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                    {n.body.split("\n").slice(2, 4).join(" ").trim()}
                  </p>
                )}
                {mod && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                    <span className={`material-symbols-outlined text-[12px] ${ic.color}`}>{ic.icon}</span>
                    {mod.charAt(0).toUpperCase() + mod.slice(1)}
                  </span>
                )}
              </div>
              <button
                onClick={(e) => handleDelete(n.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-300 hover:text-red-400 flex-shrink-0"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          );
        })}
      </div>

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">Page {data.current_page} of {data.last_page} · {data.total} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(p => Math.min(data.last_page, p + 1))} disabled={page >= data.last_page} className="btn-secondary text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

type TabKey = "alerts" | "inbox";

function NotificationsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("tab") as TabKey | null) ?? "alerts";
  const [tab, setTab] = useState<TabKey>(initialTab);

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => userNotificationsApi.unreadCount().then(r => r.data.count),
    staleTime: 15_000,
  });
  const unreadCount = countData ?? 0;

  function switchTab(t: TabKey) {
    setTab(t);
    const url = t === "alerts" ? "/notifications" : "/notifications?tab=inbox";
    router.replace(url, { scroll: false });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-3">
          <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-neutral-900 font-medium">Alerts &amp; Notifications</span>
        </div>
        <h1 className="page-title">Alerts &amp; Notifications</h1>
        <p className="page-subtitle">Operational awareness, upcoming deadlines, and your personal notification inbox.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        <button
          onClick={() => switchTab("alerts")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === "alerts" ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">notifications_active</span>
          Alerts
        </button>
        <button
          onClick={() => switchTab("inbox")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === "inbox" ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">inbox</span>
          My Notifications
          {unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {tab === "alerts" ? <AlertsTab /> : <InboxTab />}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="space-y-4 p-6 text-sm text-neutral-400">Loading…</div>}>
      <NotificationsPageInner />
    </Suspense>
  );
}
