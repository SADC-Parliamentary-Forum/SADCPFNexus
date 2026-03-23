"use client";

import { useState, useEffect } from "react";
import { alertsApi, type AlertsSummary } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const DAYS_LABEL = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

export default function AlertsPage() {
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = () => {
    alertsApi.getSummary()
      .then((r) => { setSummary(r.data); setError(null); })
      .catch(() => setError("Failed to load alerts."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const awayToday      = summary?.away_today ?? [];
  const activeMissions = summary?.active_missions ?? [];
  const deadlines      = summary?.upcoming_deadlines ?? [];
  const weekEvents     = summary?.events_this_week ?? [];

  const urgentDeadlines = deadlines.filter((d) => daysUntil(d.deadline_date) < 3).length;

  function LoadingCards() {
    return <div className="py-8 text-center text-sm text-neutral-400 flex items-center justify-center gap-2">
      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
      Loading…
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Alerts &amp; Notifications</h1>
          <p className="page-subtitle">Live operational awareness — absences, active missions, upcoming deadlines, and weekly events.</p>
        </div>
        <button
          type="button"
          onClick={fetchSummary}
          className="btn-secondary py-2 px-3 text-xs flex items-center gap-1"
          title="Refresh"
        >
          <span className="material-symbols-outlined text-[15px]">refresh</span>
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
          {loading ? <LoadingCards /> : awayToday.length === 0 ? (
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
          {loading ? <LoadingCards /> : activeMissions.length === 0 ? (
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
        {loading ? <LoadingCards /> : deadlines.length === 0 ? (
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
        {loading ? <LoadingCards /> : weekEvents.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-400">No events scheduled this week.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
            {weekEvents.map((e) => {
              const d = new Date((e.date ?? "") + "T00:00:00");
              const valid = !Number.isNaN(d.getTime());
              const dayLabel = valid ? DAYS_LABEL[d.getDay()] : "—";
              const dayNum = valid ? d.getDate() : (e.date ?? "—");
              const typeColors: Record<string, string> = {
                meeting: "border-primary/30 bg-primary/5",
                travel: "border-teal-200 bg-teal-50",
                leave: "border-amber-200 bg-amber-50",
                milestone: "border-purple-200 bg-purple-50",
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
                    <span className="text-2xl font-bold text-neutral-800">{dayNum}</span>
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
