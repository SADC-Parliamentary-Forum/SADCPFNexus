"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, adminApi, type Timesheet, type TimesheetEntry, type TimesheetProject, type TimesheetTemplate, type AuthUser } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";
import { QuickEntrySlideOver } from "@/components/timesheets/QuickEntrySlideOver";
import { USER_KEY } from "@/lib/constants";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TIMESHEET_HUB_CARDS } from "@/lib/hubs/timesheets";

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
  saving: boolean;
  isAdmin: boolean;
  onSave: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}

function SummaryPanel({ timesheet, entries, saving, isAdmin, onSave, onSubmit, onApprove, onReject }: SummaryPanelProps) {
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const overtimeHours = entries.reduce((s, e) => s + (e.overtime_hours ?? 0), 0);
  const expectedHours = 40;
  const missingHours = Math.max(0, expectedHours - totalHours);

  const status = timesheet?.status ?? "draft";
  const isDraft = status === "draft";
  const isSubmitted = status === "submitted";

  return (
    <div className="space-y-4">
      {status === "rejected" && timesheet?.rejection_reason ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs font-medium text-red-700">Returned</p>
          <p className="mt-0.5 text-xs text-red-600">{timesheet.rejection_reason}</p>
        </div>
      ) : null}

      <div className="card space-y-3 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">This week</p>
            <span className="text-2xl font-bold text-neutral-900">{totalHours.toFixed(1)}</span>
            <span className="text-sm text-neutral-400">h / {expectedHours}h</span>
          </div>
          {overtimeHours > 0 ? (
            <span className="badge-warning text-xs">+{overtimeHours.toFixed(1)}h OT</span>
          ) : null}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={cn("h-full rounded-full transition-all", totalHours > expectedHours ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${Math.min(100, (totalHours / expectedHours) * 100)}%` }}
          />
        </div>
        {missingHours > 0 && isDraft ? (
          <p className="text-xs text-neutral-500">{missingHours.toFixed(1)}h still to record</p>
        ) : null}
        {timesheet?.submitted_at ? (
          <p className="text-xs text-neutral-500">Submitted {formatDateShort(timesheet.submitted_at)}</p>
        ) : null}
      </div>

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
  const [travelDays, setTravelDays] = useState<Record<string, { purpose: string; destination: string; reference: string }>>({});
  const [holidayDates, setHolidayDates] = useState<Record<string, { name: string; is_paid: boolean }>>({});
  const [projects, setProjects] = useState<TimesheetProject[]>([]);
  const [templates, setTemplates] = useState<TimesheetTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);
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
      const [tsRes, ldRes, tdRes, hdRes, projRes, tmplRes] = await Promise.all([
        hrApi.listTimesheets({ week_start: weekStart }),
        hrApi.getTimesheetLeaveDays(weekStart, weekEnd),
        hrApi.getTimesheetTravelDays(weekStart, weekEnd),
        hrApi.getTimesheetHolidayDates(weekStart, weekEnd),
        projects.length === 0
          ? adminApi.listTimesheetProjects().then((r) => r.data)
          : Promise.resolve({ data: projects }),
        templates.length === 0
          ? hrApi.listTimesheetTemplates().then((r) => r.data).catch(() => ({ data: [] }))
          : Promise.resolve({ data: templates }),
      ]);

      const tsData = (tsRes.data as any).data ?? [];
      const found: Timesheet | undefined = tsData[0];
      setTimesheet(found ?? null);
      setEntries(found?.entries ?? []);
      setLeaveDays((ldRes.data as any).data ?? {});
      setTravelDays((tdRes.data as any).data ?? {});
      setHolidayDates((hdRes.data as any).data ?? {});
      if (projects.length === 0) {
        setProjects((projRes as any).data ?? []);
      }
      if (templates.length === 0) {
        setTemplates((tmplRes as any).data ?? []);
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

  const handleApplyTemplate = async () => {
    if (!weekStart || !weekEnd || !selectedTemplateId) return;
    setApplyingTemplate(true);
    setError(null);
    try {
      const { data } = await hrApi.applyTimesheetTemplate(Number(selectedTemplateId), {
        week_start: weekStart,
        week_end: weekEnd,
      });
      const ts = data.data.timesheet;
      setTimesheet(ts);
      setEntries(ts.entries ?? []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
          ?.message ||
        Object.values(
          (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors ?? {},
        ).flat()[0] ||
        "Failed to apply template.";
      setError(msg);
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleAddEntry = (incoming: TimesheetEntry[]) => {
    setEntries((prev) => {
      let next = [...prev];
      incoming.forEach((entry, idx) => {
        if (entry.id) {
          next = next.map((e) => (e.id === entry.id ? entry : e));
        } else {
          next.push({ ...entry, id: Date.now() + idx });
        }
      });
      return next;
    });
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

  const isDraft = !timesheet || timesheet.status === "draft" || timesheet.status === "returned";

  // Compute daily totals + validation
  const dailyTotals: Record<string, number> = {};
  for (const e of entries) {
    dailyTotals[e.work_date] = (dailyTotals[e.work_date] ?? 0) + e.hours;
  }
  const weekTotal = entries.reduce((s, e) => s + e.hours, 0);
  const otTotal = entries.reduce((s, e) => s + (e.overtime_hours ?? 0), 0);
  const rowErrors: Record<number, string> = {};
  entries.forEach((e, idx) => {
    if (!e.work_date) rowErrors[idx] = "Date required";
    else if (e.hours == null || Number.isNaN(Number(e.hours))) rowErrors[idx] = "Hours required";
    else if (e.hours < 0 || e.hours > 24) rowErrors[idx] = "Hours must be 0–24";
    else if ((e.overtime_hours ?? 0) < 0 || (e.overtime_hours ?? 0) > 24) rowErrors[idx] = "OT hours must be 0–24";
    else if (!e.project_id) rowErrors[idx] = "Select a project";
    else if (!e.work_bucket) rowErrors[idx] = "Select a work bucket";
  });
  const hasRowErrors = Object.keys(rowErrors).length > 0;

  const updateEntryField = <K extends keyof TimesheetEntry>(
    idx: number,
    key: K,
    value: TimesheetEntry[K],
  ) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [key]: value } : e)));
  };

  const handleAddBlankRow = () => {
    const firstWorking = weekDates[0] ? toYMD(weekDates[0]) : weekStart ?? "";
    setEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        work_date: firstWorking,
        hours: 8,
        overtime_hours: 0,
        description: "",
        project_id: null,
        work_bucket: "delivery",
        activity_type: "",
      },
    ]);
  };

  const handleSaveGuarded = async () => {
    if (hasRowErrors) {
      setError("Fix highlighted rows before saving (project, bucket, and hours are required).");
      return;
    }
    await handleSave();
  };

  const handleSubmitGuarded = async () => {
    if (hasRowErrors) {
      setError("Fix highlighted rows before submitting.");
      return;
    }
    await handleSubmit();
  };

  return (
    <>
      <ModulePageHeader
        title="My timesheet"
        subtitle={weekStartDate ? formatWeekLabel(weekStartDate, addDays(weekStartDate, 4)) : "This week"}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Timesheets" }]} />}
        actions={
          <>
            <button
              type="button"
              onClick={handlePrevWeek}
              disabled={!weekStartDate}
              aria-label="Previous week"
              title="Previous week"
              className="btn-secondary text-sm"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              disabled={!weekStartDate}
              aria-label="Next week"
              title="Next week"
              className="btn-secondary text-sm"
            >
              Next
            </button>
          </>
        }
      />

      {/* Week nav bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {timesheet ? (
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CONFIG[timesheet.status]?.cls ?? "badge-muted")}>
            {STATUS_CONFIG[timesheet.status]?.label ?? timesheet.status}
          </span>
        ) : (
          <span className="badge-muted rounded-full px-2.5 py-1 text-xs font-semibold">Draft</span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && templates.length > 0 && (
            <>
              <select
                className="form-input max-w-[200px] py-1.5 text-sm"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                aria-label="Donor or project template"
                data-testid="timesheet-apply-template-select"
              >
                <option value="">Donor / project template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.donor_name ? `${t.donor_name} — ${t.name}` : t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary text-sm disabled:opacity-50"
                disabled={!selectedTemplateId || applyingTemplate}
                onClick={() => void handleApplyTemplate()}
                data-testid="timesheet-apply-template-btn"
              >
                {applyingTemplate ? "Applying…" : "Apply"}
              </button>
            </>
          )}
          {isDraft && (
            <>
              <button
                type="button"
                onClick={handleAddBlankRow}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">playlist_add</span>
                Add row
              </button>
              <button
                type="button"
                onClick={() => { setEditingEntry(null); setShowQuickEntry(true); }}
                className="btn-primary flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Quick entry
              </button>
            </>
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
            {/* Day chips / totals strip */}
            <div className="mb-3 grid grid-cols-5 gap-2">
              {weekDates.map((d) => {
                const ymd = toYMD(d);
                const total = dailyTotals[ymd] ?? 0;
                const over = total > 8;
                return (
                  <div
                    key={ymd}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-center",
                      holidayDates[ymd] ? "border-neutral-200 bg-neutral-50"
                        : travelDays[ymd] ? "border-teal-200 bg-teal-50/50"
                        : leaveDays[ymd] ? "border-amber-200 bg-amber-50/50"
                        : "border-neutral-100 bg-white",
                    )}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      {d.toLocaleDateString("en-GB", { weekday: "short" })} {d.getDate()}
                    </div>
                    <div className={cn("text-sm font-bold tabular-nums", over ? "text-amber-600" : total > 0 ? "text-neutral-900" : "text-neutral-300")}>
                      {total > 0 ? `${total}h` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Draft entry grid</p>
                  <p className="text-xs text-neutral-500">
                    Tab through fields · {weekTotal}h
                    {otTotal > 0 ? ` · ${otTotal}h overtime` : ""}
                  </p>
                </div>
                {hasRowErrors && (
                  <span className="badge badge-warning text-xs">{Object.keys(rowErrors).length} row issue(s)</span>
                )}
              </div>

              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
                    <span className="material-symbols-outlined text-[24px] text-neutral-400">schedule</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-700">No entries yet</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Apply a template, add a row, or use Quick entry
                    </p>
                  </div>
                  {isDraft && (
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary text-sm" onClick={handleAddBlankRow}>
                        Add row
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        onClick={() => { setEditingEntry(null); setShowQuickEntry(true); }}
                      >
                        Quick entry
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table w-full min-w-[880px]">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Project</th>
                        <th>Bucket</th>
                        <th>Category / activity</th>
                        <th className="text-right">Hours</th>
                        <th className="text-right">OT hrs</th>
                        <th>Notes</th>
                        {isDraft && <th className="w-16" />}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, idx) => {
                        const err = rowErrors[idx];
                        return (
                          <tr
                            key={entry.id ?? `row-${idx}`}
                            className={cn(err && "bg-red-50/60")}
                          >
                            <td className="align-top">
                              {isDraft ? (
                                <input
                                  type="date"
                                  className="form-input py-1.5 text-sm"
                                  value={entry.work_date}
                                  onChange={(e) => updateEntryField(idx, "work_date", e.target.value)}
                                  aria-label={`Row ${idx + 1} date`}
                                />
                              ) : (
                                <span className="text-sm">{formatDayShort(new Date(entry.work_date + "T12:00:00"))}</span>
                              )}
                            </td>
                            <td className="align-top min-w-[160px]">
                              {isDraft ? (
                                <select
                                  className="form-input py-1.5 text-sm"
                                  value={entry.project_id ?? ""}
                                  onChange={(e) =>
                                    updateEntryField(
                                      idx,
                                      "project_id",
                                      e.target.value ? Number(e.target.value) : null,
                                    )
                                  }
                                  aria-label={`Row ${idx + 1} project`}
                                >
                                  <option value="">Select project…</option>
                                  {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-sm">
                                  {entry.project?.label ??
                                    projects.find((p) => p.id === entry.project_id)?.label ??
                                    "—"}
                                </span>
                              )}
                            </td>
                            <td className="align-top">
                              {isDraft ? (
                                <select
                                  className="form-input py-1.5 text-sm capitalize"
                                  value={entry.work_bucket ?? ""}
                                  onChange={(e) =>
                                    updateEntryField(
                                      idx,
                                      "work_bucket",
                                      (e.target.value || null) as TimesheetEntry["work_bucket"],
                                    )
                                  }
                                  aria-label={`Row ${idx + 1} bucket`}
                                >
                                  <option value="">Bucket…</option>
                                  {Object.keys(BUCKET_ICONS).map((b) => (
                                    <option key={b} value={b}>
                                      {b}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs capitalize text-neutral-600">
                                  {entry.work_bucket ?? "—"}
                                </span>
                              )}
                            </td>
                            <td className="align-top min-w-[140px]">
                              {isDraft ? (
                                <input
                                  className="form-input py-1.5 text-sm"
                                  value={entry.activity_type ?? ""}
                                  onChange={(e) => updateEntryField(idx, "activity_type", e.target.value)}
                                  placeholder="Activity / category"
                                  aria-label={`Row ${idx + 1} activity`}
                                />
                              ) : (
                                <span className="text-sm text-neutral-700">{entry.activity_type || "—"}</span>
                              )}
                            </td>
                            <td className="align-top text-right">
                              {isDraft ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={24}
                                  step={0.25}
                                  className="form-input py-1.5 text-sm text-right w-20 ml-auto"
                                  value={entry.hours}
                                  onChange={(e) =>
                                    updateEntryField(idx, "hours", Number(e.target.value) || 0)
                                  }
                                  aria-label={`Row ${idx + 1} hours`}
                                />
                              ) : (
                                <span className="tabular-nums font-medium">{entry.hours}h</span>
                              )}
                            </td>
                            <td className="align-top text-right">
                              {isDraft ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={24}
                                  step={0.25}
                                  className="form-input py-1.5 text-sm text-right w-20 ml-auto"
                                  value={entry.overtime_hours ?? 0}
                                  onChange={(e) =>
                                    updateEntryField(idx, "overtime_hours", Number(e.target.value) || 0)
                                  }
                                  aria-label={`Row ${idx + 1} overtime hours`}
                                />
                              ) : (
                                <span className="tabular-nums text-neutral-600">
                                  {entry.overtime_hours ? `${entry.overtime_hours}h` : "—"}
                                </span>
                              )}
                            </td>
                            <td className="align-top min-w-[140px]">
                              {isDraft ? (
                                <input
                                  className="form-input py-1.5 text-sm"
                                  value={entry.description ?? ""}
                                  onChange={(e) => updateEntryField(idx, "description", e.target.value)}
                                  placeholder="Notes"
                                  aria-label={`Row ${idx + 1} notes`}
                                />
                              ) : (
                                <span className="text-sm text-neutral-600">{entry.description || "—"}</span>
                              )}
                              {err && (
                                <p className="mt-1 text-[11px] font-medium text-red-600">{err}</p>
                              )}
                            </td>
                            {isDraft && (
                              <td className="align-top whitespace-nowrap">
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => handleDeleteEntry(entry.id, idx)}
                                  aria-label={`Remove row ${idx + 1}`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-50">
                        <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-neutral-500">
                          Week total
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-neutral-900">
                          {weekTotal}h
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-neutral-700">
                          {otTotal > 0 ? `${otTotal}h` : "—"}
                        </td>
                        <td colSpan={isDraft ? 2 : 1} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {isDraft && entries.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-4 py-3">
                  <button type="button" onClick={handleAddBlankRow} className="btn-secondary flex items-center gap-1.5 text-sm">
                    <span className="material-symbols-outlined text-[16px]">playlist_add</span>
                    Add row
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingEntry(null); setShowQuickEntry(true); }}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    Quick entry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Summary Panel */}
          <div className="w-72 flex-shrink-0 sticky top-6">
            <SummaryPanel
              timesheet={timesheet}
              entries={entries}
              saving={saving}
              isAdmin={isAdmin}
              onSave={handleSaveGuarded}
              onSubmit={handleSubmitGuarded}
              onApprove={handleApprove}
              onReject={() => setShowRejectModal(true)}
            />
          </div>
        </div>
      )}

      <details className="mt-6 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-700">More timesheet tools</summary>
        <div className="mt-3">
          <ModuleHubCards cards={TIMESHEET_HUB_CARDS.filter((card) => card.href !== "/hr/timesheets")} />
        </div>
      </details>

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
