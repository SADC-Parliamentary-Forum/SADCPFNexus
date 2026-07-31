"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { travelApi } from "@/lib/api";

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

export default function TravelCalendarPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const range = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() + monthOffset);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      label: start.toLocaleString(undefined, { month: "long", year: "numeric" }),
    };
  }, [monthOffset]);

  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ["travel", "calendar", range.from, range.to],
    queryFn: () => travelApi.calendar({ from: range.from, to: range.to }).then((r) => r.data.data as CalEvent[]),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ModulePageHeader
        title="Travel Calendar"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Travel Calendar" }]} />}
      />
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => setMonthOffset((v) => v - 1)}>Prev</button>
          <span className="text-sm font-medium min-w-[140px] text-center">{range.label}</span>
          <button type="button" className="btn-secondary" onClick={() => setMonthOffset((v) => v + 1)}>Next</button>
          <Link href="/travel" className="btn-secondary">Dashboard</Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-neutral-400">Loading calendar…</p>}
      {isError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">Failed to load calendar.</div>}

      {!isLoading && byDate.length === 0 && (
        <div className="card p-8 text-center text-sm text-neutral-400">No travel events in this month.</div>
      )}

      <div className="space-y-4" data-testid="travel-calendar">
        {byDate.map(([date, items]) => (
          <div key={date} className="card p-4">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">{date}</h2>
            <ul className="space-y-2">
              {items.map((ev, idx) => (
                <li key={`${ev.id}-${ev.type}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <span className="inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 mr-2">{ev.type}</span>
                    <Link href={`/travel/${ev.id}`} className="font-medium text-primary hover:underline">{ev.reference}</Link>
                    <span className="text-neutral-500"> — {ev.title}</span>
                    {ev.traveller && <p className="text-xs text-neutral-400 mt-0.5">{ev.traveller} · {ev.destination}</p>}
                  </div>
                  <span className="text-xs text-neutral-400">{ev.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
