export type TimesheetRowInput = {
  work_date?: string | null;
  hours?: number | string | null;
  overtime_hours?: number | string | null;
  project_id?: number | string | null;
  project?: { id: number; label?: string } | null;
  work_bucket?: string | null;
  source_type?: string | null;
  is_locked?: boolean;
};

export type TimesheetRowValidationOptions = {
  projectCount: number;
};

const LOCKED_SOURCES = new Set(["leave", "travel", "holiday"]);

export function toWorkDate(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return trimmed.slice(0, 10);
  }
  return String(value).slice(0, 10);
}

export function resolvedProjectId(entry: TimesheetRowInput): number | null {
  const raw = entry.project_id ?? entry.project?.id ?? null;
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function isLockedSource(entry: TimesheetRowInput): boolean {
  if (entry.is_locked) return true;
  return LOCKED_SOURCES.has(entry.source_type ?? "");
}

export function timesheetRowError(
  entry: TimesheetRowInput,
  options: TimesheetRowValidationOptions = { projectCount: 0 },
): string | null {
  if (!toWorkDate(entry.work_date)) return "Date required";

  if (entry.hours == null || entry.hours === "") return "Hours required";
  const hours = Number(entry.hours);
  if (Number.isNaN(hours)) return "Hours required";
  if (hours < 0 || hours > 24) return "Hours must be 0–24";

  const ot = Number(entry.overtime_hours ?? 0);
  if (Number.isNaN(ot) || ot < 0 || ot > 24) return "OT hours must be 0–24";

  if (isLockedSource(entry)) return null;

  if (options.projectCount > 0 && resolvedProjectId(entry) == null) {
    return "Select a project";
  }

  if (!entry.work_bucket) return "Select a work bucket";

  return null;
}

export function timesheetRowErrors(
  entries: TimesheetRowInput[],
  options: TimesheetRowValidationOptions = { projectCount: 0 },
): Record<number, string> {
  const errors: Record<number, string> = {};
  entries.forEach((entry, idx) => {
    const err = timesheetRowError(entry, options);
    if (err) errors[idx] = err;
  });
  return errors;
}

export function firstTimesheetRowErrorMessage(errors: Record<number, string>): string | null {
  const keys = Object.keys(errors);
  if (keys.length === 0) return null;
  const idx = Number(keys[0]);
  return `Row ${idx + 1}: ${errors[idx]}`;
}

export function normalizeTimesheetEntry<T extends TimesheetRowInput>(
  entry: T,
  options: { defaultProjectId?: number | null; defaultBucket?: string } = {},
): T {
  const projectId = resolvedProjectId(entry) ?? options.defaultProjectId ?? null;
  const locked = isLockedSource(entry);
  return {
    ...entry,
    work_date: toWorkDate(entry.work_date) || (entry.work_date ?? ""),
    project_id: projectId,
    work_bucket: entry.work_bucket ?? (locked ? null : options.defaultBucket ?? null),
  };
}
