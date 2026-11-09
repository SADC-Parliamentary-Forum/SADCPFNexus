"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, type Timesheet } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Helpers ───────────────────────────────────────────────────────────────

function weekLabel(weekStart: string, weekEnd: string, localeTag = "en-GB"): string {
  const s = new Date(weekStart + "T00:00:00");
  const e = new Date(weekEnd   + "T00:00:00");
  return `${s.toLocaleDateString(localeTag, { day: "numeric", month: "short" })} – ${e.toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" })}`;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:     { label: "hr.timesheets.status.draft", cls: "badge-muted",    icon: "edit_note"    },
  submitted: { label: "hr.timesheets.history.pending", cls: "badge-warning",  icon: "pending"      },
  approved:  { label: "timesheet.import.origin.approved", cls: "badge-success",  icon: "check_circle" },
  rejected:  { label: "hr.timesheets.status.rejected", cls: "badge-danger",   icon: "cancel"       },
  imported:  { label: "timesheet.import.origin.imported", cls: "badge-muted", icon: "history" },
  verified_historical: { label: "timesheet.import.origin.verified", cls: "badge-success", icon: "verified" },
  returned: { label: "hr.timesheets.status.returned", cls: "badge-warning", icon: "undo" },
};

const FILTER_TABS = [
  { value: "",          label: "timesheet.import.filterAll" },
  { value: "draft",     label: "hr.timesheets.status.draft" },
  { value: "submitted", label: "hr.timesheets.history.pending" },
  { value: "approved",  label: "timesheet.import.origin.approved" },
  { value: "imported",  label: "hr.timesheets.history.imported" },
  { value: "verified_historical", label: "timesheet.import.origin.verified" },
  { value: "rejected",  label: "hr.timesheets.status.rejected" },
];

const MONTH_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TimesheetHistoryPage() {
  const { t, localeTag } = useI18n();
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
      setError(t("hr.timesheets.history.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, monthFilter, yearFilter, page]);

  useEffect(() => { setPage(1); }, [statusFilter, monthFilter, yearFilter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="hr.timesheets.history.title"
        subtitle="hr.timesheets.history.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "nav.timesheets", href: "/hr/timesheets" },
              { label: "hr.timesheets.history.crumb" },
            ]}
          />
        }
        actions={
          <Link href="/hr/timesheets" className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("hr.timesheets.history.currentWeek")}
          </Link>
        }
      />

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
              {t(tab.label)}
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
            {MONTH_NUMBERS.map((i) => (
              <option key={i} value={i}>
                {i === 0 ? t("hr.timesheets.history.allMonths") : new Date(2000, i - 1, 1).toLocaleString(localeTag, { month: "long" })}
              </option>
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
        <p className="text-xs text-neutral-400">{t(total === 1 ? "hr.timesheets.history.foundOne" : "hr.timesheets.history.foundMany", { count: total })}</p>
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
        <EmptyState
          icon="schedule"
          title={t("hr.timesheets.history.emptyTitle")}
          description={t("hr.timesheets.history.emptyHint")}
          action={<Link href="/hr/timesheets" className="btn-primary">{t("hr.timesheets.history.goToCurrentWeek")}</Link>}
        />
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
                    <p className="text-xs text-neutral-400 mb-0.5">{t("hr.timesheets.history.weekOf")}</p>
                    <p className="text-sm font-semibold text-neutral-800 leading-tight">
                      {weekLabel(ts.week_start, ts.week_end, localeTag)}
                    </p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0", sc.cls)}>
                    <span className="material-symbols-outlined text-[12px]">{sc.icon}</span>
                    {t(sc.label)}
                  </span>
                </div>

                {/* Hours bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">{t("hr.timesheets.history.hoursLogged")}</span>
                    <span className={cn("font-semibold", totalH >= 40 ? "text-green-600" : totalH > 0 ? "text-amber-600" : "text-neutral-400")}>
                      {t("hr.timesheets.history.hoursOf", { hours: totalH.toFixed(1), expected: 40 })}
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
                      {t(entryCount === 1 ? "hr.timesheets.history.entryOne" : "hr.timesheets.history.entryMany", { count: entryCount })}
                    </span>
                  )}
                  {otH > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="material-symbols-outlined text-[14px]">timer</span>
                      {t("hr.timesheets.overtimeBadge", { hours: otH.toFixed(1) })}
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
                  {t("hr.timesheets.history.viewDetails")}
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
            aria-label={t("common.previous")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="text-sm text-neutral-600">
            {t("common.pageOf", { page, total: lastPage })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            aria-label={t("common.next")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}
