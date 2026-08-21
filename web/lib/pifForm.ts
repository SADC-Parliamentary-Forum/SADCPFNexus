/** Inclusive calendar-day count for PIF start/end (date-only, local). */
export function inclusiveDayCount(start: string, end: string): number | null {
  const s = parseDateOnly(start);
  const e = parseDateOnly(end);
  if (!s || !e || e < s) return null;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

function parseDateOnly(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Keep a stored value in a <select> even if it is no longer in the catalogue. */
export function optionsWithCurrent(options: readonly string[], current: string): string[] {
  const trimmed = current.trim();
  if (!trimmed) return [...options];
  if (options.includes(trimmed)) return [...options];
  return [trimmed, ...options];
}

export function toggleCommaList(current: string, token: string): string {
  const parts = current
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const has = parts.some((part) => part.toLowerCase() === token.toLowerCase());
  const next = has
    ? parts.filter((part) => part.toLowerCase() !== token.toLowerCase())
    : [...parts, token];
  return next.join(", ");
}

export function commaListHas(current: string, token: string): boolean {
  return current
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .includes(token.toLowerCase());
}

/** Safe label for a name string or a nested user/person object. */
export function personLabel(value: unknown, fallback = "—"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return fallback;
}
