"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { hrApi, type TimesheetEntry, type TimesheetProject } from "@/lib/api";

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
    label: "Assigned Task",
    icon: "task_alt",
    bucket: "delivery",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    activities: ["Task Execution", "Research", "Documentation", "Review"],
  },
  {
    id: "project",
    label: "Project Work",
    icon: "folder_open",
    bucket: "delivery",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    activities: ["Planning", "Implementation", "Coordination", "Reporting"],
  },
  {
    id: "meeting",
    label: "Meeting",
    icon: "groups",
    bucket: "meeting",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    activities: ["Team Meeting", "ExCo/Board", "Committee", "External"],
  },
  {
    id: "communication",
    label: "Communication",
    icon: "chat_bubble",
    bucket: "communication",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    activities: ["Email", "Stakeholder Liaison", "External Comms"],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "settings",
    bucket: "administration",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    activities: ["HR/Leave Admin", "Finance Processing", "Filing"],
  },
  {
    id: "other",
    label: "Other",
    icon: "category",
    bucket: "other",
    iconBg: "bg-neutral-100",
    iconColor: "text-neutral-600",
    activities: ["Training", "Mission Prep", "Unplanned Work"],
  },
];

const QUICK_HOURS = [0.5, 1, 2, 4];

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

function getWeekDays(weekStart: string): { label: string; value: string }[] {
  if (!weekStart) return [];
  const start = parseYMDDate(weekStart);
  if (!start) return [];
  const days = [];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
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

// ─── Component ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  weekStart: string;
  projects: TimesheetProject[];
  onClose: () => void;
  onAdd: (entry: TimesheetEntry) => void;
  editEntry?: TimesheetEntry | null;
}

export function QuickEntrySlideOver({ open, weekStart, projects, onClose, onAdd, editEntry }: Props) {
  const [step, setStep] = useState<1 | 2>(editEntry ? 2 : 1);
  const [selectedType, setSelectedType] = useState<WorkType | null>(null);
  const [workDate, setWorkDate] = useState(todayInWeek(weekStart));
  const [hours, setHours] = useState(1);
  const [activityType, setActivityType] = useState("");
  const [customActivity, setCustomActivity] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [workAssignmentId, setWorkAssignmentId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [assignments, setAssignments] = useState<{ id: number; title: string; estimated_hours: number | null }[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const weekDays = getWeekDays(weekStart);

  // Pre-populate when editing
  useEffect(() => {
    if (editEntry) {
      setStep(2);
      const wt = WORK_TYPES.find((t) => t.bucket === editEntry.work_bucket) ?? WORK_TYPES[5];
      setSelectedType(wt);
      setWorkDate(editEntry.work_date);
      setHours(editEntry.hours);
      setActivityType(editEntry.activity_type ?? "");
      setProjectId(editEntry.project_id ?? null);
      setWorkAssignmentId(editEntry.work_assignment_id ?? null);
      setDescription(editEntry.description ?? "");
    }
  }, [editEntry]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(editEntry ? 2 : 1);
        setSelectedType(editEntry ? WORK_TYPES.find((t) => t.bucket === editEntry.work_bucket) ?? null : null);
        setWorkDate(todayInWeek(weekStart));
        setHours(1);
        setActivityType("");
        setCustomActivity("");
        setProjectId(null);
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
    setProjectId(null);
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
    const entry: TimesheetEntry = {
      ...(editEntry?.id ? { id: editEntry.id } : {}),
      work_date: workDate,
      hours,
      overtime_hours: Math.max(0, hours - 8),
      description: description.trim() || null,
      work_bucket: selectedType?.bucket ?? "other",
      activity_type: finalActivity || null,
      project_id: projectId,
      work_assignment_id: workAssignmentId,
    };
    onAdd(entry);
    onClose();
  };

  const canSubmit = hours > 0 && workDate;

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
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
            )}
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                {editEntry ? "Edit Entry" : step === 1 ? "New Time Entry" : selectedType?.label ?? "New Entry"}
              </h2>
              <p className="text-xs text-neutral-500">
                {step === 1 ? "Select the type of work" : "Fill in the details"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
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
                  <span className="text-sm font-medium text-neutral-800">{wt.label}</span>
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
                <span className="text-sm font-medium text-neutral-700">{selectedType.label}</span>
              </div>

              {/* Work date */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">Date</label>
                <select
                  className="form-input"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                >
                  {weekDays.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Hours */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">Hours</label>
                <div className="flex items-center gap-2">
                  <input
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
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Activity type */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">Activity</label>
                <select
                  className="form-input"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                >
                  <option value="">— Select activity —</option>
                  {selectedType.activities.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                  <option value="__custom__">Other (type manually)</option>
                </select>
                {activityType === "__custom__" && (
                  <input
                    type="text"
                    placeholder="Describe the activity..."
                    className="form-input mt-2"
                    value={customActivity}
                    onChange={(e) => setCustomActivity(e.target.value)}
                  />
                )}
              </div>

              {/* Project (for project type) */}
              {selectedType.id === "project" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700">Project</label>
                  <select
                    className="form-input"
                    value={projectId ?? ""}
                    onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">— No project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Work assignment (for task type) */}
              {selectedType.id === "task" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700">Assignment</label>
                  {loadingAssignments ? (
                    <div className="h-9 animate-pulse rounded-lg bg-neutral-100" />
                  ) : (
                    <select
                      className="form-input"
                      value={workAssignmentId ?? ""}
                      onChange={(e) => setWorkAssignmentId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— None —</option>
                      {assignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}{a.estimated_hours ? ` (${a.estimated_hours}h est.)` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Description / notes */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">
                  Notes <span className="text-neutral-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Add any additional notes..."
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {editEntry ? "Update Entry" : "Add Entry"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
