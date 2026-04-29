"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, type Timesheet } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
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

/** Returns Monday of the week containing d */
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Returns all calendar cells (Mon–Sun × weeks) for a given month,
 *  padded with days from adjacent months so the grid is complete. */
function getCalendarWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startCell = getMonday(firstDay);
  const endMonday = getMonday(lastDay);
  const endCell   = addDays(endMonday, 6);

  const weeks: Date[][] = [];
  let cursor = new Date(startCell);
  while (cursor <= endCell) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "bg-neutral-100 text-neutral-600" },
  submitted: { label: "Submitted", cls: "bg-amber-100 text-amber-700" },
  approved:  { label: "Approved",  cls: "bg-green-100 text-green-700" },
  rejected:  { label: "Rejected",  cls: "bg-red-100 text-red-700" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonthlyTimesheetPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [leaveDays, setLeaveDays]     = useState<Record<string, { leave_type: string; status: string }>>({});
  const [travelDays, setTravelDays]   = useState<Record<string, { purpose: string; destination: string; reference: string }>>({});
  const [holidayDates, setHolidayDates] = useState<Record<string, { name: string; is_paid: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Derived calendar data
  const weeks = getCalendarWeeks(year, month);
  const monthStart = toYMD(new Date(year, month, 1));
  const monthEnd   = toYMD(new Date(year, month + 1, 0));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tsRes, ldRes, tdRes, hdRes] = await Promise.all([
        hrApi.listTimesheets({ month: month + 1, year, per_page: 10 }),
        hrApi.getTimesheetLeaveDays(monthStart, monthEnd),
        hrApi.getTimesheetTravelDays(monthStart, monthEnd),
        hrApi.getTimesheetHolidayDates(monthStart, monthEnd),
      ]);
      setTimesheets((tsRes.data as any).data ?? []);
      setLeaveDays((ldRes.data as any).data ?? {});
      setTravelDays((tdRes.data as any).data ?? {});
      setHolidayDates((hdRes.data as any).data ?? {});
    } catch {
      setError("Failed to load monthly data.");
    } finally {
      setLoading(false);
    }
  }, [year, month, monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  /** Find the timesheet that covers a given date */
  const getTimesheetForDate = (ymd: string): Timesheet | undefined =>
    timesheets.find((ts) => ts.week_start <= ymd && ts.week_end >= ymd);

  /** Compute hours logged for a specific date from its timesheet entries */
  const getHoursForDate = (ymd: string): number => {
    const ts = getTimesheetForDate(ymd);
    if (!ts?.entries) return 0;
    return ts.entries.filter((e) => e.work_date === ymd).reduce((s, e) => s + e.hours, 0);
  };

  /** Day status for styling */
  type DayStatus = "leave" | "travel" | "holiday" | "weekend" | "complete" | "incomplete" | "approved" | "submitted" | "future" | "other-month";
  const getDayStatus = (d: Date, inMonth: boolean): DayStatus => {
    if (!inMonth) return "other-month";
    const ymd  = toYMD(d);
    const today = toYMD(new Date());
    if (holidayDates[ymd]) return "holiday";
    if (leaveDays[ymd])    return "leave";
    if (travelDays[ymd])   return "travel";
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    if (isWeekend) return "weekend";
    if (ymd > today) return "future";
    const ts = getTimesheetForDate(ymd);
    if (ts?.status === "approved")  return "approved";
    if (ts?.status === "submitted") return "submitted";
    const hours = getHoursForDate(ymd);
    if (hours >= 8) return "complete";
    if (hours > 0)  return "complete"; // partial still counts as logged
    return "incomplete";
  };

  const DAY_STATUS_STYLES: Record<DayStatus, string> = {
    "other-month": "bg-neutral-50 text-neutral-300",
    holiday:       "bg-neutral-100 text-neutral-500",
    leave:         "bg-amber-50 text-amber-700",
    travel:        "bg-teal-50 text-teal-700",
    weekend:       "bg-neutral-50 text-neutral-400",
    future:        "bg-white text-neutral-500",
    approved:      "bg-green-50 text-green-700",
    submitted:     "bg-amber-50 text-amber-700",
    complete:      "bg-white text-neutral-800",
    incomplete:    "bg-red-50 text-red-600",
  };

  const DAY_STATUS_DOT: Partial<Record<DayStatus, string>> = {
    approved:   "bg-green-500",
    submitted:  "bg-amber-500",
    incomplete: "bg-red-400",
    complete:   "bg-blue-400",
    travel:     "bg-teal-500",
    leave:      "bg-amber-400",
    holiday:    "bg-neutral-400",
  };

  /** Get week totals for a given week row */
  const getWeekTotals = (week: Date[]) => {
    return week.reduce((sum, d) => sum + getHoursForDate(toYMD(d)), 0);
  };

  /** Get week timesheet (using the Monday of the week) */
  const getWeekTimesheet = (week: Date[]): Timesheet | undefined => {
    const monday = week[0];
    return getTimesheetForDate(toYMD(monday));
  };

  const totalHoursThisMonth = timesheets.reduce((s, ts) => s + (ts.total_hours ?? 0), 0);
  const approvedCount  = timesheets.filter((ts) => ts.status === "approved").length;
  const submittedCount = timesheets.filter((ts) => ts.status === "submitted").length;
  const draftCount     = timesheets.filter((ts) => ts.status === "draft" || !ts.status).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{MONTH_NAMES[month]} {year}</h1>
          <p className="page-subtitle">Monthly timesheet overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/hr/timesheets" className="btn-secondary text-sm">Weekly View</Link>
          <button type="button" onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100">
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button type="button" onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100">
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Hours", value: `${totalHoursThisMonth.toFixed(1)}h`, icon: "schedule", color: "text-primary" },
          { label: "Approved",    value: `${approvedCount} wk`,  icon: "check_circle", color: "text-green-600" },
          { label: "Pending",     value: `${submittedCount} wk`, icon: "pending",      color: "text-amber-600" },
          { label: "Draft",       value: `${draftCount} wk`,     icon: "edit_note",    color: "text-neutral-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4 flex items-center gap-3">
            <span className={cn("material-symbols-outlined text-[22px]", kpi.color)}>{kpi.icon}</span>
            <div>
              <p className="text-lg font-bold text-neutral-900">{kpi.value}</p>
              <p className="text-xs text-neutral-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { cls: "bg-green-100 text-green-700",   label: "Approved" },
          { cls: "bg-amber-100 text-amber-700",   label: "Submitted" },
          { cls: "bg-red-100 text-red-600",       label: "Incomplete" },
          { cls: "bg-teal-100 text-teal-700",     label: "Mission" },
          { cls: "bg-amber-50 text-amber-700",    label: "Leave" },
          { cls: "bg-neutral-100 text-neutral-600", label: "Holiday" },
          { cls: "bg-neutral-50 text-neutral-400", label: "Weekend" },
        ].map((l) => (
          <span key={l.label} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", l.cls)}>
            {l.label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1,2,3,4,5].map((i) => <div key={i} className="h-16 rounded-xl bg-neutral-100" />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Header row */}
          <div className="grid border-b border-neutral-100 bg-neutral-50" style={{ gridTemplateColumns: "repeat(7, 1fr) 80px 100px" }}>
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">{d}</div>
            ))}
            <div className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">Total</div>
            <div className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</div>
          </div>

          {/* Week rows */}
          {weeks.map((week, wi) => {
            const weekTs = getWeekTimesheet(week);
            const weekTotal = getWeekTotals(week);
            const tsStatus  = weekTs?.status ?? null;
            return (
              <div key={wi} className="grid border-b border-neutral-100 last:border-0" style={{ gridTemplateColumns: "repeat(7, 1fr) 80px 100px" }}>
                {week.map((d) => {
                  const inMonth  = d.getMonth() === month;
                  const ymd      = toYMD(d);
                  const status   = getDayStatus(d, inMonth);
                  const hours    = inMonth ? getHoursForDate(ymd) : 0;
                  const dot      = DAY_STATUS_DOT[status];
                  const isToday  = ymd === toYMD(new Date());
                  return (
                    <div
                      key={ymd}
                      className={cn(
                        "relative flex flex-col items-center justify-center px-1 py-2 min-h-[56px] border-r border-neutral-100 last:border-0",
                        DAY_STATUS_STYLES[status],
                        inMonth && weekTs ? "cursor-pointer hover:brightness-95" : ""
                      )}
                      onClick={() => weekTs && inMonth && window.location.assign(`/hr/timesheets/${weekTs.id}`)}
                    >
                      <span className={cn("text-xs font-semibold", isToday && "underline underline-offset-2")}>{d.getDate()}</span>
                      {hours > 0 && inMonth && (
                        <span className="text-[10px] mt-0.5 font-medium opacity-80">{hours}h</span>
                      )}
                      {dot && inMonth && (
                        <span className={cn("absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full", dot)} />
                      )}
                      {holidayDates[ymd] && inMonth && (
                        <span className="text-[9px] mt-0.5 opacity-70 text-center leading-tight line-clamp-1 px-0.5">
                          {holidayDates[ymd].name}
                        </span>
                      )}
                    </div>
                  );
                })}
                {/* Week total */}
                <div className="flex flex-col items-center justify-center border-r border-neutral-100 bg-neutral-50 min-h-[56px]">
                  <span className="text-xs font-bold text-neutral-700">{weekTotal > 0 ? `${weekTotal.toFixed(1)}h` : "—"}</span>
                </div>
                {/* Week status */}
                <div className="flex items-center justify-center bg-neutral-50 min-h-[56px]">
                  {tsStatus ? (
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_CONFIG[tsStatus]?.cls ?? "bg-neutral-100 text-neutral-500")}>
                      {STATUS_CONFIG[tsStatus]?.label ?? tsStatus}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-300">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between">
        <Link href="/hr/timesheets/history" className="text-xs text-neutral-500 hover:underline">All timesheets →</Link>
        <Link href="/hr/timesheets" className="text-xs text-primary hover:underline">Open weekly view →</Link>
      </div>
    </div>
  );
}
