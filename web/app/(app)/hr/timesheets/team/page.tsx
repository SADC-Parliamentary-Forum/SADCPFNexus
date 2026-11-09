"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { hrApi, type Timesheet } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Helpers ───────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(weekStart: string, localeTag = "en-GB"): string {
  const start = new Date(weekStart + "T00:00:00");
  const end   = addDays(start, 4);
  return `${start.toLocaleDateString(localeTag, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" })}`;
}

function avatarColor(name: string): string {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:     { label: "hr.timesheets.status.draft", cls: "badge-muted",    icon: "edit_note"    },
  submitted: { label: "hr.timesheets.team.pendingReview", cls: "badge-warning",  icon: "pending"      },
  approved:  { label: "hr.timesheets.team.approved", cls: "badge-success",  icon: "check_circle" },
  rejected:  { label: "hr.timesheets.status.rejected", cls: "badge-danger",   icon: "cancel"       },
};

const FILTER_TABS = [
  { label: "timesheet.import.filterAll", value: "" },
  { label: "hr.timesheets.team.pendingReview", value: "submitted" },
  { label: "hr.timesheets.team.approved", value: "approved" },
  { label: "hr.timesheets.status.rejected", value: "rejected" },
];

// ─── Export CSV ────────────────────────────────────────────────────────────

function exportWeekCSV(sheets: Timesheet[], weekLabel: string) {
  const headers = ["Employee", "Email", "Week", "Total Hours", "Overtime Hours", "Status", "Submitted At", "Approved At"];
  const csvRows = sheets.map((ts) => [
    ts.user?.name ?? "",
    ts.user?.email ?? "",
    weekLabel,
    (ts.total_hours ?? 0).toFixed(2),
    (ts.overtime_hours ?? 0).toFixed(2),
    ts.status,
    ts.submitted_at ? new Date(ts.submitted_at).toLocaleDateString("en-GB") : "",
    ts.approved_at  ? new Date(ts.approved_at).toLocaleDateString("en-GB")  : "",
  ]);

  const csv = [headers, ...csvRows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `timesheets-${weekLabel.replace(/[^a-z0-9]/gi, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ──────────────────────────────────────────────────────────────────

type ViewMode = "cards" | "grid";

// Derive the 5 weekday dates (Mon–Fri) for a given week start (Monday)
function getWeekDays(weekStart: string): Date[] {
  const base = new Date(weekStart + "T00:00:00");
  return [0, 1, 2, 3, 4].map((i) => addDays(base, i));
}

// Sum hours for a specific date from the entries array
function hoursOnDate(ts: Timesheet, date: Date): number {
  if (!ts.entries) return 0;
  const ymd = toYMD(date);
  return ts.entries.filter((e) => e.work_date === ymd).reduce((s, e) => s + Number(e.hours ?? 0), 0);
}

export default function TeamTimesheetsPage() {
  const { t, localeTag } = useI18n();
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const toast = useToast();
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [periods, setPeriods] = useState<Array<{ id: number; label: string; period_start: string; period_end: string; status: string }>>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [payrollStaging, setPayrollStaging] = useState(false);
  const [lastBatch, setLastBatch] = useState<{ id: number; batch_reference: string } | null>(null);
  const [exportHistory, setExportHistory] = useState<
    Array<{ id: number; batch_reference: string; status: string; exported_at?: string | null; lines_count?: number; period?: { id: number; label: string; status: string } }>
  >([]);

  const loadExportHistory = useCallback(async () => {
    try {
      const res = await hrApi.listPayrollExports();
      setExportHistory(res.data.data ?? []);
    } catch {
      /* optional panel */
    }
  }, []);

  // Initialise on client only to prevent SSR/client hydration mismatch
  useEffect(() => {
    setWeekStartDate(getWeekStart(new Date()));
  }, []);

  useEffect(() => {
    hrApi
      .listTimesheetPeriods()
      .then((res) => {
        const list = (res.data as { data?: typeof periods }).data ?? [];
        setPeriods(list);
        if (list.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(String(list[0].id));
        }
      })
      .catch(() => setPeriods([]));
    void loadExportHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load periods once on mount
  }, []);

  const weekStart = weekStartDate ? toYMD(weekStartDate) : null;

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (type === "success") toast.success(message);
    else toast.error(message);
  }, [toast]);

  const load = useCallback(async () => {
    if (!weekStart) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { week_start: weekStart, per_page: 50, with_entries: 1 };
      if (statusFilter) params.status = statusFilter;
      const res = await hrApi.listTeamTimesheets(params);
      const data = res.data as { data?: Timesheet[]; total?: number };
      setTimesheets(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
        setError(t("hr.timesheets.team.accessRestricted"));
      } else {
        setError(t("hr.timesheets.team.loadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, [weekStart, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (ts: Timesheet) => {
    setActionLoading((prev) => ({ ...prev, [ts.id]: true }));
    try {
      await hrApi.approveTimesheet(ts.id);
      showToast(t("hr.timesheets.team.approvedToast", { name: ts.user?.name ?? t("hr.timesheets.team.timesheet") }));
      await load();
    } catch (err) {
      toast.error(t("hr.timesheets.notApproved"), apiErrorMessage(err, t("hr.timesheets.approveFailed")));
    } finally {
      setActionLoading((prev) => ({ ...prev, [ts.id]: false }));
    }
  };

  const handleReject = async (ts: Timesheet) => {
    setActionLoading((prev) => ({ ...prev, [ts.id]: true }));
    try {
      await hrApi.rejectTimesheet(ts.id, "Returned for revision.");
      showToast(t("hr.timesheets.team.returnedToast", { name: ts.user?.name ?? t("hr.timesheets.team.timesheet") }));
      await load();
    } catch (err) {
      toast.error(t("hr.timesheets.notRejected"), apiErrorMessage(err, t("hr.timesheets.rejectFailed")));
    } finally {
      setActionLoading((prev) => ({ ...prev, [ts.id]: false }));
    }
  };

  const handleBulkApprove = async () => {
    const pending = timesheets.filter((x) => x.status === "submitted");
    if (pending.length === 0) return;
    setBulkLoading(true);
    let successCount = 0;
    let errorCount = 0;
    for (const ts of pending) {
      try {
        await hrApi.approveTimesheet(ts.id);
        successCount++;
      } catch {
        errorCount++;
      }
    }
    setBulkLoading(false);
    setShowBulkConfirm(false);
    await load();
    if (errorCount === 0) {
      showToast(t(successCount === 1 ? "hr.timesheets.team.bulkApprovedOne" : "hr.timesheets.team.bulkApprovedMany", { count: successCount }));
    } else {
      showToast(t("hr.timesheets.team.bulkPartial", { approved: successCount, failed: errorCount }), "error");
    }
  };

  const handleStagePayroll = async () => {
    if (!selectedPeriodId) {
      showToast(t("hr.timesheets.payroll.selectPeriodFirst"), "error");
      return;
    }
    setPayrollStaging(true);
    try {
      const res = await hrApi.stagePayrollExport({
        period_id: Number(selectedPeriodId),
        idempotency_key: `team-ui-${selectedPeriodId}-${Date.now()}`,
        mark_included: true,
        lock_period: true,
      });
      const batch = (res.data as { data?: { id: number; batch_reference: string } }).data;
      if (batch?.id) {
        setLastBatch({ id: batch.id, batch_reference: batch.batch_reference });
        showToast(t("hr.timesheets.team.payrollStaged", { reference: batch.batch_reference }));
        await load();
        await loadExportHistory();
      } else {
        showToast(t("hr.timesheets.team.payrollStagedPlain"));
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
          ?.message ||
        (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors?.period_id?.[0] ||
        t("hr.timesheets.payroll.stageFailed");
      showToast(msg, "error");
    } finally {
      setPayrollStaging(false);
    }
  };

  const handleDownloadPayroll = async (format: "csv" | "xlsx" = "csv") => {
    if (!lastBatch) return;
    try {
      const res = await hrApi.downloadPayrollExport(lastBatch.id, format);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${lastBatch.batch_reference}.${format === "xlsx" ? "xlsx" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t("hr.timesheets.team.downloaded", { format: format.toUpperCase(), reference: lastBatch.batch_reference }));
    } catch {
      showToast(t("hr.timesheets.team.downloadFailed"), "error");
    }
  };

  const pendingCount = timesheets.filter((x) => x.status === "submitted").length;
  const weekLabel    = weekStart ? formatWeekLabel(weekStart, localeTag) : "";
  const totalHours   = timesheets.reduce((s, x) => s + Number(x.total_hours ?? 0), 0);
  const overtimeHrs  = timesheets.reduce((s, x) => s + Number(x.overtime_hours ?? 0), 0);
  const weekDays     = weekStart ? getWeekDays(weekStart) : [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="hr.timesheets.team.title"
        subtitle="hr.timesheets.team.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "nav.timesheets", href: "/hr/timesheets" },
              { label: "hr.timesheets.team.crumb" },
            ]}
          />
        }
        meta={
          pendingCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
              {pendingCount}
            </span>
          ) : undefined
        }
        actions={
          <>
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-neutral-200 bg-white overflow-hidden dark:border-neutral-700 dark:bg-neutral-900">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              title={t("hr.timesheets.team.cardView")}
              className={cn(
                "flex h-8 w-8 items-center justify-center transition-colors",
                viewMode === "cards" ? "bg-primary text-white" : "text-neutral-500 hover:bg-neutral-100"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">view_module</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title={t("hr.timesheets.team.gridView")}
              className={cn(
                "flex h-8 w-8 items-center justify-center transition-colors",
                viewMode === "grid" ? "bg-primary text-white" : "text-neutral-500 hover:bg-neutral-100"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
            </button>
          </div>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">done_all</span>
              {t("hr.timesheets.team.bulkApproveCount", { count: pendingCount })}
            </button>
          )}
          {timesheets.length > 0 && (
            <button
              type="button"
              onClick={() => exportWeekCSV(timesheets, weekLabel)}
              className="btn-secondary py-2 px-3 text-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {t("hr.timesheets.team.exportWeek")}
            </button>
          )}
          <div
            className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            data-testid="team-payroll-stage"
          >
            <select
              className="form-input text-xs py-1.5 max-w-[180px] border-0 shadow-none"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              aria-label={t("hr.timesheets.team.periodForPayroll")}
              data-testid="team-payroll-period"
            >
              <option value="">{t("hr.timesheets.team.periodPlaceholder")}</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label || `${p.period_start} → ${p.period_end}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleStagePayroll()}
              disabled={payrollStaging || !selectedPeriodId}
              className="btn-primary py-1.5 px-2.5 text-xs flex items-center gap-1 disabled:opacity-50"
              data-testid="team-payroll-stage-btn"
              title={t("hr.timesheets.team.stageHint")}
            >
              <span className="material-symbols-outlined text-[14px]">
                {payrollStaging ? "progress_activity" : "account_balance_wallet"}
              </span>
              {payrollStaging ? t("hr.timesheets.payroll.staging") : t("hr.timesheets.team.stagePayroll")}
            </button>
            {lastBatch && (
              <>
                <button
                  type="button"
                  onClick={() => void handleDownloadPayroll("csv")}
                  className="btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1"
                  data-testid="team-payroll-download-csv"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  CSV {/* i18n-ignore */}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadPayroll("xlsx")}
                  className="btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1"
                  data-testid="team-payroll-download-xlsx"
                >
                  XLSX {/* i18n-ignore */}
                </button>
              </>
            )}
          </div>
          </>
        }
      />

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setWeekStartDate((d) => addDays(d ?? new Date(), -7))}
          disabled={!weekStartDate}
          aria-label={t("hr.timesheets.previousWeek")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <span className="text-sm font-medium text-neutral-700">
          {weekStart ? t("hr.timesheets.detail.weekOf", { week: weekLabel }) : t("common.loading")}
        </span>
        <button
          type="button"
          onClick={() => setWeekStartDate((d) => addDays(d ?? new Date(), 7))}
          disabled={!weekStartDate}
          aria-label={t("hr.timesheets.nextWeek")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
        <button
          type="button"
          onClick={() => setWeekStartDate(getWeekStart(new Date()))}
          className="ml-2 btn-secondary text-xs"
        >
          {t("hr.timesheets.team.currentWeek")}
        </button>
      </div>

      {exportHistory.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900" data-testid="team-payroll-export-history">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800">{t("hr.timesheets.team.exportHistory")}</h2>
            <button type="button" className="btn-secondary text-xs" onClick={() => void loadExportHistory()}>
              {t("hr.timesheets.team.refresh")}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-2 py-1.5">{t("hr.timesheets.payroll.batch")}</th>
                  <th className="px-2 py-1.5">{t("hr.timesheets.team.period")}</th>
                  <th className="px-2 py-1.5">{t("hr.timesheets.monthly.status")}</th>
                  <th className="px-2 py-1.5">{t("hr.timesheets.team.exported")}</th>
                  <th className="px-2 py-1.5">{t("hr.timesheets.team.lines")}</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {exportHistory.slice(0, 8).map((b) => (
                  <tr key={b.id} className="border-t border-neutral-100">
                    <td className="px-2 py-1.5 font-medium">{b.batch_reference}</td>
                    <td className="px-2 py-1.5">{b.period?.label ?? "—"} ({b.period?.status ?? "—"})</td>
                    <td className="px-2 py-1.5">{b.status}</td>
                    <td className="px-2 py-1.5">{b.exported_at ? new Date(b.exported_at).toLocaleString(localeTag) : "—"}</td>
                    <td className="px-2 py-1.5">{b.lines_count ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => {
                          setLastBatch({ id: b.id, batch_reference: b.batch_reference });
                          void handleDownloadPayroll("csv");
                        }}
                      >
                        CSV {/* i18n-ignore */}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
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
        {!loading && (
          <span className="ml-auto text-xs text-neutral-400">{t(total === 1 ? "hr.timesheets.team.countOne" : "hr.timesheets.team.countMany", { count: total })}</span>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Cards / Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-neutral-100" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-32 bg-neutral-100 rounded" />
                  <div className="h-2.5 w-24 bg-neutral-100 rounded" />
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-100" />
              <div className="h-8 w-full rounded-lg bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : timesheets.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="group"
            title={t("hr.timesheets.history.emptyTitle")}
            description={
              statusFilter
                ? t(`hr.timesheets.team.emptyFiltered.${statusFilter}`)
                : t("hr.timesheets.team.emptyHint")
            }
          />
        </div>
      ) : (
        <>
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {timesheets.map((ts) => {
                const name     = ts.user?.name ?? t("hr.timesheets.team.member");
                const sc       = STATUS_CONFIG[ts.status] ?? STATUS_CONFIG.draft;
                const totalH   = Number(ts.total_hours ?? 0);
                const isLoading = actionLoading[ts.id];

                return (
                  <div key={ts.id} className="card flex flex-col gap-4 p-5">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold flex-shrink-0", avatarColor(name))}>
                        {initials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{name}</p>
                        <p className="text-xs text-neutral-500 truncate">{ts.user?.email ?? ""}</p>
                      </div>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", sc.cls)}>
                        <span className="material-symbols-outlined text-[11px]">{sc.icon}</span>
                        {t(sc.label)}
                      </span>
                    </div>

                    {/* Week label */}
                    <p className="text-xs text-neutral-400">
                      {t("hr.timesheets.detail.weekOf", { week: formatWeekLabel(ts.week_start, localeTag) })}
                    </p>

                    {/* Hours bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500">{t("hr.timesheets.history.hoursLogged")}</span>
                        <span className={cn("text-xs font-semibold", totalH >= 40 ? "text-green-600" : totalH > 0 ? "text-amber-600" : "text-neutral-400")}>
                          {t("hr.timesheets.history.hoursOf", { hours: totalH.toFixed(1), expected: 40 })}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={cn("h-full rounded-full transition-all", totalH >= 40 ? "bg-green-500" : "bg-amber-400")}
                          style={{ width: `${Math.min(100, (totalH / 40) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        href={`/hr/timesheets/${ts.id}`}
                        className="btn-secondary flex-1 text-center text-xs"
                      >
                        {t("hr.timesheets.team.viewDetails")}
                      </Link>
                      {ts.status === "submitted" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(ts)}
                            disabled={isLoading}
                            className="btn-primary text-xs disabled:opacity-50 flex items-center gap-1"
                          >
                            {isLoading ? (
                              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            ) : (
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            )}
                            {t("common.approve")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(ts)}
                            disabled={isLoading}
                            title={t("hr.timesheets.team.returnForRevision")}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">undo</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── GRID VIEW ──────────────────────────────────────────────────── */
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-52">
                        {t("hr.timesheets.detail.employee")}
                      </th>
                      {weekDays.map((day) => (
                        <th
                          key={day.toISOString()}
                          className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 w-20"
                        >
                          <div>{day.toLocaleDateString(localeTag, { weekday: "short" })}</div>
                          <div className="text-[10px] font-normal text-neutral-400 normal-case tracking-normal">
                            {formatDateShort(day.toISOString())}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 w-20">
                        {t("hr.timesheets.detail.total")}
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 w-28">
                        {t("hr.timesheets.monthly.status")}
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 w-32">
                        {t("hr.timesheets.overtime.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {timesheets.map((ts) => {
                      const name      = ts.user?.name ?? t("hr.timesheets.team.member");
                      const sc        = STATUS_CONFIG[ts.status] ?? STATUS_CONFIG.draft;
                      const totalH    = Number(ts.total_hours ?? 0);
                      const isLoading = actionLoading[ts.id];
                      const hasEntries = (ts.entries?.length ?? 0) > 0;

                      return (
                        <tr key={ts.id} className="hover:bg-neutral-50 transition-colors group">
                          {/* Employee */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold", avatarColor(name))}>
                                {initials(name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-neutral-800 truncate leading-tight">{name}</p>
                                <p className="text-[11px] text-neutral-400 truncate">{ts.user?.email ?? ""}</p>
                              </div>
                            </div>
                          </td>

                          {/* Day cells */}
                          {weekDays.map((day) => {
                            const h = hasEntries ? hoursOnDate(ts, day) : null;
                            return (
                              <td key={day.toISOString()} className="px-3 py-3 text-center">
                                {h === null ? (
                                  <span className="text-xs text-neutral-300">—</span>
                                ) : h === 0 ? (
                                  <span className="text-xs text-neutral-300">–</span>
                                ) : (
                                  <span className={cn(
                                    "text-sm font-semibold tabular-nums",
                                    h >= 8 ? "text-green-600" : h >= 4 ? "text-amber-600" : "text-red-500"
                                  )}>
                                    {h.toFixed(1)}
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          {/* Total */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn(
                                "text-sm font-bold tabular-nums",
                                totalH >= 40 ? "text-green-600" : totalH > 0 ? "text-amber-600" : "text-neutral-400"
                              )}>
                                {totalH.toFixed(1)}h
                              </span>
                              <div className="h-1 w-14 overflow-hidden rounded-full bg-neutral-100">
                                <div
                                  className={cn("h-full rounded-full", totalH >= 40 ? "bg-green-500" : "bg-amber-400")}
                                  style={{ width: `${Math.min(100, (totalH / 40) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3 text-center">
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", sc.cls)}>
                              <span className="material-symbols-outlined text-[11px]">{sc.icon}</span>
                              {t(sc.label)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/hr/timesheets/${ts.id}`}
                                className="flex h-7 items-center rounded-lg border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-600 hover:border-primary hover:text-primary transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                              >
                                {t("hr.timesheets.team.view")}
                              </Link>
                              {ts.status === "submitted" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(ts)}
                                    disabled={isLoading}
                                    title={t("common.approve")}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-40 border border-green-200 transition-colors"
                                  >
                                    {isLoading ? (
                                      <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                                    ) : (
                                      <span className="material-symbols-outlined text-[13px]">check</span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReject(ts)}
                                    disabled={isLoading}
                                    title={t("hr.timesheets.team.returnForRevision")}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40 border border-red-200 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">undo</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer totals */}
                  <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                    <tr>
                      <td className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
                        {t("hr.timesheets.team.teamTotal")}
                      </td>
                      {weekDays.map((day) => {
                        const dayTotal = timesheets.reduce((s, ts) => s + hoursOnDate(ts, day), 0);
                        return (
                          <td key={day.toISOString()} className="px-3 py-3 text-center">
                            {dayTotal > 0 ? (
                              <span className="text-xs font-bold text-primary tabular-nums">{dayTotal.toFixed(1)}</span>
                            ) : (
                              <span className="text-xs text-neutral-300">–</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-bold text-primary tabular-nums">{totalHours.toFixed(1)}h</span>
                      </td>
                      <td colSpan={2} className="px-3 py-3 text-right text-xs text-neutral-400">
                        {t(timesheets.length === 1 ? "hr.timesheets.team.membersOvertimeOne" : "hr.timesheets.team.membersOvertimeMany", { count: timesheets.length, hours: overtimeHrs.toFixed(1) })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Summary row */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-[18px] text-primary">summarize</span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("hr.timesheets.team.weekSummary")}</h3>
              <span className="text-xs text-neutral-400 ml-auto">
                {t(timesheets.length === 1 ? "hr.timesheets.team.teamMembersOne" : "hr.timesheets.team.teamMembersMany", { count: timesheets.length })}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label:     t("hr.timesheets.monthly.totalHours"),
                  value:     `${totalHours.toFixed(1)}h`,
                  icon:      "schedule",
                  color:     "text-neutral-900",
                  iconColor: "text-neutral-500",
                  bg:        "bg-neutral-50",
                },
                {
                  label:     t("hr.timesheets.team.avgPerStaff"),
                  value:     timesheets.length > 0 ? `${(totalHours / timesheets.length).toFixed(1)}h` : "—",
                  icon:      "person",
                  color:     "text-primary",
                  iconColor: "text-primary",
                  bg:        "bg-primary/5",
                },
                {
                  label:     t("hr.timesheets.detail.overtime"),
                  value:     `${overtimeHrs.toFixed(1)}h`,
                  icon:      "more_time",
                  color:     overtimeHrs > 0 ? "text-amber-700" : "text-neutral-400",
                  iconColor: overtimeHrs > 0 ? "text-amber-500" : "text-neutral-300",
                  bg:        overtimeHrs > 0 ? "bg-amber-50" : "bg-neutral-50",
                },
                {
                  label:     t("hr.timesheets.status.submitted"),
                  value:     pendingCount,
                  icon:      "pending",
                  color:     pendingCount > 0 ? "text-amber-700" : "text-neutral-400",
                  iconColor: pendingCount > 0 ? "text-amber-500" : "text-neutral-300",
                  bg:        pendingCount > 0 ? "bg-amber-50" : "bg-neutral-50",
                },
              ].map((item) => (
                <div key={item.label} className={cn("rounded-xl p-4 flex items-start gap-3", item.bg)}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 dark:bg-neutral-800">
                    <span className={cn("material-symbols-outlined text-[16px]", item.iconColor)}>{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className={cn("text-lg font-bold leading-none", item.color)}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bulk Approve Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-sm w-full shadow-2xl border border-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-primary text-[22px]">done_all</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">{t("hr.timesheets.team.bulkApprove")}</h3>
                <p className="text-xs text-neutral-400">{t("hr.timesheets.team.cannotUndo")}</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-5">
              {t(pendingCount === 1 ? "hr.timesheets.team.bulkConfirmOne" : "hr.timesheets.team.bulkConfirmMany", { count: pendingCount, week: weekLabel })}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                disabled={bulkLoading}
                className="btn-secondary flex-1 justify-center py-2.5 text-sm"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={bulkLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {bulkLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    {t("hr.timesheets.team.approving")}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">done_all</span>
                    {t("hr.timesheets.team.approveAll")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
