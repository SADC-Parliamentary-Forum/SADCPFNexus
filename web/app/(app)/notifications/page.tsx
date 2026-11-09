"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userNotificationsApi, alertsApi, notificationsPhase23Api, type UserNotification, type AlertsSummary } from "@/lib/api";
import { useFormatDate } from "@/lib/useFormatDate";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { TranslateVars } from "@/lib/i18n/messages";

type Translate = (key: string, vars?: TranslateVars) => string;

// ─── Alerts helpers ──────────────────────────────────────────────────────────

const DAYS_LABEL = [
  "notifications.day.sun",
  "notifications.day.mon",
  "notifications.day.tue",
  "notifications.day.wed",
  "notifications.day.thu",
  "notifications.day.fri",
  "notifications.day.sat",
];

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function DeadlineBadge({ days }: { days: number }) {
  const { t } = useI18n();
  if (days < 0)  return <span className="badge badge-danger">{t("notifications.alerts.overdue")}</span>;
  if (days < 3)  return <span className="badge badge-danger">{t("notifications.alerts.daysLeft", { days })}</span>;
  if (days <= 7) return <span className="badge badge-warning">{t("notifications.alerts.daysLeft", { days })}</span>;
  return <span className="badge badge-success">{t("notifications.alerts.daysLeft", { days })}</span>;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Notifications helpers ───────────────────────────────────────────────────

const MODULE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  travel:      { icon: "flight_takeoff",         color: "text-primary",     bg: "bg-primary/10" },
  leave:       { icon: "event_available",        color: "text-green-600",   bg: "bg-green-50 dark:bg-green-900/20" },
  imprest:     { icon: "account_balance_wallet", color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  procurement: { icon: "shopping_cart",          color: "text-primary",     bg: "bg-primary/10" },
  assignment:  { icon: "task_alt",               color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  finance:     { icon: "payments",               color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
};

function timeAgo(iso: string, fmt: (d: string) => string, t: Translate): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return t("notifications.time.justNow");
  if (mins < 60)  return t("notifications.time.minutes", { n: mins });
  if (hours < 24) return t("notifications.time.hours", { n: hours });
  if (days < 7)   return t("notifications.time.days", { n: days });
  return fmt(iso);
}

// ─── Alerts tab ──────────────────────────────────────────────────────────────

function AlertsTab() {
  const { t } = useI18n();
  const { fmt } = useFormatDate();
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchSummary = useCallback(() => {
    alertsApi.getSummary()
      .then((r) => { setSummary(r.data); setError(null); })
      .catch(() => setError(t("notifications.alerts.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

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
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{loading ? "—" : awayToday.length}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t("notifications.alerts.awayToday")}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-teal-600">{loading ? "—" : activeMissions.length}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t("notifications.alerts.activeMissions")}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{loading ? "—" : urgentDeadlines}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t("notifications.alerts.urgentDeadlines")}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-primary">{loading ? "—" : weekEvents.length}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t("notifications.alerts.eventsWeek")}</p>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={fetchSummary}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1"
            title={t("admin.common.refresh")}
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            {t("admin.common.refresh")}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Who's Away Today */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">person_off</span>
              </div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("notifications.alerts.whosAway")}</h2>
            </div>
            <span className="text-xs text-neutral-400">{t("notifications.alerts.staffAbsent", { count: awayToday.length })}</span>
          </div>
          {loading ? <Spinner /> : awayToday.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-400 dark:text-neutral-500">{t("notifications.alerts.allPresent")}</p>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
              {awayToday.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 text-amber-800 dark:text-amber-200 text-xs font-bold">
                    {initials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{s.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("notifications.alerts.until", { date: fmt(s.to_date) })}</p>
                  </div>
                  <span className={`badge ${s.type === "leave" ? "badge-warning" : "badge-primary"} capitalize`}>
                    {s.type === "leave" ? t("notifications.alerts.onLeave") : t("notifications.alerts.onMission")}
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/20">
                <span className="material-symbols-outlined text-teal-600 text-[18px]">flight_takeoff</span>
              </div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("notifications.alerts.missionsBoard")}</h2>
            </div>
            <span className="text-xs text-neutral-400">{t("notifications.alerts.inProgress", { count: activeMissions.length })}</span>
          </div>
          {loading ? <Spinner /> : activeMissions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-400 dark:text-neutral-500">{t("notifications.alerts.noMissions")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>{t("notifications.alerts.traveller")}</th><th>{t("notifications.alerts.destination")}</th><th>{t("notifications.alerts.departure")}</th><th>{t("notifications.alerts.return")}</th></tr>
                </thead>
                <tbody>
                  {activeMissions.map((m) => (
                    <tr key={m.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => window.location.href = `/travel/${m.id}`}>
                      <td>
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">{m.requester_name}</p>
                        <p className="text-xs text-neutral-400 font-mono">{m.reference_number}</p>
                      </td>
                      <td className="text-neutral-600 dark:text-neutral-400">{m.destination_country}</td>
                      <td className="text-xs text-neutral-500 dark:text-neutral-400">{fmt(m.departure_date)}</td>
                      <td><span className="badge badge-primary">{fmt(m.return_date)}</span></td>
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20">
              <span className="material-symbols-outlined text-red-500 text-[18px]">timer</span>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("notifications.alerts.upcomingDeadlines")}</h2>
          </div>
          <span className="text-xs text-neutral-400">{t("notifications.alerts.next14")}</span>
        </div>
        {loading ? <Spinner /> : deadlines.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-400 dark:text-neutral-500">{t("notifications.alerts.noDeadlines")}</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {[...deadlines].sort((a, b) => daysUntil(a.deadline_date) - daysUntil(b.deadline_date)).map((d, i) => {
              const days = daysUntil(d.deadline_date);
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${
                    days < 0 ? "bg-red-100 dark:bg-red-900/30" : days < 3 ? "bg-red-50 dark:bg-red-900/20" : days <= 7 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-green-50 dark:bg-green-900/20"
                  }`}>
                    <span className={`material-symbols-outlined text-[18px] ${
                      days < 0 ? "text-red-600" : days < 3 ? "text-red-500" : days <= 7 ? "text-amber-500" : "text-green-600"
                    }`}>schedule</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{d.title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {t("notifications.alerts.due", { date: fmt(d.deadline_date) })}
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
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("notifications.alerts.eventsWeek")}</h2>
          </div>
          <a href="/workplan" className="btn-secondary text-xs py-1 px-2">{t("notifications.alerts.viewWorkplan")}</a>
        </div>
        {loading ? <Spinner /> : weekEvents.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-400 dark:text-neutral-500">{t("notifications.alerts.noEvents")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
            {weekEvents.map((e) => {
              const raw = (e.date ?? "").slice(0, 10);
              const d = new Date(raw + "T00:00:00");
              const valid = raw.length === 10 && !Number.isNaN(d.getTime());
              const dayLabel   = valid ? t(DAYS_LABEL[d.getDay()]) : "—";
              const dayNum     = valid ? d.getDate() : "—";
              const monthLabel = valid ? d.toLocaleDateString("en-GB", { month: "short" }) : "";
              const yearLabel  = valid && d.getFullYear() !== new Date().getFullYear()
                ? ` ${d.getFullYear()}` : "";
              const typeColors: Record<string, string> = {
                meeting: "border-primary/30 bg-primary/5",
                travel: "border-teal-200 dark:border-teal-800/50 bg-teal-50 dark:bg-teal-900/20",
                leave: "border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20",
                milestone: "border-primary/20 bg-primary/10",
                deadline: "border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20",
              };
              const labelColors: Record<string, string> = {
                meeting: "text-primary",
                travel: "text-teal-700 dark:text-teal-300",
                leave: "text-amber-700 dark:text-amber-300",
                milestone: "text-primary",
                deadline: "text-red-700 dark:text-red-300",
              };
              const typeIcons: Record<string, string> = {
                meeting: "groups", travel: "flight_takeoff", leave: "event_available",
                milestone: "flag", deadline: "timer",
              };
              return (
                <Link key={e.id} href={`/workplan?event=${e.id}`}
                  className={`rounded-xl border p-4 block hover:shadow-md transition-shadow ${typeColors[e.type] || "border-neutral-100 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${labelColors[e.type] || "text-neutral-500 dark:text-neutral-400"}`}>{dayLabel}</span>
                    <span className="text-lg font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                      {dayNum} <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">{monthLabel}{yearLabel}</span>
                    </span>
                  </div>
                  <p className={`text-sm font-semibold ${labelColors[e.type] || "text-neutral-700 dark:text-neutral-300"}`}>{e.title}</p>
                  {e.responsible && <p className="text-xs text-neutral-400 mt-1">{e.responsible}</p>}
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className={`material-symbols-outlined text-[12px] ${labelColors[e.type] || "text-neutral-400"}`}>{typeIcons[e.type] || "event"}</span>
                    <p className={`text-xs font-medium capitalize ${labelColors[e.type] || "text-neutral-400"}`}>{e.type}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notifications (inbox) tab ────────────────────────────────────────────────

type InboxFilter = "all" | "unread" | "read" | "action_required" | "archived";

function InboxTab() {
  const { t } = useI18n();
  const { fmt } = useFormatDate();
  const { success, error: showErrorToast } = useToast();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [moduleFilter, setModuleFilter] = useState<string | undefined>();
  const [nlQuery, setNlQuery] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [page, setPage]     = useState(1);
  const queryClient = useQueryClient();
  const router = useRouter();


  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["notifications", "list", filter, moduleFilter, page],
    queryFn: () => userNotificationsApi.list({ filter, module: moduleFilter, page, per_page: 20 }).then(r => r.data),
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
      success(t("notifications.inbox.allRead"));
    } catch {
      showErrorToast(t("notifications.inbox.allReadFailed"));
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await userNotificationsApi.destroy(id); invalidate(); } catch { /* ignore */ }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await userNotificationsApi.archive(id);
      invalidate();
      success(t("notifications.inbox.archived"));
    } catch {
      showErrorToast(t("notifications.inbox.archiveFailed"));
    }
  };

  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await userNotificationsApi.acknowledge(id);
      invalidate();
      success(t("notifications.inbox.acknowledged"));
    } catch {
      showErrorToast(t("notifications.inbox.acknowledgeFailed"));
    }
  };

  const handleMarkUnread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await userNotificationsApi.markUnread(id);
      invalidate();
      success(t("notifications.inbox.markedUnread"));
    } catch {
      showErrorToast(t("notifications.inbox.markUnreadFailed"));
    }
  };

  const runNlSearch = async () => {
    const q = nlQuery.trim();
    if (!q) return;
    setNlBusy(true);
    try {
      const res = await notificationsPhase23Api.nlSearch(q);
      const payload = (res.data as { data?: { filters?: { filter?: string; module?: string } } }).data;
      const next = payload?.filters?.filter;
      if (next === "all" || next === "unread" || next === "read" || next === "action_required" || next === "archived") {
        setFilter(next);
      }
      setModuleFilter(payload?.filters?.module);
      setPage(1);
    } catch {
      showErrorToast(t("notifications.inbox.searchFailed"));
    } finally {
      setNlBusy(false);
    }
  };

  const notifications: UserNotification[] = data?.data ?? [];
  const unreadCount = countData ?? 0;

  const filterTabs: { key: InboxFilter; label: string }[] = [
    { key: "all",    label: t("notifications.inbox.tabAll") },
    { key: "unread", label: unreadCount > 0 ? t("notifications.inbox.tabUnreadCount", { count: unreadCount }) : t("notifications.inbox.tabUnread") },
    { key: "read",   label: t("notifications.inbox.tabRead") },
    { key: "action_required", label: t("notifications.inbox.tabAction") },
    { key: "archived", label: t("notifications.inbox.tabArchived") },
  ];

  return (
    <div className="space-y-5">

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void runNlSearch();
        }}
      >
        <label htmlFor="notifications-inbox-search-setnlquery-e-target-value-placehold" className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-neutral-500">
          {t("notifications.inbox.search")}
          <input id="notifications-inbox-search-setnlquery-e-target-value-placehold"
            className="form-input text-sm"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            placeholder={t("notifications.inbox.searchPlaceholder")}
            aria-label={t("notifications.inbox.search")}
          />
        </label>
        <button type="submit" className="btn-secondary text-sm" disabled={nlBusy}>
          {nlBusy ? t("notifications.inbox.searching") : t("notifications.inbox.searchButton")}
        </button>
        {moduleFilter ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => { setModuleFilter(undefined); setPage(1); }}
          >
            {t("notifications.inbox.clearModule", { module: moduleFilter })}
          </button>
        ) : null}
      </form>
      <p className="text-xs text-neutral-500">
        {t("notifications.inbox.searchHint")}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700 flex-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1); }}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                filter === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
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
            {t("notifications.inbox.markAllRead")}
          </button>
        )}
      </div>

      <div className="card overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-700/50">
        {(isLoading || isFetching) && notifications.length === 0 ? (
          <div className="space-y-0 animate-pulse divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-700/40 flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-neutral-100 dark:bg-neutral-700/40 rounded w-2/3" />
                  <div className="h-2.5 bg-neutral-100 dark:bg-neutral-700/40 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="notifications_off"
            title={filter === "unread" ? t("notifications.inbox.noUnread") : filter === "read" ? t("notifications.inbox.noRead") : t("notifications.inbox.none")}
            description={t("notifications.inbox.noneDesc")}
          />
        ) : notifications.map(n => {
          const isUnread = !n.read_at;
          const mod = n.meta?.module ?? "";
          const ic  = MODULE_ICONS[mod] ?? { icon: "notifications", color: "text-neutral-500", bg: "bg-neutral-100 dark:bg-neutral-700/40" };
          return (
            <div
              key={n.id}
              onClick={() => handleMarkRead(n)}
              className={`group flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${isUnread ? "bg-primary/[0.03]" : ""}`}
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${ic.bg}`}>
                <span className={`material-symbols-outlined text-[20px] ${ic.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{ic.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm leading-snug ${isUnread ? "font-semibold text-neutral-900 dark:text-neutral-100" : "font-medium text-neutral-700 dark:text-neutral-300"}`}>
                    {n.subject}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isUnread && <span className="h-2 w-2 rounded-full bg-primary" />}
                    <span className="text-[11px] text-neutral-400 whitespace-nowrap">{timeAgo(n.created_at, fmt, t)}</span>
                  </div>
                </div>
                {n.body && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed whitespace-pre-wrap">
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
              {!isUnread && (
                <button
                  onClick={(e) => handleMarkUnread(n.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-300 hover:text-primary flex-shrink-0"
                  title={t("notifications.inbox.markUnread")}
                >
                  <span className="material-symbols-outlined text-[16px]">mark_email_unread</span>
                </button>
              )}
              <button
                onClick={(e) => handleAcknowledge(n.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-300 hover:text-primary flex-shrink-0"
                title={t("notifications.inbox.acknowledge")}
              >
                <span className="material-symbols-outlined text-[16px]">task_alt</span>
              </button>
              <button
                onClick={(e) => handleArchive(n.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-300 hover:text-primary flex-shrink-0"
                title={t("notifications.inbox.archive")}
              >
                <span className="material-symbols-outlined text-[16px]">archive</span>
              </button>
              <button
                onClick={(e) => handleDelete(n.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-300 hover:text-red-400 flex-shrink-0"
                title={t("admin.users.dismiss")}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          );
        })}
      </div>

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">{t("common.pageOf", { page: data.current_page, total: data.last_page })} · {t("common.totalCount", { count: data.total })}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm disabled:opacity-40">{t("common.previous")}</button>
            <button onClick={() => setPage(p => Math.min(data.last_page, p + 1))} disabled={page >= data.last_page} className="btn-secondary text-sm disabled:opacity-40">{t("common.next")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

type TabKey = "alerts" | "inbox";

function NotificationsPageInner() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("tab") as TabKey | null) ?? "alerts";
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    const next = searchParams.get("tab") === "inbox" ? "inbox" : "alerts";
    setTab(next);
  }, [searchParams]);

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => userNotificationsApi.unreadCount().then(r => r.data.count),
    staleTime: 15_000,
  });
  const unreadCount = countData ?? 0;

  function switchTab(next: TabKey) {
    setTab(next);
    const url = next === "alerts" ? "/notifications" : "/notifications?tab=inbox";
    router.replace(url, { scroll: false });
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("nav.notifications")}
        subtitle={t("notifications.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("notifications.home"), href: "/dashboard" }, { label: t("nav.notifications") }]} />}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        <button
          onClick={() => switchTab("alerts")}
          className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === "alerts" ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">notifications_active</span>
          {t("admin.auditTrail.nav.alerts")}
        </button>
        <button
          onClick={() => switchTab("inbox")}
          className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === "inbox" ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">inbox</span>
          {t("notifications.myNotifications")}
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
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="space-y-4 p-6 text-sm text-neutral-400">{t("common.loading")}</div>}>
      <NotificationsPageInner />
    </Suspense>
  );
}
