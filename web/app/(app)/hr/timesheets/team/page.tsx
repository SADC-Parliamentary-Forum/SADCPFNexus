"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, type Timesheet } from "@/lib/api";
import { cn } from "@/lib/utils";

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

// ─── Toast ─────────────────────────────────────────────────────────────────

interface ToastState { message: string; type: "success" | "error" }

function AppToast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className={cn(
      "fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl",
      toast.type === "success" ? "bg-green-600" : "bg-red-600"
    )}>
      <span className="material-symbols-outlined text-[18px]">
        {toast.type === "success" ? "check_circle" : "error_outline"}
      </span>
      {toast.message}
      <button type="button" onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}

// ─── Export CSV ────────────────────────────────────────────────────────────

function exportWeekCSV(sheets: Timesheet[], weekLabel: string) {
  const headers = ["Employee", "Email", "Week", "Total Hours", "Overtime Hours", "Status", "Submitted At", "Approved At"];
  const csvRows = sheets.map((ts) => [
    ts.user?.name ?? "",
    ts.user?.email ?? "",
    weekLabel,
    (ts.total_hours ?? 0).toFixed(2),
    (ts.overtime_hours ?? 0).toFixed(2),
    ts.status,
    ts.submitted_at ? new Date(ts.submitted_at).toLocaleDateString("en-GB") : "",
    ts.approved_at  ? new Date(ts.approved_at).toLocaleDateString("en-GB")  : "",
  ]);

  const csv = [headers, ...csvRows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `timesheets-${weekLabel.replace(/[^a-z0-9]/gi, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TeamTimesheetsPage() {
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Initialise on client only to prevent SSR/client hydration mismatch
  useEffect(() => {
    setWeekStartDate(getWeekStart(new Date()));
  }, []);

  const weekStart = weekStartDate ? toYMD(weekStartDate) : null;

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    if (!weekStart) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { week_start: weekStart, per_page: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await hrApi.listTeamTimesheets(params);
      const data = res.data as { data?: Timesheet[]; total?: number };
      setTimesheets(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
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
      showToast(`${ts.user?.name ?? "Timesheet"} approved.`);
      await load();
    } catch {
      showToast("Failed to approve timesheet.", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [ts.id]: false }));
    }
  };

  const handleReject = async (ts: Timesheet) => {
    setActionLoading((prev) => ({ ...prev, [ts.id]: true }));
    try {
      await hrApi.rejectTimesheet(ts.id, "Returned for revision.");
      showToast(`${ts.user?.name ?? "Timesheet"} returned for revision.`);
      await load();
    } catch {
      showToast("Failed to reject timesheet.", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [ts.id]: false }));
    }
  };

  const handleBulkApprove = async () => {
    const pending = timesheets.filter((t) => t.status === "submitted");
    if (pending.length === 0) return;
    setBulkLoading(true);
    let successCount = 0;
    let errorCount = 0;
    for (const ts of pending) {
      try {
        await hrApi.approveTimesheet(ts.id);
        successCount++;
      } catch {
        errorCount++;
      }
    }
    setBulkLoading(false);
    setShowBulkConfirm(false);
    await load();
    if (errorCount === 0) {
      showToast(`All ${successCount} timesheet${successCount !== 1 ? "s" : ""} approved.`);
    } else {
      showToast(`${successCount} approved, ${errorCount} failed.`, "error");
    }
  };

  const pendingCount = timesheets.filter((t) => t.status === "submitted").length;
  const weekLabel    = weekStart ? formatWeekLabel(weekStart) : "";
  const totalHours   = timesheets.reduce((s, t) => s + Number(t.total_hours ?? 0), 0);
  const overtimeHrs  = timesheets.reduce((s, t) => s + Number(t.overtime_hours ?? 0), 0);

  return (
    <div className="space-y-6">
      <AppToast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
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
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">done_all</span>
              Bulk Approve ({pendingCount})
            </button>
          )}
          {timesheets.length > 0 && (
            <button
              type="button"
              onClick={() => exportWeekCSV(timesheets, weekLabel)}
              className="btn-secondary py-2 px-3 text-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export Week
            </button>
          )}
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
          {weekStart ? `Week of ${weekLabel}` : "Loading…"}
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
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {timesheets.map((ts) => {
              const name     = ts.user?.name ?? "Team Member";
              const sc       = STATUS_CONFIG[ts.status] ?? STATUS_CONFIG.draft;
              const totalH   = Number(ts.total_hours ?? 0);
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
                      <>
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
                        <button
                          type="button"
                          onClick={() => handleReject(ts)}
                          disabled={isLoading}
                          title="Return for revision"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">undo</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary row */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-[18px] text-primary">summarize</span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Week Summary</h3>
              <span className="text-xs text-neutral-400 ml-auto">
                {timesheets.length} team member{timesheets.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label:     "Total Hours",
                  value:     `${totalHours.toFixed(1)}h`,
                  icon:      "schedule",
                  color:     "text-neutral-900",
                  iconColor: "text-neutral-500",
                  bg:        "bg-neutral-50",
                },
                {
                  label:     "Avg per Staff",
                  value:     timesheets.length > 0 ? `${(totalHours / timesheets.length).toFixed(1)}h` : "—",
                  icon:      "person",
                  color:     "text-primary",
                  iconColor: "text-primary",
                  bg:        "bg-primary/5",
                },
                {
                  label:     "Overtime",
                  value:     `${overtimeHrs.toFixed(1)}h`,
                  icon:      "more_time",
                  color:     overtimeHrs > 0 ? "text-amber-700" : "text-neutral-400",
                  iconColor: overtimeHrs > 0 ? "text-amber-500" : "text-neutral-300",
                  bg:        overtimeHrs > 0 ? "bg-amber-50" : "bg-neutral-50",
                },
                {
                  label:     "Pending Approval",
                  value:     pendingCount,
                  icon:      "pending",
                  color:     pendingCount > 0 ? "text-amber-700" : "text-neutral-400",
                  iconColor: pendingCount > 0 ? "text-amber-500" : "text-neutral-300",
                  bg:        pendingCount > 0 ? "bg-amber-50" : "bg-neutral-50",
                },
              ].map((item) => (
                <div key={item.label} className={cn("rounded-xl p-4 flex items-start gap-3", item.bg)}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70">
                    <span className={cn("material-symbols-outlined text-[16px]", item.iconColor)}>{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className={cn("text-lg font-bold leading-none", item.color)}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bulk Approve Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-sm w-full shadow-2xl border border-neutral-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-primary text-[22px]">done_all</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Bulk Approve</h3>
                <p className="text-xs text-neutral-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-5">
              You are about to approve{" "}
              <strong className="text-neutral-900">{pendingCount} pending timesheet{pendingCount !== 1 ? "s" : ""}</strong>{" "}
              for the week of <strong className="text-neutral-900">{weekLabel}</strong>.
              All submissions will be marked as approved.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                disabled={bulkLoading}
                className="btn-secondary flex-1 justify-center py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={bulkLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {bulkLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Approving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">done_all</span>
                    Approve All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
