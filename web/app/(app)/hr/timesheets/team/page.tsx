"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, type Timesheet } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end   = addDays(start, 4);
  return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function avatarColor(name: string): string {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:     { label: "Draft",            cls: "badge-muted",    icon: "edit_note"    },
  submitted: { label: "Pending Review",   cls: "badge-warning",  icon: "pending"      },
  approved:  { label: "Approved",         cls: "badge-success",  icon: "check_circle" },
  rejected:  { label: "Rejected",         cls: "badge-danger",   icon: "cancel"       },
};

const FILTER_TABS = [
  { label: "All",            value: ""          },
  { label: "Pending Review", value: "submitted" },
  { label: "Approved",       value: "approved"  },
  { label: "Rejected",       value: "rejected"  },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TeamTimesheetsPage() {
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  // Initialise on client only to prevent SSR/client hydration mismatch
  useEffect(() => {
    setWeekStartDate(getWeekStart(new Date()));
  }, []);

  const weekStart = weekStartDate ? toYMD(weekStartDate) : null;

  const load = useCallback(async () => {
    if (!weekStart) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { week_start: weekStart, per_page: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await hrApi.listTeamTimesheets(params);
      const data = res.data as any;
      setTimesheets(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError("Access restricted. You need HR supervisor or admin permissions to view team timesheets.");
      } else {
        setError("Failed to load team timesheets.");
      }
    } finally {
      setLoading(false);
    }
  }, [weekStart, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (ts: Timesheet) => {
    setActionLoading((prev) => ({ ...prev, [ts.id]: true }));
    try {
      await hrApi.approveTimesheet(ts.id);
      await load();
    } catch {
      setError("Failed to approve timesheet.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [ts.id]: false }));
    }
  };

  const pendingCount = timesheets.filter((t) => t.status === "submitted").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Team Timesheets</h1>
            {pendingCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="page-subtitle mt-1">Review and approve your team's weekly submissions</p>
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setWeekStartDate((d) => addDays(d ?? new Date(), -7))}
          disabled={!weekStartDate}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <span className="text-sm font-medium text-neutral-700">
          {weekStart ? `Week of ${formatWeekLabel(weekStart)}` : "Loading…"}
        </span>
        <button
          type="button"
          onClick={() => setWeekStartDate((d) => addDays(d ?? new Date(), 7))}
          disabled={!weekStartDate}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
        <button
          type="button"
          onClick={() => setWeekStartDate(getWeekStart(new Date()))}
          className="ml-2 text-xs text-primary hover:underline"
        >
          Current week
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={cn("filter-tab", statusFilter === tab.value && "active")}
          >
            {tab.label}
          </button>
        ))}
        {!loading && (
          <span className="ml-auto text-xs text-neutral-400">{total} timesheet{total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-neutral-100" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-32 bg-neutral-100 rounded" />
                  <div className="h-2.5 w-24 bg-neutral-100 rounded" />
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-100" />
              <div className="h-8 w-full rounded-lg bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : timesheets.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100">
            <span className="material-symbols-outlined text-[28px] text-neutral-400">group</span>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700">No timesheets found</p>
            <p className="text-xs text-neutral-400 mt-1">
              {statusFilter
                ? `No ${STATUS_CONFIG[statusFilter]?.label.toLowerCase() ?? statusFilter} timesheets for this week`
                : "No team timesheets for the selected week"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {timesheets.map((ts) => {
            const name = ts.user?.name ?? "Team Member";
            const sc   = STATUS_CONFIG[ts.status] ?? STATUS_CONFIG.draft;
            const totalH = ts.total_hours ?? 0;
            const isLoading = actionLoading[ts.id];

            return (
              <div key={ts.id} className="card flex flex-col gap-4 p-5">
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold flex-shrink-0", avatarColor(name))}>
                    {initials(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-800 truncate">{name}</p>
                    <p className="text-xs text-neutral-500 truncate">{ts.user?.email ?? ""}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", sc.cls)}>
                    <span className="material-symbols-outlined text-[11px]">{sc.icon}</span>
                    {sc.label}
                  </span>
                </div>

                {/* Week label */}
                <p className="text-xs text-neutral-400">
                  Week of {formatWeekLabel(ts.week_start)}
                </p>

                {/* Hours bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">Hours logged</span>
                    <span className={cn("text-xs font-semibold", totalH >= 40 ? "text-green-600" : totalH > 0 ? "text-amber-600" : "text-neutral-400")}>
                      {totalH.toFixed(1)}h / 40h
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={cn("h-full rounded-full transition-all", totalH >= 40 ? "bg-green-500" : "bg-amber-400")}
                      style={{ width: `${Math.min(100, (totalH / 40) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/hr/timesheets/${ts.id}`}
                    className="btn-secondary flex-1 text-center text-xs"
                  >
                    View Details →
                  </Link>
                  {ts.status === "submitted" && (
                    <button
                      type="button"
                      onClick={() => handleApprove(ts)}
                      disabled={isLoading}
                      className="btn-primary text-xs disabled:opacity-50 flex items-center gap-1"
                    >
                      {isLoading ? (
                        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      )}
                      Approve
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
