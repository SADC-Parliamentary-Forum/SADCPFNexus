"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, type Timesheet } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────

function weekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart + "T00:00:00");
  const e = new Date(weekEnd   + "T00:00:00");
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:     { label: "Draft",    cls: "badge-muted",    icon: "edit_note"    },
  submitted: { label: "Pending",  cls: "badge-warning",  icon: "pending"      },
  approved:  { label: "Approved", cls: "badge-success",  icon: "check_circle" },
  rejected:  { label: "Rejected", cls: "badge-danger",   icon: "cancel"       },
};

const FILTER_TABS = [
  { value: "",          label: "All"      },
  { value: "draft",     label: "Draft"    },
  { value: "submitted", label: "Pending"  },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
];

const MONTHS = [
  "All months","January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TimesheetHistoryPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [lastPage, setLastPage]     = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter]   = useState(0);
  const [yearFilter, setYearFilter]     = useState(CURRENT_YEAR);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { per_page: 12, page };
      if (statusFilter)     params.status = statusFilter;
      if (monthFilter > 0)  params.month  = monthFilter;
      if (yearFilter)       params.year   = yearFilter;

      const res  = await hrApi.listTimesheets(params);
      const data = res.data as any;
      setTimesheets(data.data ?? []);
      setTotal(data.total ?? 0);
      setLastPage(data.last_page ?? 1);
    } catch {
      setError("Failed to load timesheet history.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, monthFilter, yearFilter, page]);

  useEffect(() => { setPage(1); }, [statusFilter, monthFilter, yearFilter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center gap-1 text-sm text-neutral-500 mb-1">
            <Link href="/hr/timesheets" className="hover:text-primary transition-colors">Timesheets</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">History</span>
          </nav>
          <h1 className="page-title">Timesheet History</h1>
          <p className="page-subtitle mt-1">All your submitted and approved timesheets</p>
        </div>
        <Link href="/hr/timesheets" className="btn-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Current Week
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn("filter-tab", statusFilter === tab.value && "active")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Month */}
          <select
            className="form-input py-1.5 text-sm"
            value={monthFilter}
            onChange={(e) => setMonthFilter(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          {/* Year */}
          <select
            className="form-input py-1.5 text-sm"
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-neutral-400">{total} timesheet{total !== 1 ? "s" : ""} found</p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-5 space-y-3 animate-pulse">
              <div className="h-3 w-32 bg-neutral-100 rounded" />
              <div className="h-4 w-48 bg-neutral-100 rounded" />
              <div className="h-2 w-full rounded-full bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : timesheets.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100">
            <span className="material-symbols-outlined text-[28px] text-neutral-400">schedule</span>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700">No timesheets found</p>
            <p className="text-xs text-neutral-400 mt-1">Try adjusting the filters or submit your first timesheet</p>
          </div>
          <Link href="/hr/timesheets" className="btn-primary">Go to Current Week</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {timesheets.map((ts) => {
            const sc       = STATUS_CONFIG[ts.status] ?? STATUS_CONFIG.draft;
            const totalH   = ts.total_hours ?? 0;
            const otH      = ts.overtime_hours ?? 0;
            const pct      = Math.min(100, (totalH / 40) * 100);
            const entryCount = ts.entries?.length ?? 0;

            return (
              <Link
                key={ts.id}
                href={`/hr/timesheets/${ts.id}`}
                className="card flex flex-col gap-4 p-5 hover:shadow-md transition-shadow group"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-neutral-400 mb-0.5">Week of</p>
                    <p className="text-sm font-semibold text-neutral-800 leading-tight">
                      {weekLabel(ts.week_start, ts.week_end)}
                    </p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0", sc.cls)}>
                    <span className="material-symbols-outlined text-[12px]">{sc.icon}</span>
                    {sc.label}
                  </span>
                </div>

                {/* Hours bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Hours logged</span>
                    <span className={cn("font-semibold", totalH >= 40 ? "text-green-600" : totalH > 0 ? "text-amber-600" : "text-neutral-400")}>
                      {totalH.toFixed(1)}h / 40h
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={cn("h-full rounded-full transition-all", totalH >= 40 ? "bg-green-500" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-neutral-400">
                  {entryCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">list_alt</span>
                      {entryCount} entr{entryCount === 1 ? "y" : "ies"}
                    </span>
                  )}
                  {otH > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="material-symbols-outlined text-[14px]">timer</span>
                      +{otH.toFixed(1)}h OT
                    </span>
                  )}
                  {ts.submitted_at && (
                    <span className="flex items-center gap-1 ml-auto">
                      <span className="material-symbols-outlined text-[14px]">send</span>
                      {formatDateShort(ts.submitted_at)}
                    </span>
                  )}
                </div>

                {/* View link */}
                <div className="flex items-center justify-end text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  View details →
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="text-sm text-neutral-600">
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}
