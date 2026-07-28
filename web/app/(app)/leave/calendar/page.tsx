"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { leaveApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), label: from.toLocaleString("en-GB", { month: "long", year: "numeric" }) };
}

export default function LeaveTeamCalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const bounds = useMemo(() => monthBounds(cursor), [cursor]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["leave-team-calendar", bounds.from, bounds.to],
    queryFn: () => leaveApi.teamCalendar({ from: bounds.from, to: bounds.to }).then((r) => r.data),
  });

  const rows = (data?.data ?? []) as Array<{
    id: number;
    leave_type?: string;
    start_date?: string;
    end_date?: string;
    days_requested?: number | string;
    requester?: { name?: string; job_title?: string | null };
  }>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/leave" className="hover:text-neutral-700">Leave</Link>
            <span>/</span>
            <span className="text-neutral-700">Team Calendar</span>
          </div>
          <h1 className="page-title">Team Leave Calendar</h1>
          <p className="page-subtitle">Approved leave overlapping {bounds.label}.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setCursor(new Date())}
          >
            This month
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading && <p className="p-6 text-sm text-neutral-400">Loading calendar…</p>}
        {isError && <p className="p-6 text-sm text-red-600">Failed to load team calendar (requires HOD/HR access).</p>}
        {!isLoading && !isError && rows.length === 0 && (
          <p className="p-6 text-sm text-neutral-400">No approved leave in this period.</p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3">
                    <Link href={`/leave/${row.id}`} className="font-medium text-primary hover:underline">
                      {row.requester?.name ?? "—"}
                    </Link>
                    {row.requester?.job_title && (
                      <p className="text-xs text-neutral-400">{row.requester.job_title}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{row.leave_type ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.start_date ? formatDateShort(row.start_date) : "—"}
                    {" → "}
                    {row.end_date ? formatDateShort(row.end_date) : "—"}
                  </td>
                  <td className="px-4 py-3">{row.days_requested ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
