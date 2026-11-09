"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { hrApi, type TimesheetEntry, type TimesheetProject } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Work type definitions ─────────────────────────────────────────────────

interface WorkType {
  id: string;
  label: string;
  icon: string;
  bucket: TimesheetEntry["work_bucket"];
  iconBg: string;
  iconColor: string;
  activities: string[];
}

const WORK_TYPES: WorkType[] = [
  {
    id: "task",
    label: "timesheets.quickEntry.type.task",
    icon: "task_alt",
    bucket: "delivery",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    activities: ["Task Execution", "Research", "Documentation", "Review"],
  },
  {
    id: "project",
    label: "timesheets.quickEntry.type.project",
    icon: "folder_open",
    bucket: "delivery",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    activities: ["Planning", "Implementation", "Coordination", "Reporting"],
  },
  {
    id: "meeting",
    label: "timesheets.quickEntry.type.meeting",
    icon: "groups",
    bucket: "meeting",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    activities: ["Team Meeting", "ExCo/Board", "Committee", "External"],
  },
  {
    id: "communication",
    label: "timesheets.quickEntry.type.communication",
    icon: "chat_bubble",
    bucket: "communication",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    activities: ["Email", "Stakeholder Liaison", "External Comms"],
  },
  {
    id: "administration",
    label: "timesheets.quickEntry.type.administration",
    icon: "settings",
    bucket: "administration",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    activities: ["HR/Leave Admin", "Finance Processing", "Filing"],
  },
  {
    id: "other",
    label: "timesheets.quickEntry.type.other",
    icon: "category",
    bucket: "other",
    iconBg: "bg-neutral-100",
    iconColor: "text-neutral-600",
    activities: ["Training", "Mission Prep", "Unplanned Work"],
  },
];

const ACTIVITY_LABEL: Record<string, string> = {
  "Task Execution": "timesheets.quickEntry.activity.taskExecution",
  "Research": "timesheets.quickEntry.activity.research",
  "Documentation": "timesheets.quickEntry.activity.documentation",
  "Review": "timesheets.quickEntry.activity.review",
  "Planning": "timesheets.quickEntry.activity.planning",
  "Implementation": "timesheets.quickEntry.activity.implementation",
  "Coordination": "timesheets.quickEntry.activity.coordination",
  "Reporting": "timesheets.quickEntry.activity.reporting",
  "Team Meeting": "timesheets.quickEntry.activity.teamMeeting",
  "ExCo/Board": "timesheets.quickEntry.activity.excoBoard",
  "Committee": "timesheets.quickEntry.activity.committee",
  "External": "timesheets.quickEntry.activity.external",
  "Email": "timesheets.quickEntry.activity.email",
  "Stakeholder Liaison": "timesheets.quickEntry.activity.stakeholderLiaison",
  "External Comms": "timesheets.quickEntry.activity.externalComms",
  "HR/Leave Admin": "timesheets.quickEntry.activity.hrLeaveAdmin",
  "Finance Processing": "timesheets.quickEntry.activity.financeProcessing",
  "Filing": "timesheets.quickEntry.activity.filing",
  "Training": "timesheets.quickEntry.activity.training",
  "Mission Prep": "timesheets.quickEntry.activity.missionPrep",
  "Unplanned Work": "timesheets.quickEntry.activity.unplannedWork",
};

const QUICK_HOURS = [0.5, 1, 2, 4, 8];

// ─── Helpers ───────────────────────────────────────────────────────────────

// Safe local-time YMD formatter — avoids UTC offset shifting toISOString() causes in UTC+ timezones
function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localToday(): string {
  return localYMD(new Date());
}

function parseYMDDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, mo - 1, d);

  // Reject invalid calendar dates like 2026-02-30.
  if (
    isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }

  return date;
}

function getWeekDays(weekStart: string, dayNames: string[]): { label: string; value: string }[] {
  if (!weekStart) return [];
  const start = parseYMDDate(weekStart);
  if (!start) return [];
  const days = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    if (isNaN(date.getTime())) continue;
    const ymd = localYMD(date);
    const label = `${dayNames[i]} ${date.getDate()} ${date.toLocaleDateString("en-GB", { month: "short" })}`;
    days.push({ label, value: ymd });
  }
  return days;
}

function todayInWeek(weekStart: string): string {
  if (!weekStart) return "";
  const start = parseYMDDate(weekStart);
  if (!start) return "";
  const today = localToday();
  const startStr = localYMD(start);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  if (isNaN(end.getTime())) return startStr;
  const endStr = localYMD(end);
  if (today >= startStr && today <= endStr) return today;
  return startStr;
}

function getWorkingDaysInRange(from: string, to: string): string[] {
  const start = parseYMDDate(from);
  const end = parseYMDDate(to);
  if (!start || !end || start > end) return [];
  const days: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) days.push(localYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function getFriday(weekStart: string): string {
  const start = parseYMDDate(weekStart);
  if (!start) return weekStart;
  const fri = new Date(start);
  fri.setDate(start.getDate() + 4);
  return localYMD(fri);
}

// ─── Component ─────────────────────────────────────────────────────────────

type SpanMode = "single" | "week" | "range";

interface Props {
  open: boolean;
  weekStart: string;
  projects: TimesheetProject[];
  onClose: () => void;
  onAdd: (entries: TimesheetEntry[]) => void;
  editEntry?: TimesheetEntry | null;
}

export function QuickEntrySlideOver({ open, weekStart, projects, onClose, onAdd, editEntry }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2>(editEntry ? 2 : 1);
  const [selectedType, setSelectedType] = useState<WorkType | null>(null);
  const [spanMode, setSpanMode] = useState<SpanMode>("single");
  const [workDate, setWorkDate] = useState(todayInWeek(weekStart));
  const [rangeFrom, setRangeFrom] = useState(weekStart);
  const [rangeTo, setRangeTo] = useState(getFriday(weekStart));
  const [hours, setHours] = useState(1);
  const [activityType, setActivityType] = useState("");
  const [customActivity, setCustomActivity] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [workAssignmentId, setWorkAssignmentId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [assignments, setAssignments] = useState<{ id: number; title: string; estimated_hours: number | null }[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const weekDays = getWeekDays(weekStart, [t("timesheets.quickEntry.day.mon"), t("timesheets.quickEntry.day.tue"), t("timesheets.quickEntry.day.wed"), t("timesheets.quickEntry.day.thu"), t("timesheets.quickEntry.day.fri")]);

  // Pre-populate when editing
  useEffect(() => {
    if (editEntry) {
      setStep(2);
      const wt = WORK_TYPES.find((w) => w.bucket === editEntry.work_bucket) ?? WORK_TYPES[5];
      setSelectedType(wt);
      setWorkDate(editEntry.work_date);
      setHours(editEntry.hours);
      setActivityType(editEntry.activity_type ?? "");
      setProjectId(editEntry.project_id ?? projects[0]?.id ?? null);
      setWorkAssignmentId(editEntry.work_assignment_id ?? null);
      setDescription(editEntry.description ?? "");
    }
  }, [editEntry]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(editEntry ? 2 : 1);
        setSelectedType(editEntry ? WORK_TYPES.find((w) => w.bucket === editEntry.work_bucket) ?? null : null);
        setSpanMode("single");
        setWorkDate(todayInWeek(weekStart));
        setRangeFrom(weekStart);
        setRangeTo(getFriday(weekStart));
        setHours(1);
        setActivityType("");
        setCustomActivity("");
        setProjectId(projects[0]?.id ?? null);
        setWorkAssignmentId(null);
        setDescription("");
        setAssignments([]);
      }, 300);
    }
  }, [open]);

  const handleSelectType = async (wt: WorkType) => {
    setSelectedType(wt);
    setStep(2);
    setActivityType("");
    setCustomActivity("");
    setProjectId(projects[0]?.id ?? null);
    setWorkAssignmentId(null);

    if (wt.id === "task") {
      setLoadingAssignments(true);
      try {
        const res = await (hrApi as any).listAssignments?.({ per_page: 100, status: "active" });
        const items = res?.data?.data ?? res?.data ?? [];
        setAssignments(items.map((a: any) => ({ id: a.id, title: a.title, estimated_hours: a.estimated_hours ?? null })));
      } catch {
        setAssignments([]);
      } finally {
        setLoadingAssignments(false);
      }
    }
  };

  const handleSubmit = () => {
    const finalActivity = activityType === "__custom__" ? customActivity.trim() : activityType;

    let dates: string[];
    if (spanMode === "week") {
      dates = getWorkingDaysInRange(weekStart, getFriday(weekStart));
    } else if (spanMode === "range") {
      dates = getWorkingDaysInRange(rangeFrom, rangeTo);
    } else {
      dates = [workDate];
    }

    const entries: TimesheetEntry[] = dates.map((date, idx) => ({
      // Only carry over the existing id when editing a single entry
      ...(editEntry?.id && spanMode === "single" ? { id: editEntry.id } : {}),
      work_date: date,
      hours,
      overtime_hours: Math.max(0, hours - 8),
      description: description.trim() || null,
      work_bucket: selectedType?.bucket ?? "other",
      activity_type: finalActivity || null,
      project_id: projectId,
      work_assignment_id: workAssignmentId,
    }));

    onAdd(entries);
    onClose();
  };

  const spannedDates =
    spanMode === "week"
      ? getWorkingDaysInRange(weekStart, getFriday(weekStart))
      : spanMode === "range"
      ? getWorkingDaysInRange(rangeFrom, rangeTo)
      : null;

  const canSubmit =
    hours > 0 &&
    (spanMode === "single"
      ? !!workDate
      : spanMode === "week"
      ? true
      : !!rangeFrom && !!rangeTo && rangeFrom <= rangeTo && getWorkingDaysInRange(rangeFrom, rangeTo).length > 0);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center gap-3">
            {step === 2 && !editEntry && (
              <button
                type="button"
                onClick={() => { setStep(1); setSelectedType(null); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                aria-label={t("common.back")}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
            )}
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                {editEntry ? t("timesheets.quickEntry.editEntry") : step === 1 ? t("timesheets.quickEntry.newTimeEntry") : selectedType ? t(selectedType.label) : t("timesheets.quickEntry.newEntry")}
              </h2>
              <p className="text-xs text-neutral-500">
                {step === 1 ? t("timesheets.quickEntry.selectType") : t("timesheets.quickEntry.fillDetails")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {WORK_TYPES.map((wt) => (
                <button
                  key={wt.id}
                  type="button"
                  onClick={() => handleSelectType(wt)}
                  className="card flex flex-col items-start gap-2.5 p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", wt.iconBg)}>
                    <span className={cn("material-symbols-outlined text-[20px]", wt.iconColor)}>{wt.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-neutral-800">{t(wt.label)}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && selectedType && (
            <div className="space-y-5">
              {/* Type indicator */}
              <div className="flex items-center gap-2.5 rounded-xl bg-neutral-50 px-3.5 py-3">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", selectedType.iconBg)}>
                  <span className={cn("material-symbols-outlined text-[18px]", selectedType.iconColor)}>
                    {selectedType.icon}
                  </span>
                </div>
                <span className="text-sm font-medium text-neutral-700">{t(selectedType.label)}</span>
              </div>

              {/* Date Span */}
              <div>
                <p className="mb-1.5 block text-xs font-medium text-neutral-700">{t("timesheets.quickEntry.dateSpan")}</p>
                {/* Mode tabs */}
                <div className="mb-2.5 flex overflow-hidden rounded-lg border border-neutral-200">
                  {(["single", "week", "range"] as SpanMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSpanMode(mode)}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-medium transition-colors",
                        spanMode === mode
                          ? "bg-primary text-white"
                          : "text-neutral-600 hover:bg-neutral-50"
                      )}
                    >
                      {mode === "single" ? t("timesheets.quickEntry.singleDay") : mode === "week" ? t("timesheets.quickEntry.wholeWeek") : t("timesheets.quickEntry.dateRange")}
                    </button>
                  ))}
                </div>

                {spanMode === "single" && (
                  <select
                    className="form-input"
                    aria-label={t("timesheets.quickEntry.day")}
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                  >
                    {weekDays.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                )}

                {spanMode === "week" && (
                  <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                    {t("timesheets.quickEntry.weekHint")}
                  </p>
                )}

                {spanMode === "range" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="form-input flex-1"
                      aria-label={t("fleet.utilisation.from")}
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(e.target.value)}
                    />
                    <span className="text-xs text-neutral-400">{t("timesheets.quickEntry.to")}</span>
                    <input
                      type="date"
                      className="form-input flex-1"
                      aria-label={t("fleet.utilisation.to")}
                      value={rangeTo}
                      onChange={(e) => setRangeTo(e.target.value)}
                    />
                  </div>
                )}

                {spanMode === "range" && spannedDates !== null && spannedDates.length > 0 && (
                  <p className="mt-1.5 text-xs text-neutral-500">
                    {spannedDates.length === 1 ? t("timesheets.quickEntry.oneDaySelected") : t("timesheets.quickEntry.daysSelected", { count: spannedDates.length })}
                  </p>
                )}
              </div>

              {/* Hours */}
              <div>
                <label htmlFor="quick-entry-hours" className="mb-1.5 block text-xs font-medium text-neutral-700">{t("timesheets.quickEntry.hours")}</label>
                <div className="flex items-center gap-2">
                  <input
                    id="quick-entry-hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={hours}
                    onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
                    className="form-input w-24"
                  />
                  <div className="flex gap-1.5">
                    {QUICK_HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHours(h)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                          hours === h
                            ? "border-primary bg-primary text-white"
                            : "border-neutral-200 text-neutral-600 hover:border-primary/40 hover:text-primary"
                        )}
                      >
                        {t("timesheets.quickEntry.hoursShort", { hours: h })}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Activity type */}
              <div>
                <label htmlFor="timesheets-QuickEntrySlideOver-activity" className="mb-1.5 block text-xs font-medium text-neutral-700">{t("mande.col.activity")}</label>
                <select id="timesheets-QuickEntrySlideOver-activity"
                  className="form-input"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                >
                  <option value="">{t("timesheets.quickEntry.selectActivity")}</option>
                  {selectedType.activities.map((a) => (
                    <option key={a} value={a}>{ACTIVITY_LABEL[a] ? t(ACTIVITY_LABEL[a]) : a}</option>
                  ))}
                  <option value="__custom__">{t("timesheets.quickEntry.otherManual")}</option>
                </select>
                {activityType === "__custom__" && (
                  <input
                    type="text"
                    placeholder={t("timesheets.quickEntry.describeActivity")}
                    className="form-input mt-2"
                    value={customActivity}
                    onChange={(e) => setCustomActivity(e.target.value)}
                  />
                )}
              </div>

              {projects.length > 0 && (
                <div>
                  <label htmlFor="quick-entry-project" className="mb-1.5 block text-xs font-medium text-neutral-700">
                    {t("timesheets.quickEntry.project")}
                  </label>
                  <select
                    id="quick-entry-project"
                    className="form-input"
                    value={projectId ?? ""}
                    onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">{t("timesheets.quickEntry.selectProject")}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Work assignment (for task type) */}
              {selectedType.id === "task" && (
                <div>
                  <label htmlFor="quick-entry-assignment" className="mb-1.5 block text-xs font-medium text-neutral-700">{t("timesheets.quickEntry.assignment")}</label>
                  {loadingAssignments ? (
                    <div className="h-9 animate-pulse rounded-lg bg-neutral-100" />
                  ) : (
                    <select
                      id="quick-entry-assignment"
                      className="form-input"
                      value={workAssignmentId ?? ""}
                      onChange={(e) => setWorkAssignmentId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">{t("timesheets.quickEntry.none")}</option>
                      {assignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}{a.estimated_hours ? ` ${t("timesheets.quickEntry.estimated", { hours: a.estimated_hours })}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Description / notes */}
              <div>
                <label htmlFor="timesheets-QuickEntrySlideOver-notes-optional" className="mb-1.5 block text-xs font-medium text-neutral-700">
                  {t("correspondence.field.notes")} <span className="text-neutral-400">{t("correspondence.optional")}</span>
                </label>
                <textarea id="timesheets-QuickEntrySlideOver-notes-optional"
                  rows={3}
                  placeholder={t("timesheets.quickEntry.notesPlaceholder")}
                  className="form-input resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div className="border-t border-neutral-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {editEntry
                  ? t("timesheets.quickEntry.updateEntry")
                  : spanMode === "week"
                  ? t("timesheets.quickEntry.addFive")
                  : spanMode === "range" && spannedDates && spannedDates.length > 1
                  ? t("timesheets.quickEntry.addCount", { count: spannedDates.length })
                  : t("timesheets.quickEntry.addEntry")}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
