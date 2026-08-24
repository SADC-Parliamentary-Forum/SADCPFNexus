"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { hrApi } from "@/lib/api";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayOf(d: Date): Date {
  const start = new Date(d);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export default function TimesheetCapacityPage() {
  const defaultStart = mondayOf(new Date());
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultStart.getDate() + 4);

  const [weekStart, setWeekStart] = useState(isoDate(defaultStart));
  const [weekEnd, setWeekEnd] = useState(isoDate(defaultEnd));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["timesheets-capacity", weekStart, weekEnd],
    queryFn: () =>
      hrApi.capacityAnalytics({ week_start: weekStart, week_end: weekEnd }).then((r) => r.data.data),
  });

  const people = (data?.people ?? []) as Array<Record<string, unknown>>;
  const csv = useMemo(() => {
    const header = "name,recorded_hours,expected_hours,utilization_pct";
    const rows = people.map((row) =>
      [row.name, row.recorded_hours, row.expected_hours, row.utilization_pct].map((v) => `"${String(v ?? "")}"`).join(","),
    );
    return [header, ...rows].join("\n");
  }, [people]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Timesheet capacity"
        subtitle="Recorded hours versus expected hours for a selected week. Not a performance score and not invented overtime rates."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Timesheets", href: "/hr/timesheets" }, { label: "Capacity" }]} />}
      />
      <form
        className="card flex flex-wrap items-end gap-3 p-4"
        data-testid="timesheet-capacity-week-picker"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="text-sm">
          Week start
          <input className="form-input mt-1" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        </label>
        <label className="text-sm">
          Week end
          <input className="form-input mt-1" type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn-secondary text-sm"
          data-testid="timesheet-capacity-csv"
          onClick={() => {
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `timesheet-capacity-${weekStart}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download recorded/expected CSV
        </button>
      </form>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-700">Failed to load capacity analytics.</p>}
      <p className="text-sm text-neutral-600" data-testid="timesheet-capacity-disclaimer">
        Overtime rates are not calculated here. Biometric capture is not used.
      </p>
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="p-2">Person</th>
              <th className="p-2">Recorded</th>
              <th className="p-2">Expected</th>
              <th className="p-2">Util %</th>
            </tr>
          </thead>
          <tbody>
            {people.map((row) => (
              <tr key={String(row.user_id)} className="border-t border-neutral-200">
                <td className="p-2">{String(row.name)}</td>
                <td className="p-2">{String(row.recorded_hours)}</td>
                <td className="p-2">{String(row.expected_hours)}</td>
                <td className="p-2">{String(row.utilization_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
