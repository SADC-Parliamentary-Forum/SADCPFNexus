import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Friendly short date: "31 Mar 2027" (always include year for clarity).
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Date range: "28 Mar – 31 Mar 2027" or single date when same.
 */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  if (!start && !end) return "—";
  if (!start) return formatDateShort(end);
  if (!end) return formatDateShort(start);
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime())) return formatDateShort(end);
  if (isNaN(e.getTime())) return formatDateShort(start);
  if (s.getTime() === e.getTime()) return formatDateShort(start);
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

/**
 * Returns relative label: "Today", "Yesterday", "In 3 days", "5 days ago", or formatted date.
 */
export function formatDateRelative(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return formatDateShort(date);
}

/**
 * Compact date for tables: "31 Mar" (current year) or "31 Mar '27" (other year).
 * Human-readable and short for dense UIs.
 */
export function formatDateTable(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const year = d.getFullYear();
  if (year === now.getFullYear()) return `${day} ${month}`;
  return `${day} ${month} '${String(year).slice(-2)}`;
}

/**
 * Compact date range for tables: "28 Mar – 31 Mar" or "28 Mar – 31 Mar '27".
 */
export function formatDateRangeTable(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  if (!start && !end) return "—";
  if (!start) return formatDateTable(end);
  if (!end) return formatDateTable(start);
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime())) return formatDateTable(end);
  if (isNaN(e.getTime())) return formatDateTable(start);
  if (s.getTime() === e.getTime()) return formatDateTable(start);
  const now = new Date();
  const showYear = s.getFullYear() !== now.getFullYear() || e.getFullYear() !== now.getFullYear();
  const fmt = (d: Date) => {
    const day = d.getDate();
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const y = d.getFullYear();
    if (!showYear || y === now.getFullYear()) return `${day} ${month}`;
    return `${day} ${month} '${String(y).slice(-2)}`;
  };
  return `${fmt(s)} – ${fmt(e)}`;
}

export function formatCurrency(amount: number, currency = "NAD"): string {
  return new Intl.NumberFormat("en-NA", {
    style: "currency",
    currency,
  }).format(amount);
}
