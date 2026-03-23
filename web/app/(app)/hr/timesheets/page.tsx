"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, adminApi, type Timesheet, type TimesheetEntry, type TimesheetProject, type AuthUser } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";
import { QuickEntrySlideOver } from "@/components/timesheets/QuickEntrySlideOver";
import { USER_KEY } from "@/lib/constants";

// ─── Helpers ───────────────────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toYMD(d: Date): string {
  // Use local date parts to avoid UTC-offset shifting (e.g. UTC+2 shifts midnight to previous day in ISO)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekDates(weekStart: Date): Date[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatWeekLabel(start: Date, end: Date): string {
  const s = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const e = end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${s} – ${e}`;
}

const BUCKET_ICONS: Record<string, string> = {
  delivery: "task_alt",
  meeting: "groups",
  communication: "chat_bubble",
  administration: "settings",
  other: "category",
};

const BUCKET_COLORS: Record<string, string> = {
  delivery: "text-blue-600",
  meeting: "text-violet-600",
  communication: "text-sky-600",
  administration: "text-amber-600",
  other: "text-neutral-500",
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft: { label: "Draft", cls: "badge-muted", icon: "edit_note" },
  submitted: { label: "Pending Approval", cls: "badge-warning", icon: "pending" },
  approved: { label: "Approved", cls: "badge-success", icon: "check_circle" },
  rejected: { label: "Rejected", cls: "badge-danger", icon: "cancel" },
};

// ─── Summary Panel ─────────────────────────────────────────────────────────

interface SummaryPanelProps {
  timesheet: Timesheet | null;
  entries: TimesheetEntry[];
  projects: TimesheetProject[];
  saving: boolean;
  isAdmin: boolean;
  onSave: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}

function SummaryPanel({ timesheet, entries, projects, saving, isAdmin, onSave, onSubmit, onApprove, onReject }: SummaryPanelProps) {
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const overtimeHours = entries.reduce((s, e) => s + (e.overtime_hours ?? 0), 0);
  const expectedHours = 40;
  const missingHours = Math.max(0, expectedHours - totalHours);

  // Hours by project
  const byProject: Record<string, { label: string; hours: number }> = {};
  for (const entry of entries) {
    const key = entry.project_id ? String(entry.project_id) : "__none__";
    const label = entry.project?.label ?? projects.find((p) => p.id === entry.project_id)?.label ?? "No Project";
    if (!byProject[key]) byProject[key] = { label, hours: 0 };
    byProject[key].hours += entry.hours;
  }

  const status = timesheet?.status ?? "draft";
  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const isDraft = status === "draft";
  const isSubmitted = status === "submitted";

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">info</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</span>
        </div>
        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", sc.cls)}>
          <span className="material-symbols-outlined text-[14px]">{sc.icon}</span>
          {sc.label}
        </div>
        {timesheet?.submitted_at && (
          <p className="text-xs text-neutral-500">
            Submitted {formatDateShort(timesheet.submitted_at)}
          </p>
        )}
        {timesheet?.approved_at && (
          <p className="text-xs text-neutral-500">
            Approved {formatDateShort(timesheet.approved_at)}
          </p>
        )}
        {status === "rejected" && timesheet?.rejection_reason && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-xs font-medium text-red-700">Rejection reason:</p>
            <p className="text-xs text-red-600 mt-0.5">{timesheet.rejection_reason}</p>
          </div>
        )}
      </div>

      {/* Hours summary */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">schedule</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Hours</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold text-neutral-900">{totalHours.toFixed(1)}</span>
            <span className="text-sm text-neutral-400">h / {expectedHours}h</span>
          </div>
          {overtimeHours > 0 && (
            <span className="badge-warning text-xs">+{overtimeHours.toFixed(1)}h OT</span>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={cn("h-full rounded-full transition-all", totalHours > expectedHours ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${Math.min(100, (totalHours / expectedHours) * 100)}%` }}
          />
        </div>
        {missingHours > 0 && isDraft && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-2">
            <span className="material-symbols-outlined text-[14px] text-red-500">warning</span>
            <span className="text-xs text-red-600">{missingHours.toFixed(1)}h missing this week</span>
          </div>
        )}
      </div>

      {/* Hours by project */}
      {Object.keys(byProject).length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">pie_chart</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">By Project</span>
          </div>
          <div className="space-y-2">
            {Object.values(byProject).map((p) => (
              <div key={p.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-600 truncate max-w-[140px]">{p.label}</span>
                  <span className="text-xs font-medium text-neutral-800">{p.hours.toFixed(1)}h</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: totalHours > 0 ? `${(p.hours / totalHours) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        {isDraft && (
          <>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || entries.length === 0}
              className="btn-secondary w-full disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving || entries.length === 0}
              className="btn-primary w-full disabled:opacity-50"
            >
              Submit for Approval
            </button>
          </>
        )}
        {isAdmin && isSubmitted && (
          <>
            <button type="button" onClick={onApprove} disabled={saving} className="btn-primary w-full disabled:opacity-50">
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={saving}
              className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {timesheet && (
          <Link
            href={`/hr/timesheets/${timesheet.id}`}
            className="btn-secondary w-full text-center block"
          >
            View Full Details
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function TimesheetsPage() {
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null);
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [leaveDays, setLeaveDays] = useState<Record<string, { leave_type: string; status: string }>>({});
  const [projects, setProjects] = useState<TimesheetProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Initialise on client only to prevent SSR/client hydration mismatch
  useEffect(() => {
    setWeekStartDate(getWeekStart(new Date()));
  }, []);

  const weekStart = weekStartDate ? toYMD(weekStartDate) : null;
  const weekEnd   = weekStartDate ? toYMD(addDays(weekStartDate, 6)) : null;
  const weekDates = weekStartDate ? getWeekDates(weekStartDate) : [];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        const u: AuthUser = JSON.parse(raw);
        setIsAdmin(
          (u.permissions ?? []).some((p) => ["hr.admin", "hr.approve", "hr.edit", "system.admin"].includes(p))
        );
      }
    } catch { /* ignore */ }
  }, []);

  const loadWeek = useCallback(async () => {
    if (!weekStart || !weekEnd) return;
    setLoading(true);
    setError(null);
    try {
      const [tsRes, ldRes, projRes] = await Promise.all([
        hrApi.listTimesheets({ week_start: weekStart }),
        hrApi.getTimesheetLeaveDays(weekStart, weekEnd),
        projects.length === 0
          ? adminApi.listTimesheetProjects().then((r) => r.data)
          : Promise.resolve({ data: projects }),
      ]);

      const tsData = (tsRes.data as any).data ?? [];
      const found: Timesheet | undefined = tsData[0];
      setTimesheet(found ?? null);
      setEntries(found?.entries ?? []);
      setLeaveDays((ldRes.data as any).data ?? {});
      if (projects.length === 0) {
        setProjects((projRes as any).data ?? []);
      }
    } catch {
      setError("Failed to load timesheet data.");
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  const handlePrevWeek = () => setWeekStartDate((d) => addDays(d ?? new Date(), -7));
  const handleNextWeek = () => setWeekStartDate((d) => addDays(d ?? new Date(), 7));

  const handleAddEntry = (entry: TimesheetEntry) => {
    if (entry.id) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
    } else {
      setEntries((prev) => [...prev, { ...entry, id: Date.now() }]);
    }
  };

  const handleDeleteEntry = (id: number | undefined, idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildPayload = () => entries.map((e) => ({
    work_date:          e.work_date,
    hours:              e.hours,
    overtime_hours:     e.overtime_hours ?? 0,
    description:        e.description ?? null,
    project_id:         e.project_id ?? null,
    work_bucket:        e.work_bucket ?? null,
    activity_type:      e.activity_type ?? null,
    work_assignment_id: e.work_assignment_id ?? null,
  }));

  const handleSave = async () => {
    if (entries.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      let res;
      if (timesheet) {
        res = await hrApi.updateTimesheet(timesheet.id, { entries: buildPayload() as TimesheetEntry[] });
        const updated = (res.data as any).data ?? res.data;
        setTimesheet(updated);
        setEntries(updated.entries ?? entries);
      } else {
        res = await hrApi.createTimesheet({ week_start: weekStart!, week_end: weekEnd!, entries: buildPayload() as TimesheetEntry[] });
        const created = (res.data as any).data ?? res.data;
        setTimesheet(created);
        setEntries(created.entries ?? entries);
      }
    } catch {
      setError("Failed to save timesheet.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!timesheet) {
      await handleSave();
    }
    setSaving(true);
    try {
      const id = timesheet?.id;
      if (!id) { setSaving(false); return; }
      const res = await hrApi.submitTimesheet(id);
      const updated = (res.data as any).data ?? res.data;
      setTimesheet((prev) => ({ ...prev!, ...updated }));
    } catch {
      setError("Failed to submit timesheet.");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!timesheet) return;
    setSaving(true);
    try {
      const res = await hrApi.approveTimesheet(timesheet.id);
      const updated = (res.data as any).data ?? res.data;
      setTimesheet((prev) => ({ ...prev!, ...updated }));
    } catch {
      setError("Failed to approve timesheet.");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!timesheet || !rejectReason.trim()) return;
    setSaving(true);
    try {
      const res = await hrApi.rejectTimesheet(timesheet.id, rejectReason.trim());
      const updated = (res.data as any).data ?? res.data;
      setTimesheet((prev) => ({ ...prev!, ...updated }));
      setShowRejectModal(false);
      setRejectReason("");
    } catch {
      setError("Failed to reject timesheet.");
    } finally {
      setSaving(false);
    }
  };

  const isDraft = !timesheet || timesheet.status === "draft";

  // Compute daily totals
  const dailyTotals: Record<string, number> = {};
  for (const e of entries) {
    dailyTotals[e.work_date] = (dailyTotals[e.work_date] ?? 0) + e.hours;
  }

  return (
    <>
      {/* Week nav bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={handlePrevWeek} disabled={!weekStartDate} className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <div>
            <h1 className="page-title">
              {weekStartDate ? `Week of ${formatWeekLabel(weekStartDate, addDays(weekStartDate, 4))}` : "Loading…"}
            </h1>
            {timesheet && (
              <p className="text-xs text-neutral-500 mt-0.5">Timesheet #{timesheet.id}</p>
            )}
          </div>
          <button type="button" onClick={handleNextWeek} disabled={!weekStartDate} className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {timesheet && (
            <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", STATUS_CONFIG[timesheet.status]?.cls ?? "badge-muted")}>
              {STATUS_CONFIG[timesheet.status]?.label ?? timesheet.status}
            </span>
          )}
          {isDraft && (
            <button
              type="button"
              onClick={() => { setEditingEntry(null); setShowQuickEntry(true); }}
              className="btn-primary flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Entry
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-64 rounded-xl bg-neutral-100" />
          <div className="h-32 rounded-xl bg-neutral-100" />
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* LEFT — Weekly Grid */}
          <div className="flex-1 min-w-0">
            <div className="card overflow-hidden">
              {/* Column headers */}
              <div className="grid border-b border-neutral-100" style={{ gridTemplateColumns: "1fr repeat(5, 80px) 80px" }}>
                <div className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Work / Project</div>
                {weekDates.map((d) => {
                  const ymd = toYMD(d);
                  const hasLeave = !!leaveDays[ymd];
                  return (
                    <div
                      key={ymd}
                      className={cn(
                        "py-3 text-center text-xs font-semibold",
                        hasLeave ? "bg-amber-50 text-amber-700" : "text-neutral-500"
                      )}
                    >
                      <div>{d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                      <div className="text-[11px] font-normal opacity-75">{d.getDate()} {d.toLocaleDateString("en-GB", { month: "short" })}</div>
                      {hasLeave && (
                        <div className="mt-1">
                          <span className="inline-block rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 uppercase tracking-wide">
                            {leaveDays[ymd].leave_type.replace(/_/g, " ")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="py-3 text-center text-xs font-semibold text-neutral-500">Total</div>
              </div>

              {/* Entry rows */}
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
                    <span className="material-symbols-outlined text-[24px] text-neutral-400">schedule</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-700">No entries yet</p>
                    <p className="text-xs text-neutral-400 mt-1">Click "Add Entry" to log your work for this week</p>
                  </div>
                </div>
              ) : (
                entries.map((entry, idx) => {
                  const bucket = entry.work_bucket ?? "other";
                  const icon = BUCKET_ICONS[bucket] ?? "category";
                  const iconColor = BUCKET_COLORS[bucket] ?? "text-neutral-500";
                  const projectLabel = entry.project?.label ?? projects.find((p) => p.id === entry.project_id)?.label;

                  return (
                    <div
                      key={entry.id ?? idx}
                      className={cn(
                        "grid items-center border-b border-neutral-50 hover:bg-neutral-50/50 group",
                        leaveDays[entry.work_date] ? "bg-amber-50/30" : ""
                      )}
                      style={{ gridTemplateColumns: "1fr repeat(5, 80px) 80px" }}
                    >
                      {/* Entry info */}
                      <div className="flex items-center gap-2.5 px-4 py-3">
                        <span className={cn("material-symbols-outlined text-[18px] flex-shrink-0", iconColor)}>{icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-800 truncate">
                            {entry.activity_type || bucket}
                          </p>
                          {projectLabel ? (
                            <p className="text-[11px] text-neutral-400 truncate">{projectLabel}</p>
                          ) : (
                            <span className="inline-block rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-500">No Project</span>
                          )}
                        </div>
                        {isDraft && (
                          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => { setEditingEntry(entry); setShowQuickEntry(true); }}
                              className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:text-primary"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id, idx)}
                              className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:text-red-500"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Hours per day */}
                      {weekDates.map((d) => {
                        const ymd = toYMD(d);
                        const isEntryDay = entry.work_date === ymd;
                        return (
                          <div key={ymd} className={cn("text-center py-3 text-sm", leaveDays[ymd] ? "bg-amber-50/40" : "")}>
                            {isEntryDay ? (
                              <span className={cn("font-semibold", entry.hours > 8 ? "text-amber-600" : "text-neutral-800")}>
                                {entry.hours}h
                              </span>
                            ) : (
                              <span className="text-neutral-200">—</span>
                            )}
                          </div>
                        );
                      })}

                      {/* Row total */}
                      <div className="text-center py-3 text-sm font-medium text-neutral-700">
                        {entry.hours}h
                      </div>
                    </div>
                  );
                })
              )}

              {/* Daily totals row */}
              {entries.length > 0 && (
                <div
                  className="grid bg-neutral-50 border-t border-neutral-200"
                  style={{ gridTemplateColumns: "1fr repeat(5, 80px) 80px" }}
                >
                  <div className="px-4 py-2.5 text-xs font-semibold text-neutral-500">Daily Total</div>
                  {weekDates.map((d) => {
                    const ymd = toYMD(d);
                    const total = dailyTotals[ymd] ?? 0;
                    return (
                      <div key={ymd} className="py-2.5 text-center text-xs font-semibold">
                        <span className={cn(total > 8 ? "text-amber-600" : total > 0 ? "text-neutral-800" : "text-neutral-300")}>
                          {total > 0 ? `${total}h` : "—"}
                        </span>
                      </div>
                    );
                  })}
                  <div className="py-2.5 text-center text-xs font-bold text-neutral-800">
                    {entries.reduce((s, e) => s + e.hours, 0)}h
                  </div>
                </div>
              )}

              {/* Add entry button */}
              {isDraft && (
                <div className="px-4 py-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => { setEditingEntry(null); setShowQuickEntry(true); }}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add Entry
                  </button>
                </div>
              )}
            </div>

            {/* History link */}
            <div className="mt-4 flex justify-end">
              <Link href="/hr/timesheets/history" className="text-xs text-primary hover:underline">
                View all timesheets →
              </Link>
            </div>
          </div>

          {/* RIGHT — Summary Panel */}
          <div className="w-72 flex-shrink-0 sticky top-6">
            <SummaryPanel
              timesheet={timesheet}
              entries={entries}
              projects={projects}
              saving={saving}
              isAdmin={isAdmin}
              onSave={handleSave}
              onSubmit={handleSubmit}
              onApprove={handleApprove}
              onReject={() => setShowRejectModal(true)}
            />
          </div>
        </div>
      )}

      {/* Quick Entry Slide-over */}
      <QuickEntrySlideOver
        open={showQuickEntry}
        weekStart={weekStart ?? ""}
        projects={projects}
        onClose={() => { setShowQuickEntry(false); setEditingEntry(null); }}
        onAdd={handleAddEntry}
        editEntry={editingEntry}
      />

      {/* Reject modal */}
      {showRejectModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="card w-full max-w-md p-6 space-y-4">
              <h3 className="text-base font-semibold text-neutral-900">Reject Timesheet</h3>
              <p className="text-sm text-neutral-600">Please provide a reason for rejection.</p>
              <textarea
                rows={4}
                className="form-input resize-none"
                placeholder="Rejection reason…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
