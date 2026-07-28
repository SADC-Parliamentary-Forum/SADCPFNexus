"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

type Schedule = {
  id: number;
  name: string;
  code?: string;
  is_default: boolean;
  working_days: number[];
  start_time: string;
  end_time: string;
  lunch_start?: string;
  lunch_end?: string;
  ordinary_hours_per_day: number;
};

export default function WorkSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [expected, setExpected] = useState<{ expected_hours: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: Schedule[] }>("/hr/timesheets/schedules");
      setSchedules(res.data.data ?? []);
      const monday = mondayOf(new Date());
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const exp = await api.get<{ data: { expected_hours: number } }>(
        `/hr/timesheets/expected-hours?week_start=${fmt(monday)}&week_end=${fmt(sunday)}`
      );
      setExpected(exp.data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load schedules");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Work Schedules</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Default Mon–Fri 08:00–17:00 with lunch 13:00–14:00 (8 ordinary hours). Configurable per employee.
          </p>
        </div>
        <Link href="/hr/timesheets" className="text-sm text-[var(--brand)] hover:underline">
          Timesheets
        </Link>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {expected && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-sm text-[var(--text-secondary)]">Expected hours this week</div>
          <div className="text-3xl font-semibold">{expected.expected_hours}</div>
        </div>
      )}

      <ul className="space-y-3">
        {schedules.map((s) => (
          <li key={s.id} className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {s.name} {s.is_default ? <span className="text-xs text-[var(--text-secondary)]">(default)</span> : null}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">{s.ordinary_hours_per_day}h / day</div>
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
              {s.lunch_start ? ` · lunch ${s.lunch_start.slice(0, 5)}–${s.lunch_end?.slice(0, 5)}` : ""}
            </div>
          </li>
        ))}
        {schedules.length === 0 && (
          <li className="text-sm text-[var(--text-secondary)]">
            No schedules yet — the API will seed the standard office schedule on first expected-hours request.
          </li>
        )}
      </ul>
    </div>
  );
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
