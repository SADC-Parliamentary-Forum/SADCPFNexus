"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { leaveApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return {
    from: iso(from),
    to: iso(to),
    label: from.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    year: from.getFullYear(),
    month: from.getMonth(),
  };
}

export default function LeaveTeamCalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"grid" | "list">("grid");
  const bounds = useMemo(() => monthBounds(cursor), [cursor]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leave-team-calendar", bounds.from, bounds.to],
    queryFn: () => leaveApi.teamCalendar({ from: bounds.from, to: bounds.to }).then((r) => r.data),
  });

  const rows = (data?.data ?? []) as Array<{
    id: number;
    leave_type?: string;
    display_label?: string;
    is_masked?: boolean;
    color_key?: string;
    start_date?: string;
    end_date?: string;
    days_requested?: number | string;
    requester?: { name?: string; job_title?: string | null };
  }>;
  const medicalMasked = Boolean(
    (data as { privacy?: { medical_masked_for_viewer?: boolean } } | undefined)?.privacy
      ?.medical_masked_for_viewer,
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.start_date || !row.end_date) continue;
      const start = new Date(row.start_date.slice(0, 10) + "T00:00:00");
      const end = new Date(row.end_date.slice(0, 10) + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() !== bounds.month || d.getFullYear() !== bounds.year) continue;
        const key = d.toISOString().slice(0, 10);
        const list = map.get(key) ?? [];
        list.push(row);
        map.set(key, list);
      }
    }
    return map;
  }, [rows, bounds.month, bounds.year]);

  const firstDow = new Date(bounds.year, bounds.month, 1).getDay();
  const daysInMonth = new Date(bounds.year, bounds.month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `d-${d}` });

  const downloadRegister = async () => {
    const res = await leaveApi.registerExport({ from: bounds.from, to: bounds.to });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-register-${bounds.from}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Team Leave Calendar"
        subtitle={
          <>
            {medicalMasked ? "Medical leave types are masked for non-HR viewers. " : null}
            Approved leave overlapping {bounds.label}.
          </>
        }
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Leave", href: "/leave" }, { label: "Team calendar" }]} />
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
            <button type="button" className="btn-secondary text-sm" onClick={() => void downloadRegister()}>
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
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

      {isLoading && (
        <div className="card space-y-3 p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          <span className="flex-1">Failed to load team calendar (requires HOD / HR access).</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      {view === "grid" && !isLoading && !isError && (
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
            const dayRows = byDay.get(iso) ?? [];
            return (
              <div key={cell.key} className="min-h-24 bg-white p-2">
                <div className="mb-1 text-xs font-semibold text-neutral-700">{cell.day}</div>
                <ul className="space-y-1">
                  {dayRows.slice(0, 3).map((row) => (
                    <li
                      key={`${row.id}-${iso}`}
                      className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
                    >
                      {row.requester?.name?.split(" ")[0]} · {row.display_label ?? row.leave_type}
                      {row.is_masked ? " — private" : ""}
                    </li>
                  ))}
                  {dayRows.length > 3 && (
                    <li className="text-[11px] text-neutral-400">+{dayRows.length - 3}</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && !isLoading && !isError && (
        <div className="card overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon="calendar_month"
              title="No approved leave in this period"
              description="Try another month or check the leave register."
              action={
                <Link href="/leave" className="btn-secondary text-sm">
                  Leave register
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="font-medium text-neutral-900">{row.requester?.name ?? "—"}</div>
                        <div className="text-xs text-neutral-500">{row.requester?.job_title}</div>
                      </td>
                      <td className="capitalize text-neutral-700">
                        {row.display_label ?? row.leave_type}
                        {row.is_masked ? " — private" : ""}
                      </td>
                      <td className="whitespace-nowrap text-xs text-neutral-600">
                        {formatDateShort(row.start_date)} – {formatDateShort(row.end_date)}
                      </td>
                      <td>{row.days_requested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
