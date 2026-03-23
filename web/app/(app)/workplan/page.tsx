"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { workplanApi, type WorkplanEvent } from "@/lib/api";
import { loadPdfLibs } from "@/lib/pdf-libs";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  travel: "Travel",
  leave: "Leave",
  milestone: "Milestone",
  deadline: "Deadline",
};

const TYPE_COLOR: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  meeting:   { bg: "bg-primary/10",  text: "text-primary",     border: "border-primary/25",   bar: "#1d85ed" },
  travel:    { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-300",    bar: "#f59e0b" },
  leave:     { bg: "bg-green-100",   text: "text-green-800",   border: "border-green-300",    bar: "#10b981" },
  milestone: { bg: "bg-purple-100",  text: "text-purple-800",  border: "border-purple-300",   bar: "#8b5cf6" },
  deadline:  { bg: "bg-red-100",     text: "text-red-800",     border: "border-red-300",      bar: "#ef4444" },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type ViewMode = "list" | "calendar" | "gantt";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string) {
  if (!s) return new Date(NaN);
  // Handle Y-m-d or ISO date-time (take date part only)
  const datePart = s.split("T")[0] ?? s;
  const [y, m, d] = datePart.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatShort(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDate(s: string) {
  return parseDate(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── CalendarView ──────────────────────────────────────────────────────────────

// Multi-day event segment in one week row: event + start day (1-31) + end day (1-31) for that segment
type CalendarSpan = { ev: WorkplanEvent; startDay: number; endDay: number };

function CalendarView({
  events,
  year,
  month,
  onPrev,
  onNext,
  onOpenEvent,
  onDeleteEvent,
}: {
  events: WorkplanEvent[];
  year: number;
  month: number; // 0-indexed
  onPrev: () => void;
  onNext: () => void;
  onOpenEvent: (id: number) => void;
  onDeleteEvent: (id: number) => void;
}) {
  const today = ymd(new Date());

  // Build day grid
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay(); // 0 = Sunday

  const totalCells = startOffset + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  // Single-day events per day (events that start and end on same day, or no end_date)
  const singleDayByDay = useMemo(() => {
    const map: Record<number, WorkplanEvent[]> = {};
    for (let d = 1; d <= daysInMonth; d++) map[d] = [];
    for (const ev of events) {
      const start = parseDate(ev.date);
      const end = ev.end_date ? parseDate(ev.end_date) : start;
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month, daysInMonth);
      if (end < monthStart || start > monthEnd) continue;
      const clampedStart = start < monthStart ? monthStart : start;
      const clampedEnd = end > monthEnd ? monthEnd : end;
      const isMultiDay = ev.end_date && ev.end_date !== ev.date && diffDays(clampedStart, clampedEnd) >= 1;
      if (isMultiDay) continue; // handled by spans
      const day = clampedStart.getDate();
      map[day] = map[day] ?? [];
      if (!map[day].find((e) => e.id === ev.id)) map[day].push(ev);
    }
    return map;
  }, [events, year, month, daysInMonth]);

  // Multi-day event segments per week row: bars that span across cells
  const spansByWeekRow = useMemo(() => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month, daysInMonth);
    const result: CalendarSpan[][] = [];
    for (let r = 0; r < rows; r++) result.push([]);

    for (const ev of events) {
      const start = parseDate(ev.date);
      const end = ev.end_date ? parseDate(ev.end_date) : start;
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (!ev.end_date || ev.end_date === ev.date) continue;
      if (end < monthStart || start > monthEnd) continue;
      const firstDayInMonth = Math.max(1, start.getDate());
      const lastDayInMonth = Math.min(daysInMonth, end.getDate());
      if (firstDayInMonth > lastDayInMonth) continue;

      // Segment per week row
      for (let r = 0; r < rows; r++) {
        const weekStartDay = Math.max(1, r * 7 - startOffset + 1);
        const weekEndDay = Math.min(daysInMonth, (r + 1) * 7 - startOffset);
        if (weekEndDay < 1 || weekStartDay > daysInMonth) continue;
        const segStart = Math.max(firstDayInMonth, weekStartDay);
        const segEnd = Math.min(lastDayInMonth, weekEndDay);
        if (segStart <= segEnd) {
          result[r].push({ ev, startDay: segStart, endDay: segEnd });
        }
      }
    }
    return result;
  }, [events, year, month, daysInMonth, rows, startOffset]);

  const eventsThisMonth = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= daysInMonth; d++) n += (singleDayByDay[d] ?? []).length;
    for (const spans of spansByWeekRow) n += spans.length;
    return n;
  }, [singleDayByDay, spansByWeekRow, daysInMonth]);

  return (
    <div>
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={onPrev} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          Prev
        </button>
        <h2 className="text-base font-bold text-neutral-900">{MONTHS[month]} {year}</h2>
        <button type="button" onClick={onNext} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1">
          Next
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>

      {events.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 py-10 text-center mb-4">
          <span className="material-symbols-outlined text-4xl text-neutral-300">event_busy</span>
          <p className="mt-2 text-sm font-medium text-neutral-600">No events loaded for this year.</p>
          <p className="text-xs text-neutral-500 mt-1">Add an event or check your filters.</p>
        </div>
      )}
      {events.length > 0 && eventsThisMonth === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 py-3 px-4 mb-4 flex items-center gap-2 text-sm text-amber-800">
          <span className="material-symbols-outlined text-[20px]">info</span>
          <span>No events in {MONTHS[month]} {year}. Use Prev/Next to switch month, or add an event.</span>
        </div>
      )}

      {/* Day-name header */}
      <div className="grid grid-cols-7 border-l border-t border-neutral-200">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-neutral-500 py-2 border-r border-b border-neutral-200 bg-neutral-50">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows: each week has a bar row (multi-day spans) then day cells (single-day events) */}
      <div className="border-l border-neutral-200">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="contents">
            {/* Bar row: one spanning bar per multi-day event in this week */}
            <div
              className="grid grid-cols-7 border-r border-b border-neutral-200 bg-neutral-50/30"
              style={{ minHeight: 26 }}
            >
              {spansByWeekRow[rowIdx]?.map(({ ev, startDay, endDay }) => {
                const colStart = (startDay - 1 + startOffset) % 7;
                const colEnd = (endDay - 1 + startOffset) % 7;
                const c = TYPE_COLOR[ev.type] ?? TYPE_COLOR.meeting;
                return (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    className="rounded px-2 py-1 text-[11px] font-medium leading-tight border truncate flex items-center justify-between gap-1 hover:opacity-90 transition-opacity cursor-pointer"
                    style={{
                      gridColumn: `${colStart + 1} / ${colEnd + 2}`,
                      backgroundColor: c.bar,
                      color: "#fff",
                      borderColor: "rgba(0,0,0,0.15)",
                    }}
                    title={`${ev.title} · ${formatDate(ev.date)}${ev.end_date ? ` – ${formatDate(ev.end_date)}` : ""}`}
                    onDoubleClick={(e) => { e.preventDefault(); onOpenEvent(ev.id); }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{ev.title}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteEvent(ev.id); }}
                      className="flex-shrink-0 opacity-70 hover:opacity-100 p-0.5 rounded"
                      title="Delete event"
                      aria-label="Delete"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Day cells row */}
            <div className="grid grid-cols-7 border-r border-neutral-200">
              {Array.from({ length: 7 }).map((_, colIdx) => {
                const cellIdx = rowIdx * 7 + colIdx;
                const day = cellIdx - startOffset + 1;
                const isCurrentMonth = day >= 1 && day <= daysInMonth;
                const cellDate = isCurrentMonth ? ymd(new Date(year, month, day)) : null;
                const isToday = cellDate === today;
                const dayEvents = isCurrentMonth ? (singleDayByDay[day] ?? []) : [];
                const MAX_VISIBLE = 4;
                const visible = dayEvents.slice(0, MAX_VISIBLE);
                const overflow = dayEvents.length - MAX_VISIBLE;

                return (
                  <div
                    key={cellIdx}
                    className={`min-h-[100px] border-r border-b border-neutral-200 p-1.5 ${
                      isCurrentMonth ? "bg-white" : "bg-neutral-50/60"
                    }`}
                  >
                    {isCurrentMonth && (
                      <>
                        <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                          isToday ? "bg-primary text-white" : "text-neutral-700"
                        }`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {visible.map((ev) => {
                            const c = TYPE_COLOR[ev.type] ?? TYPE_COLOR.meeting;
                            return (
                              <div
                                key={ev.id}
                                role="button"
                                tabIndex={0}
                                className={`block truncate rounded px-2 py-1 text-[11px] font-medium leading-tight border ${c.bg} ${c.text} ${c.border} hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-between gap-1`}
                                title={`${ev.title} · Double-click to open`}
                                onDoubleClick={(e) => { e.preventDefault(); onOpenEvent(ev.id); }}
                              >
                                <span className="truncate">{ev.title}</span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteEvent(ev.id); }}
                                  className="flex-shrink-0 opacity-60 hover:opacity-100 p-0.5 rounded"
                                  title="Delete event"
                                  aria-label="Delete"
                                >
                                  <span className="material-symbols-outlined text-[12px]">close</span>
                                </button>
                              </div>
                            );
                          })}
                          {overflow > 0 && <p className="text-[10px] text-neutral-400 pl-1">+{overflow} more</p>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-neutral-100">
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const c = TYPE_COLOR[type];
          return (
            <span key={type} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text} ${c.border}`}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── GanttView ─────────────────────────────────────────────────────────────────

function GanttView({
  events,
  year,
  month,
  onPrev,
  onNext,
  onOpenEvent,
  onDeleteEvent,
}: {
  events: WorkplanEvent[];
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onOpenEvent: (id: number) => void;
  onDeleteEvent: (id: number) => void;
}) {
  // Show 3 months: prev, current, next
  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month + 2, 0); // last day of next month
  const totalDays = diffDays(rangeStart, rangeEnd) + 1;

  // Filter events that overlap the range (skip invalid dates)
  const visibleEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const start = parseDate(ev.date);
        const end = ev.end_date ? parseDate(ev.end_date) : start;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        return end >= rangeStart && start <= rangeEnd;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, rangeStart, rangeEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build month column headers
  const monthHeaders = useMemo(() => {
    const headers: { label: string; startDay: number; days: number }[] = [];
    let cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0);

      const clampedStart = monthStart < rangeStart ? rangeStart : monthStart;
      const clampedEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;

      const startDay = diffDays(rangeStart, clampedStart);
      const days = diffDays(clampedStart, clampedEnd) + 1;

      headers.push({ label: `${MONTHS[m].slice(0, 3)} ${y}`, startDay, days });
      cur = new Date(y, m + 2, 1); // move to next month
    }
    return headers;
  }, [rangeStart, rangeEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build day tick marks (only every 5 or 7 days to avoid clutter)
  const dayTicks = useMemo(() => {
    const ticks: { day: number; label: string }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i);
      if (d.getDate() === 1 || d.getDate() % 7 === 1) {
        ticks.push({ day: i, label: String(d.getDate()) });
      }
    }
    return ticks;
  }, [rangeStart, totalDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayOffset = diffDays(rangeStart, new Date());
  const showTodayLine = todayOffset >= 0 && todayOffset < totalDays;

  const ROW_H = 36; // px per row
  const LABEL_W = 220; // px for label column

  if (visibleEvents.length === 0) {
    return (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-4xl text-neutral-200">bar_chart</span>
        <p className="mt-3 text-sm text-neutral-500">No events in this period.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Navigator */}
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={onPrev} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          Prev
        </button>
        <h2 className="text-base font-bold text-neutral-900">
          {MONTHS[month - 1 < 0 ? 11 : month - 1].slice(0,3)} – {MONTHS[(month + 1) % 12].slice(0,3)} {year}
          <span className="text-sm font-normal text-neutral-500 ml-2">({visibleEvents.length} events)</span>
        </h2>
        <button type="button" onClick={onNext} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1">
          Next
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <div style={{ minWidth: `${LABEL_W + 900}px` }}>

          {/* Header row — month labels */}
          <div className="flex border-b border-neutral-200 bg-neutral-50">
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="border-r border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 flex items-center">
              Event
            </div>
            <div className="flex-1 relative">
              <div className="flex h-full">
                {monthHeaders.map((mh, i) => (
                  <div
                    key={i}
                    className="border-r border-neutral-300 text-center text-xs font-bold text-neutral-700 py-2 bg-neutral-100"
                    style={{ width: `${(mh.days / totalDays) * 100}%` }}
                  >
                    {mh.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Day tick header */}
          <div className="flex border-b border-neutral-200 bg-neutral-50/50">
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="border-r border-neutral-200 px-3 py-1" />
            <div className="flex-1 relative h-6">
              {dayTicks.map((tick) => (
                <div
                  key={tick.day}
                  className="absolute top-0 h-full border-l border-neutral-200 flex items-center pl-1"
                  style={{ left: `${(tick.day / totalDays) * 100}%` }}
                >
                  <span className="text-[9px] text-neutral-400 font-medium">{tick.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Event rows */}
          <div className="relative">
            {/* Today vertical line */}
            {showTodayLine && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-10"
                style={{
                  left: `calc(${LABEL_W}px + ${(todayOffset / totalDays) * 100}% - ${LABEL_W / (LABEL_W + 900) * 100}%)`,
                }}
              >
                {/* Using a wrapper to position relative to timeline only */}
              </div>
            )}

            {visibleEvents.map((ev, rowIdx) => {
              const evStart = parseDate(ev.date);
              const evEnd = ev.end_date ? parseDate(ev.end_date) : evStart;

              const startOffset = Math.max(0, diffDays(rangeStart, evStart));
              const endOffset = Math.min(totalDays - 1, diffDays(rangeStart, evEnd));
              const barDays = endOffset - startOffset + 1;

              const leftPct = (startOffset / totalDays) * 100;
              const widthPct = Math.max((barDays / totalDays) * 100, (1 / totalDays) * 100);

              const c = TYPE_COLOR[ev.type] ?? TYPE_COLOR.meeting;
              const isSingleDay = !ev.end_date || ev.date === ev.end_date;

              return (
                <div
                  key={ev.id}
                  className={`flex items-center border-b border-neutral-100 ${rowIdx % 2 === 0 ? "bg-white" : "bg-neutral-50/40"}`}
                  style={{ height: ROW_H }}
                >
                  {/* Label */}
                  <div
                    style={{ width: LABEL_W, minWidth: LABEL_W }}
                    className="border-r border-neutral-200 px-3 py-1 flex items-center gap-2 overflow-hidden"
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.bar }} />
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-xs font-medium text-neutral-800 truncate hover:text-primary cursor-pointer flex-1 min-w-0"
                      title="Double-click to open"
                      onDoubleClick={() => onOpenEvent(ev.id)}
                    >
                      {ev.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteEvent(ev.id); }}
                      className="flex-shrink-0 text-neutral-400 hover:text-red-600 p-0.5 rounded"
                      title="Delete event"
                      aria-label="Delete"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>

                  {/* Timeline */}
                  <div className="flex-1 relative h-full">
                    {/* Today line inside this row */}
                    {showTodayLine && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-400 opacity-60 z-10 pointer-events-none"
                        style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                      />
                    )}

                    {/* Day grid lines */}
                    {dayTicks.map((tick) => (
                      <div
                        key={tick.day}
                        className="absolute top-0 bottom-0 border-l border-neutral-100 pointer-events-none"
                        style={{ left: `${(tick.day / totalDays) * 100}%` }}
                      />
                    ))}

                    {/* Month separator lines */}
                    {monthHeaders.map((mh, i) =>
                      i > 0 ? (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-neutral-300 pointer-events-none"
                          style={{ left: `${(mh.startDay / totalDays) * 100}%` }}
                        />
                      ) : null
                    )}

                    {/* Event bar — double-click to open */}
                    <div
                      role="button"
                      tabIndex={0}
                      className="absolute top-1/2 -translate-y-1/2 rounded flex items-center overflow-hidden hover:opacity-90 transition-opacity cursor-pointer"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: 22,
                        backgroundColor: c.bar,
                        minWidth: isSingleDay ? 8 : 24,
                      }}
                      title={`${ev.title} · Double-click to open`}
                      onDoubleClick={() => onOpenEvent(ev.id)}
                    >
                      {isSingleDay ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div
                            className="w-3 h-3 rotate-45 flex-shrink-0"
                            style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
                          />
                        </div>
                      ) : (
                        <span className="px-1.5 text-[10px] font-semibold text-white truncate leading-none whitespace-nowrap">
                          {ev.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Today label at bottom */}
          {showTodayLine && (
            <div className="flex border-t border-neutral-200 bg-neutral-50">
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="border-r border-neutral-200 px-3 py-1.5">
                <span className="text-[10px] font-semibold text-red-500">Today</span>
              </div>
              <div className="flex-1 relative h-6">
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-400 opacity-60"
                  style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                />
                <div
                  className="absolute -translate-x-1/2 top-1 text-[9px] font-semibold text-red-500 whitespace-nowrap"
                  style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                >
                  {formatShort(new Date())}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const c = TYPE_COLOR[type];
          return (
            <span key={type} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text} ${c.border}`}>
              {label}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Today
        </span>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function WorkplanListPage() {
  const router = useRouter();
  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-indexed

  const [list, setList] = useState<WorkplanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [yearFilter, setYearFilter] = useState<string>(String(now.getFullYear()));
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [exportPdfOpen, setExportPdfOpen] = useState(false);

  const handleOpenEvent = useCallback((id: number) => {
    router.push(`/workplan/${id}`);
  }, [router]);

  const stableLoadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { type?: string; year?: number; month?: number } = {};
      if (typeFilter) params.type = typeFilter;
      if (viewMode === "list") {
        if (yearFilter) params.year = Number(yearFilter);
        if (monthFilter) params.month = Number(monthFilter);
      } else {
        params.year = calYear;
      }
      const res = await workplanApi.list(params);
      const raw = res.data as unknown;
      const events = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data: unknown }).data) ? (raw as { data: WorkplanEvent[] }).data : []);
      setList(events);
    } catch {
      setError("Failed to load workplan events.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, yearFilter, monthFilter, viewMode, calYear, calMonth]);

  const loadList = useCallback(() => {
    stableLoadList();
  }, [stableLoadList]);

  const handleDeleteEvent = useCallback(async (id: number) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this event? This cannot be undone.")) return;
    try {
      await workplanApi.delete(id);
      loadList();
    } catch {
      setError("Failed to delete event.");
    }
  }, [loadList]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const exportPdfRef = useRef<HTMLDivElement>(null);

  const exportListPdf = useCallback(async () => {
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Master Workplan – List View", 14, 15);
    doc.setFontSize(10);
    const body = list.map((ev) => [
      ev.title,
      TYPE_LABELS[ev.type] ?? ev.type,
      ev.meeting_type?.name ?? "",
      formatDate(ev.date) + (ev.end_date && ev.end_date !== ev.date ? ` – ${formatDate(ev.end_date)}` : ""),
      ev.responsible_users?.length ? ev.responsible_users.map((u) => u.name).join(", ") : ev.responsible ?? "",
    ]);
    autoTable(doc, {
      head: [["Title", "Type", "Kind of meeting", "Date", "Responsible"]],
      body,
      startY: 22,
      margin: { left: 14 },
    });
    doc.save(`workplan-list-${yearFilter}-${Date.now()}.pdf`);
    setExportPdfOpen(false);
  }, [list, yearFilter]);

  const exportCalendarPdf = useCallback(async () => {
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF({ orientation: "landscape" });
    const monthLabel = `${MONTHS[calMonth]} ${calYear}`;
    doc.setFontSize(14);
    doc.text(`Master Workplan – Calendar (${monthLabel})`, 14, 15);
    doc.setFontSize(10);
    const monthStart = new Date(calYear, calMonth, 1);
    const monthEnd = new Date(calYear, calMonth + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const body: (string | number)[][] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(calYear, calMonth, d);
      const dayStr = ymd(dayDate);
      const dayEvents = list.filter((ev) => {
        const start = parseDate(ev.date);
        const end = ev.end_date ? parseDate(ev.end_date) : start;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        const startStr = ymd(start);
        const endStr = ymd(end);
        return dayStr >= startStr && dayStr <= endStr;
      });
      const titles = dayEvents.map((e) => e.title).join("; ");
      body.push([d, titles || "—"]);
    }
    autoTable(doc, {
      head: [["Day", "Events"]],
      body,
      startY: 22,
      margin: { left: 14 },
    });
    doc.save(`workplan-calendar-${monthLabel.replace(/\s/g, "-")}-${Date.now()}.pdf`);
    setExportPdfOpen(false);
  }, [list, calYear, calMonth]);

  const exportGanttPdf = useCallback(async () => {
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Master Workplan – Gantt View", 14, 15);
    doc.setFontSize(10);
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const body = sorted.map((ev) => [
      ev.title,
      TYPE_LABELS[ev.type] ?? ev.type,
      formatDate(ev.date),
      ev.end_date && ev.end_date !== ev.date ? formatDate(ev.end_date) : "—",
    ]);
    autoTable(doc, {
      head: [["Event", "Type", "Start", "End"]],
      body,
      startY: 22,
      margin: { left: 14 },
    });
    doc.save(`workplan-gantt-${calYear}-${Date.now()}.pdf`);
    setExportPdfOpen(false);
  }, [list, calYear]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Master Workplan</h1>
          <p className="page-subtitle">
            Meetings, travel, milestones and deadlines across the year.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={exportPdfRef}>
            <button
              type="button"
              onClick={() => setExportPdfOpen((o) => !o)}
              className="btn-secondary py-2 px-3 text-sm flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Export PDF
            </button>
            {exportPdfOpen && (
              <>
                <div className="absolute top-full left-0 mt-1 z-20 rounded-lg border border-neutral-200 bg-white shadow-lg py-1 min-w-[160px]">
                  <button
                    type="button"
                    onClick={exportListPdf}
                    className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">view_list</span>
                    List view
                  </button>
                  <button
                    type="button"
                    onClick={exportCalendarPdf}
                    className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                    Calendar view
                  </button>
                  <button
                    type="button"
                    onClick={exportGanttPdf}
                    className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                    Gantt view
                  </button>
                </div>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setExportPdfOpen(false)}
                />
              </>
            )}
          </div>
          <Link href="/workplan/meeting-types" className="btn-secondary py-2 px-3 text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">category</span>
            Meeting types
          </Link>
          <Link href="/workplan/new" className="btn-primary py-2 px-3 text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add event
          </Link>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
        {(["list", "calendar", "gantt"] as ViewMode[]).map((mode) => {
          const icons: Record<ViewMode, string> = { list: "view_list", calendar: "calendar_month", gantt: "bar_chart" };
          const labels: Record<ViewMode, string> = { list: "List", calendar: "Calendar", gantt: "Gantt" };
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                viewMode === mode
                  ? "bg-white shadow text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{icons[mode]}</span>
              {labels[mode]}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* List filters — only show in list view */}
      {viewMode === "list" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Event type</span>
          <select className="form-input max-w-[160px] py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Year</span>
          <select className="form-input max-w-[100px] py-2 text-sm" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All</option>
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Month</span>
          <select className="form-input max-w-[140px] py-2 text-sm" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All</option>
            {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="card p-5">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : viewMode === "calendar" ? (
          <CalendarView
            events={list}
            year={calYear}
            month={calMonth}
            onPrev={prevMonth}
            onNext={nextMonth}
            onOpenEvent={handleOpenEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        ) : viewMode === "gantt" ? (
          <GanttView
            events={list}
            year={calYear}
            month={calMonth}
            onPrev={prevMonth}
            onNext={nextMonth}
            onOpenEvent={handleOpenEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        ) : (
          /* ── List view ── */
          list.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-4xl text-neutral-200">calendar_month</span>
              <p className="mt-3 text-sm text-neutral-500">No workplan events found.</p>
              <Link href="/workplan/new" className="text-sm font-semibold text-primary hover:underline mt-2 inline-block">
                Add your first event
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto -m-5">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Event type</th>
                    <th>Kind of meeting</th>
                    <th>Date</th>
                    <th>Responsible</th>
                    <th>Docs</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((ev) => {
                    const c = TYPE_COLOR[ev.type] ?? TYPE_COLOR.meeting;
                    return (
                      <tr
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer hover:bg-neutral-50"
                        onDoubleClick={() => handleOpenEvent(ev.id)}
                        title="Double-click to open"
                      >
                        <td className="font-medium text-neutral-900">{ev.title}</td>
                        <td>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text} ${c.border}`}>
                            {TYPE_LABELS[ev.type] ?? ev.type}
                          </span>
                        </td>
                        <td className="text-sm text-neutral-600">
                          {ev.meeting_type?.name ?? (ev.type === "meeting" ? "—" : "")}
                        </td>
                        <td className="text-sm text-neutral-600 whitespace-nowrap">
                          {formatDate(ev.date)}
                          {ev.end_date && ev.end_date !== ev.date ? ` – ${formatDate(ev.end_date)}` : ""}
                        </td>
                        <td className="text-sm text-neutral-600">
                          {ev.responsible_users?.length
                            ? ev.responsible_users.map((u) => u.name).join(", ")
                            : ev.responsible ?? "—"}
                        </td>
                        <td className="text-sm text-neutral-600">
                          {ev.attachments?.length ?? 0}
                        </td>
                        <td className="text-right">
                          <span className="text-xs text-neutral-400 mr-2">Double-click to open</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                            className="text-neutral-400 hover:text-red-600 p-1 rounded inline-flex"
                            title="Delete event"
                            aria-label="Delete"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Summary bar for calendar/gantt */}
      {(viewMode === "calendar" || viewMode === "gantt") && !loading && list.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
          <span className="font-semibold">{list.length} events loaded for {calYear}</span>
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const count = list.filter((e) => e.type === type).length;
            if (!count) return null;
            const c = TYPE_COLOR[type];
            return (
              <span key={type} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${c.bg} ${c.text} ${c.border}`}>
                {label}: {count}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
