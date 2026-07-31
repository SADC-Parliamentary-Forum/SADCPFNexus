"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeReportingCalendar } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export default function MandeCalendarPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "calendar", month],
    queryFn: () => mandeApi.getCalendar({ month }).then((r) => r.data.data as MeReportingCalendar),
    staleTime: 15_000,
  });

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const overdueInMonth = useMemo(() => {
    if (!data) return 0;
    const now = Date.now();
    return data.items.filter(
      (i) =>
        new Date(i.report_due_at).getTime() < now &&
        (i.review_status === "not_submitted" || i.review_status === "returned")
    ).length;
  }, [data]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Reporting Calendar"
        subtitle="Activity reports due by month, with overdue highlights."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Reporting Calendar" }]} />}
      />
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => shiftMonth(-1)}>Prev</button>
          <input
            type="month"
            className="input text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button type="button" className="btn-secondary text-sm" onClick={() => shiftMonth(1)}>Next</button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load calendar.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="card px-4 py-4">
          <p className="text-2xl font-bold">{data?.items.length ?? "—"}</p>
          <p className="text-[11px] text-neutral-500">Due this month</p>
        </div>
        <div className="card px-4 py-4">
          <p className="text-2xl font-bold text-red-600">{data?.overdue_count ?? "—"}</p>
          <p className="text-[11px] text-neutral-500">
            Overdue overall {overdueInMonth > 0 ? `(${overdueInMonth} in view)` : ""}
          </p>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
      ) : data.items.length === 0 ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">No due dates in this month.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Due</th>
                <th>Reference</th>
                <th>Title</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const overdue =
                  new Date(item.report_due_at).getTime() < Date.now() &&
                  (item.review_status === "not_submitted" || item.review_status === "returned");
                return (
                  <tr key={item.id} className={overdue ? "bg-red-50/60" : undefined}>
                    <td className="text-xs whitespace-nowrap">{formatDateShort(item.report_due_at)}</td>
                    <td className="font-mono text-xs">
                      <Link href={`/mande/activity-reports/${item.id}`} className="text-primary hover:underline">
                        {item.reference_number}
                      </Link>
                    </td>
                    <td className="text-sm">{item.activity_title}</td>
                    <td className="text-xs">{item.review_status}{overdue ? " · overdue" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
