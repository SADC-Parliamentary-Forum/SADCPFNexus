"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, type Timesheet, type TimesheetEntry, type TimesheetProject, type TimesheetTemplate, type AuthUser } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";
import { QuickEntrySlideOver } from "@/components/timesheets/QuickEntrySlideOver";
import { USER_KEY } from "@/lib/constants";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TIMESHEET_HUB_CARDS } from "@/lib/hubs/timesheets";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  firstTimesheetRowErrorMessage,
  normalizeTimesheetEntry,
  timesheetRowErrors,
} from "@/lib/timesheetRowValidation";

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

function formatDayShort(d: Date, localeTag = "en-GB"): string {
  return d.toLocaleDateString(localeTag, { weekday: "short", day: "numeric", month: "short" });
}

function formatWeekLabel(start: Date, end: Date, localeTag = "en-GB"): string {
  const s = start.toLocaleDateString(localeTag, { day: "numeric", month: "short" });
  const e = end.toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" });
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
  draft: { label: "hr.timesheets.status.draft", cls: "badge-muted", icon: "edit_note" },
  submitted: { label: "hr.timesheets.status.submitted", cls: "badge-warning", icon: "pending" },
  approved: { label: "timesheet.import.origin.approved", cls: "badge-success", icon: "check_circle" },
  rejected: { label: "hr.timesheets.status.rejected", cls: "badge-danger", icon: "cancel" },
  imported: { label: "timesheet.import.origin.imported", cls: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: "history" },
  verified_historical: { label: "timesheet.import.origin.verified", cls: "text-violet-700 bg-violet-50 border-violet-200", icon: "verified" },
  returned: { label: "hr.timesheets.status.returned", cls: "badge-warning", icon: "undo" },
};

function applyEntryDefaults(entry: TimesheetEntry, projects: TimesheetProject[]): TimesheetEntry {
  return normalizeTimesheetEntry(entry, {
    defaultProjectId: projects[0]?.id ?? null,
    defaultBucket: "delivery",
  }) as TimesheetEntry;
}

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
  const { t } = useI18n();
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
          <p className="text-xs font-medium text-red-700">{t("hr.timesheets.status.returned")}</p>
          <p className="mt-0.5 text-xs text-red-600">{timesheet.rejection_reason}</p>
        </div>
      ) : null}

      <div className="card space-y-3 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("hr.timesheets.thisWeek")}</p>
            <span className="text-2xl font-bold text-neutral-900">{totalHours.toFixed(1)}</span>
            <span className="text-sm text-neutral-400">{t("hr.timesheets.ofExpected", { hours: expectedHours })}</span>
          </div>
          {overtimeHours > 0 ? (
            <span className="badge-warning text-xs">{t("hr.timesheets.overtimeBadge", { hours: overtimeHours.toFixed(1) })}</span>
          ) : null}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={cn("h-full rounded-full transition-all", totalHours > expectedHours ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${Math.min(100, (totalHours / expectedHours) * 100)}%` }}
          />
        </div>
        {missingHours > 0 && isDraft ? (
          <p className="text-xs text-neutral-500">{t("hr.timesheets.stillToRecord", { hours: missingHours.toFixed(1) })}</p>
        ) : null}
        {timesheet?.submitted_at ? (
          <p className="text-xs text-neutral-500">{t("hr.timesheets.submittedOn", { date: formatDateShort(timesheet.submitted_at) })}</p>
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
              {saving ? t("hr.timesheets.saving") : t("hr.timesheets.saveDraft")}
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving || entries.length === 0}
              className="btn-primary w-full disabled:opacity-50"
            >
              {t("hr.timesheets.submitForApproval")}
            </button>
          </>
        )}
        {isAdmin && isSubmitted && (
          <>
            <button type="button" onClick={onApprove} disabled={saving} className="btn-primary w-full disabled:opacity-50">
              {t("common.approve")}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={saving}
              className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {t("common.reject")}
            </button>
          </>
        )}
        {timesheet && (
          <Link
            href={`/hr/timesheets/${timesheet.id}`}
            className="btn-secondary w-full text-center block"
          >
            {t("hr.timesheets.viewFullDetails")}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function TimesheetsPage() {
  const { t, localeTag } = useI18n();
  const toast = useToast();
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
          ? hrApi.listTimesheetProjects().then((r) => r.data).catch(() => ({ data: [] }))
          : Promise.resolve({ data: projects }),
        templates.length === 0
          ? hrApi.listTimesheetTemplates().then((r) => r.data).catch(() => ({ data: [] }))
          : Promise.resolve({ data: templates }),
      ]);

      const loadedProjects: TimesheetProject[] =
        projects.length === 0 ? ((projRes as any).data ?? []) : projects;
      const tsData = (tsRes.data as any).data ?? [];
      const found: Timesheet | undefined = tsData[0];
      setTimesheet(found ?? null);
      setEntries((found?.entries ?? []).map((e: TimesheetEntry) => applyEntryDefaults(e, loadedProjects)));
      setLeaveDays((ldRes.data as any).data ?? {});
      setTravelDays((tdRes.data as any).data ?? {});
      setHolidayDates((hdRes.data as any).data ?? {});
      if (projects.length === 0) {
        setProjects(loadedProjects);
      }
      if (templates.length === 0) {
        setTemplates((tmplRes as any).data ?? []);
      }
    } catch {
      setError(t("hr.timesheets.loadFailed"));
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
      setEntries((ts.entries ?? []).map((e) => applyEntryDefaults(e, projects)));
      toast.success(t("hr.timesheets.templateApplied"));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
          ?.message ||
        Object.values(
          (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors ?? {},
        ).flat()[0] ||
        t("hr.timesheets.applyTemplateFailed");
      setError(msg);
      toast.error(t("hr.timesheets.templateNotApplied"), msg);
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleAddEntry = (incoming: TimesheetEntry[]) => {
    setEntries((prev) => {
      let next = [...prev];
      incoming.forEach((entry, idx) => {
        const normalized = applyEntryDefaults(entry, projects);
        if (normalized.id && prev.some((e) => e.id === normalized.id)) {
          next = next.map((e) => (e.id === normalized.id ? normalized : e));
        } else {
          next.push({ ...normalized, id: normalized.id ?? Date.now() + idx });
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

  const persistDraft = async (): Promise<Timesheet | null> => {
    if (entries.length === 0) return timesheet;
    const payload = { entries: buildPayload() as TimesheetEntry[] };
    let saved: Timesheet;
    if (timesheet) {
      const res = await hrApi.updateTimesheet(timesheet.id, payload);
      saved = (res.data as any).data ?? res.data;
    } else {
      const res = await hrApi.createTimesheet({
        week_start: weekStart!,
        week_end: weekEnd!,
        ...payload,
      });
      saved = (res.data as any).data ?? res.data;
    }
    setTimesheet(saved);
    setEntries((saved.entries ?? entries).map((e: TimesheetEntry) => applyEntryDefaults(e, projects)));
    return saved;
  };

  const handleSave = async () => {
    if (entries.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await persistDraft();
      toast.success(t("hr.timesheets.saved"));
    } catch (err) {
      setError(t("hr.timesheets.saveFailed"));
      toast.error(t("hr.timesheets.notSaved"), apiErrorMessage(err, t("hr.timesheets.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const current = await persistDraft();
      if (!current?.id) {
        return;
      }
      const res = await hrApi.submitTimesheet(current.id);
      const updated = (res.data as any).data ?? res.data;
      setTimesheet((prev) => ({ ...prev!, ...updated }));
      toast.success(t("hr.timesheets.submitted"));
    } catch (err) {
      setError(t("hr.timesheets.submitFailed"));
      toast.error(t("hr.timesheets.notSubmitted"), apiErrorMessage(err, t("hr.timesheets.submitFailed")));
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
      toast.success(t("hr.timesheets.approved"));
    } catch (err) {
      setError(t("hr.timesheets.approveFailed"));
      toast.error(t("hr.timesheets.notApproved"), apiErrorMessage(err, t("hr.timesheets.approveFailed")));
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
      toast.success(t("hr.timesheets.rejected"));
    } catch (err) {
      setError(t("hr.timesheets.rejectFailed"));
      toast.error(t("hr.timesheets.notRejected"), apiErrorMessage(err, t("hr.timesheets.rejectFailed")));
    } finally {
      setSaving(false);
    }
  };

  const isHistorical = timesheet?.origin === "historical_import"
    || timesheet?.status === "imported"
    || timesheet?.status === "verified_historical";
  const isDraft = !isHistorical && (!timesheet || timesheet.status === "draft" || timesheet.status === "returned");

  // Compute daily totals + validation
  const dailyTotals: Record<string, number> = {};
  for (const e of entries) {
    dailyTotals[e.work_date] = (dailyTotals[e.work_date] ?? 0) + e.hours;
  }
  const weekTotal = entries.reduce((s, e) => s + e.hours, 0);
  const otTotal = entries.reduce((s, e) => s + (e.overtime_hours ?? 0), 0);
  const rowErrors = timesheetRowErrors(entries, { projectCount: projects.length });
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
        project_id: projects[0]?.id ?? null,
        work_bucket: "delivery",
        activity_type: "",
      },
    ]);
  };

  const handleSaveGuarded = async () => {
    if (hasRowErrors) {
      const detail = firstTimesheetRowErrorMessage(rowErrors);
      setError(
        detail
          ? t("hr.timesheets.fixRowsBeforeSavingDetail", { detail })
          : t("hr.timesheets.fixRowsBeforeSaving"),
      );
      return;
    }
    await handleSave();
  };

  const handleSubmitGuarded = async () => {
    if (hasRowErrors) {
      const detail = firstTimesheetRowErrorMessage(rowErrors);
      setError(detail ? t("hr.timesheets.fixRowsBeforeSubmittingDetail", { detail }) : t("hr.timesheets.fixRowsBeforeSubmitting"));
      return;
    }
    await handleSubmit();
  };

  return (
    <>
      <ModulePageHeader
        title="hr.timesheets.myTimesheet"
        subtitle={weekStartDate ? formatWeekLabel(weekStartDate, addDays(weekStartDate, 4), localeTag) : t("hr.timesheets.thisWeek")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.timesheets" }]} />}
        actions={
          <>
            <button
              type="button"
              onClick={handlePrevWeek}
              disabled={!weekStartDate}
              aria-label={t("hr.timesheets.previousWeek")}
              title={t("hr.timesheets.previousWeek")}
              className="btn-secondary text-sm"
            >
              {t("common.previous")}
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              disabled={!weekStartDate}
              aria-label={t("hr.timesheets.nextWeek")}
              title={t("hr.timesheets.nextWeek")}
              className="btn-secondary text-sm"
            >
              {t("common.next")}
            </button>
          </>
        }
      />

      {/* Week nav bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {timesheet ? (
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CONFIG[timesheet.status]?.cls ?? "badge-muted")}>
            {timesheet.status === "approved" && timesheet.origin !== "historical_import"
              ? t("timesheet.import.origin.approved")
              : STATUS_CONFIG[timesheet.status] ? t(STATUS_CONFIG[timesheet.status].label) : timesheet.status}
          </span>
        ) : (
          <span className="badge-muted rounded-full px-2.5 py-1 text-xs font-semibold">{t("hr.timesheets.status.draft")}</span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && templates.length > 0 && (
            <>
              <select
                className="form-input max-w-[200px] py-1.5 text-sm"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                aria-label={t("hr.timesheets.templateSelect")}
                data-testid="timesheet-apply-template-select"
              >
                <option value="">{t("hr.timesheets.templatePlaceholder")}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.donor_name ? `${tpl.donor_name} — ${tpl.name}` : tpl.name}
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
                {applyingTemplate ? t("hr.timesheets.applying") : t("hr.timesheets.apply")}
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
                {t("hr.timesheets.addRow")}
              </button>
              <button
                type="button"
                onClick={() => { setEditingEntry(null); setShowQuickEntry(true); }}
                className="btn-primary flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                {t("hr.timesheets.quickEntry")}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {isHistorical ? (
        <p className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          {t("timesheet.import.readOnly")}
        </p>
      ) : null}

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
                      {d.toLocaleDateString(localeTag, { weekday: "short" })} {d.getDate()}
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
                  <p className="text-sm font-semibold text-neutral-900">{t("hr.timesheets.gridTitle")}</p>
                  <p className="text-xs text-neutral-500">
                    {t("hr.timesheets.gridHint", { hours: weekTotal })}
                    {otTotal > 0 ? t("hr.timesheets.gridOvertime", { hours: otTotal }) : ""}
                  </p>
                </div>
                {hasRowErrors && (
                  <span className="badge badge-warning text-xs">{t("hr.timesheets.rowIssues", { count: Object.keys(rowErrors).length })}</span>
                )}
              </div>
              {isDraft && projects.length === 0 && entries.length > 0 ? (
                <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                  {t("hr.timesheets.chargeCodesMissing")}
                </p>
              ) : null}

              {entries.length === 0 ? (
                <EmptyState
                  icon="schedule"
                  title={t("hr.timesheets.emptyTitle")}
                  description={t("hr.timesheets.emptyHint")}
                  action={isDraft ? (
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary text-sm" onClick={handleAddBlankRow}>
                        {t("hr.timesheets.addRow")}
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        onClick={() => { setEditingEntry(null); setShowQuickEntry(true); }}
                      >
                        {t("hr.timesheets.quickEntry")}
                      </button>
                    </div>
                  ) : undefined}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table w-full min-w-[880px]">
                    <thead>
                      <tr>
                        <th>{t("hr.timesheets.col.date")}</th>
                        <th>{t("hr.timesheets.col.project")}</th>
                        <th>{t("hr.timesheets.col.bucket")}</th>
                        <th>{t("hr.timesheets.col.activity")}</th>
                        <th className="text-right">{t("hr.timesheets.col.hours")}</th>
                        <th className="text-right">{t("hr.timesheets.col.otHours")}</th>
                        <th>{t("hr.timesheets.col.notes")}</th>
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
                                  aria-label={t("hr.timesheets.rowDate", { row: idx + 1 })}
                                />
                              ) : (
                                <span className="text-sm">{formatDayShort(new Date(entry.work_date + "T12:00:00"), localeTag)}</span>
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
                                  aria-label={t("hr.timesheets.rowProject", { row: idx + 1 })}
                                  aria-invalid={err === "Select a project"}
                                  aria-describedby={err ? `timesheet-row-${idx}-error` : undefined}
                                >
                                  <option value="">{t("hr.timesheets.selectProject")}</option>
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
                                  aria-label={t("hr.timesheets.rowBucket", { row: idx + 1 })}
                                  aria-invalid={err === "Select a work bucket"}
                                >
                                  <option value="">{t("hr.timesheets.bucketPlaceholder")}</option>
                                  {Object.keys(BUCKET_ICONS).map((b) => (
                                    <option key={b} value={b}>
                                      {t(`hr.timesheets.bucket.${b}`)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs capitalize text-neutral-600">
                                  {entry.work_bucket ? t(`hr.timesheets.bucket.${entry.work_bucket}`) : "—"}
                                </span>
                              )}
                            </td>
                            <td className="align-top min-w-[140px]">
                              {isDraft ? (
                                <input
                                  className="form-input py-1.5 text-sm"
                                  value={entry.activity_type ?? ""}
                                  onChange={(e) => updateEntryField(idx, "activity_type", e.target.value)}
                                  placeholder={t("hr.timesheets.activityPlaceholder")}
                                  aria-label={t("hr.timesheets.rowActivity", { row: idx + 1 })}
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
                                  aria-label={t("hr.timesheets.rowHours", { row: idx + 1 })}
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
                                  aria-label={t("hr.timesheets.rowOvertime", { row: idx + 1 })}
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
                                  placeholder={t("hr.timesheets.col.notes")}
                                  aria-label={t("hr.timesheets.rowNotes", { row: idx + 1 })}
                                />
                              ) : (
                                <span className="text-sm text-neutral-600">{entry.description || "—"}</span>
                              )}
                              {err && (
                                <p id={`timesheet-row-${idx}-error`} className="mt-1 text-[11px] font-medium text-red-600">{err}</p>
                              )}
                            </td>
                            {isDraft && (
                              <td className="align-top whitespace-nowrap">
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => handleDeleteEntry(entry.id, idx)}
                                  aria-label={t("hr.timesheets.removeRow", { row: idx + 1 })}
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
                          {t("hr.timesheets.weekTotal")}
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
                    {t("hr.timesheets.addRow")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingEntry(null); setShowQuickEntry(true); }}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    {t("hr.timesheets.quickEntry")}
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
        <summary className="cursor-pointer text-sm font-semibold text-neutral-700">{t("hr.timesheets.moreTools")}</summary>
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
              <h3 className="text-base font-semibold text-neutral-900">{t("hr.timesheets.rejectTitle")}</h3>
              <p className="text-sm text-neutral-600">{t("hr.timesheets.rejectPrompt")}</p>
              <textarea
                rows={4}
                className="form-input resize-none"
                placeholder={t("hr.timesheets.rejectPlaceholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowRejectModal(false)}>{t("common.cancel")}</button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? t("hr.timesheets.rejecting") : t("common.reject")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
