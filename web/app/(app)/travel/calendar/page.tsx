"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { travelApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type CalEvent = {
  id: number;
  type: string;
  date: string;
  title: string;
  reference: string;
  traveller?: string;
  destination?: string;
  status: string;
};

const TYPE_LABEL: Record<string, string> = {
  departure: "Departure",
  return: "Return",
  away: "Away",
  pending: "Pending",
  approved: "Approved",
};

const TYPE_CLASS: Record<string, string> = {
  departure: "bg-emerald-50 text-emerald-800",
  return: "bg-sky-50 text-sky-800",
  away: "bg-amber-50 text-amber-800",
  pending: "bg-orange-50 text-orange-800",
  approved: "bg-primary/10 text-primary",
};

const TYPE_RANK: Record<string, number> = {
  departure: 4,
  return: 3,
  away: 2,
  pending: 1,
  approved: 0,
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
};

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: localIso(from),
    to: localIso(to),
    label: from.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    year: from.getFullYear(),
    month: from.getMonth(),
  };
}

function eventDay(value: string | undefined): string {
  return (value ?? "").slice(0, 10);
}

function pickDayEvent(events: CalEvent[]): CalEvent {
  return [...events].sort((a, b) => (TYPE_RANK[b.type] ?? 0) - (TYPE_RANK[a.type] ?? 0))[0];
}

function firstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

export default function TravelCalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"grid" | "list">("grid");
  const bounds = useMemo(() => monthBounds(cursor), [cursor]);
  const todayIso = localIso(new Date());

  const { data: events = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["travel", "calendar", bounds.from, bounds.to],
    queryFn: () => travelApi.calendar({ from: bounds.from, to: bounds.to }).then((r) => r.data.data as CalEvent[]),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const date = eventDay(ev.date);
      if (!date) continue;
      const list = map.get(date) ?? [];
      list.push(ev);
      map.set(date, list);
    }
    return map;
  }, [events]);

  const listDays = useMemo(
    () => Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [byDate],
  );

  const firstDow = new Date(bounds.year, bounds.month, 1).getDay();
  const daysInMonth = new Date(bounds.year, bounds.month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `d-${d}` });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Travel calendar"
        subtitle={`Departures, returns, and travellers away in ${bounds.label}.`}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Travel", href: "/travel" }, { label: "Calendar" }]} />
        }
        actions={
          <>
            <button
              type="button"
              className={view === "grid" ? "btn-primary text-sm" : "btn-secondary text-sm"}
              onClick={() => setView("grid")}
            >
              Month grid
            </button>
            <button
              type="button"
              className={view === "list" ? "btn-primary text-sm" : "btn-secondary text-sm"}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              Previous
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setCursor(new Date())}>
              This month
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              Next
            </button>
          </>
        }
      />

      <p className="text-sm font-medium text-neutral-700">{bounds.label}</p>

      {isLoading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          <span className="flex-1">Failed to load travel calendar.</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {view === "grid" && !isLoading && !isError ? (
        <div data-testid="travel-calendar" className="space-y-3">
          <div className="flex flex-wrap gap-2 px-1 text-[11px] text-neutral-500">
            {(["departure", "return", "away", "pending"] as const).map((type) => (
              <span
                key={type}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${TYPE_CLASS[type]}`}
              >
                {TYPE_LABEL[type]}
              </span>
            ))}
          </div>
          <div className="card grid grid-cols-7 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 p-px">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="bg-neutral-50 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                {d}
              </div>
            ))}
            {cells.map((cell) => {
              if (cell.day == null) return <div key={cell.key} className="min-h-24 bg-white" />;
              const iso = `${bounds.year}-${String(bounds.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
              const dayEvents = byDate.get(iso) ?? [];
              const unique = new Map<number, CalEvent[]>();
              for (const ev of dayEvents) {
                const list = unique.get(ev.id) ?? [];
                list.push(ev);
                unique.set(ev.id, list);
              }
              const chips = Array.from(unique.values()).map(pickDayEvent);
              const isToday = iso === todayIso;
              return (
                <div key={cell.key} className={`min-h-24 bg-white p-2 ${isToday ? "ring-1 ring-inset ring-primary/40" : ""}`}>
                  <div className={`mb-1 text-xs font-semibold ${isToday ? "text-primary" : "text-neutral-700"}`}>
                    {cell.day}
                  </div>
                  <ul className="space-y-1">
                    {chips.slice(0, 3).map((ev) => (
                      <li key={`${ev.id}-${iso}`}>
                        <Link
                          href={`/travel/${ev.id}`}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] hover:opacity-90 ${TYPE_CLASS[ev.type] ?? "bg-neutral-100 text-neutral-700"}`}
                          title={`${ev.reference} · ${TYPE_LABEL[ev.type] ?? ev.type}${ev.traveller ? ` · ${ev.traveller}` : ""}`}
                        >
                          {firstName(ev.traveller) || ev.reference} · {TYPE_LABEL[ev.type] ?? ev.type}
                        </Link>
                      </li>
                    ))}
                    {chips.length > 3 ? (
                      <li className="text-[11px] text-neutral-400">+{chips.length - 3}</li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "list" && !isLoading && !isError ? (
        <div data-testid="travel-calendar" className="space-y-4">
          {listDays.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="calendar_month"
                title="No travel in this month"
                description="Try another month, or open the travel register."
                action={
                  <Link href="/travel" className="btn-secondary text-sm">
                    Travel hub
                  </Link>
                }
              />
            </div>
          ) : (
            listDays.map(([date, items]) => (
              <div key={date} className="card p-4">
                <h2 className="mb-3 text-sm font-semibold text-neutral-800">{formatDateShort(date)}</h2>
                <ul className="space-y-2">
                  {items.map((ev, idx) => (
                    <li key={`${ev.id}-${ev.type}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <span
                          className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${TYPE_CLASS[ev.type] ?? "bg-neutral-100 text-neutral-600"}`}
                        >
                          {TYPE_LABEL[ev.type] ?? ev.type}
                        </span>
                        <Link href={`/travel/${ev.id}`} className="font-medium text-primary hover:underline">
                          {ev.reference}
                        </Link>
                        <span className="text-neutral-500"> — {ev.title}</span>
                        {ev.traveller ? (
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {ev.traveller}
                            {ev.destination ? ` · ${ev.destination}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-xs text-neutral-500">
                        {STATUS_LABEL[ev.status] ?? ev.status.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
