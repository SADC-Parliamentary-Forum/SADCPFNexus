"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi } from "@/lib/api";

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), label: from.toLocaleString("en-GB", { month: "long", year: "numeric" }), year: from.getFullYear(), month: from.getMonth() };
}

export default function AssignmentsCalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [scope, setScope] = useState<"mine" | "team" | "register">("mine");
  const bounds = useMemo(() => monthBounds(cursor), [cursor]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments-calendar", bounds.from, bounds.to, scope],
    queryFn: () => assignmentsApi.calendar({ from: bounds.from, to: bounds.to, scope }).then((r) => r.data),
  });

  const items = (data?.data ?? []) as Array<{
    id: number;
    title?: string;
    status?: string;
    priority?: string;
    due_date?: string;
    assigned_to?: string | null;
  }>;

  const byDay = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const day = item.due_date?.slice(0, 10);
      if (!day) continue;
      const list = map.get(day) ?? [];
      list.push(item);
      map.set(day, list);
    }
    return map;
  }, [items]);

  const firstDow = new Date(bounds.year, bounds.month, 1).getDay();
  const daysInMonth = new Date(bounds.year, bounds.month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `d-${d}` });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Assignment Calendar</h1>
          <p className="page-subtitle">In-app due-date calendar for {bounds.label}. External Google sync remains deferred.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="form-input w-36" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="mine">Mine</option>
            <option value="team">Team</option>
            <option value="register">Register</option>
          </select>
          <button type="button" className="btn-secondary text-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Previous</button>
          <button type="button" className="btn-secondary text-sm" onClick={() => setCursor(new Date())}>This month</button>
          <button type="button" className="btn-secondary text-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading calendar…</p>}
      {isError && <p className="text-sm text-red-700">Failed to load assignment calendar.</p>}

      <div className="card grid grid-cols-7 gap-px overflow-hidden bg-[var(--border)] p-px">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-neutral-50 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{d}</div>
        ))}
        {cells.map((cell) => {
          if (cell.day == null) return <div key={cell.key} className="min-h-24 bg-white" />;
          const iso = `${bounds.year}-${String(bounds.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
          const dayItems = byDay.get(iso) ?? [];
          return (
            <div key={cell.key} className="min-h-24 bg-white p-2">
              <div className="mb-1 text-xs font-semibold text-neutral-700">{cell.day}</div>
              <ul className="space-y-1">
                {dayItems.slice(0, 3).map((item) => (
                  <li key={item.id} className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                    {item.title}
                  </li>
                ))}
                {dayItems.length > 3 && <li className="text-[11px] text-neutral-400">+{dayItems.length - 3} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
