"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { hrApi, type Timesheet, type TimesheetEntry, type AuthUser } from "@/lib/api";
import { readStoredUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useFormatDate } from "@/lib/useFormatDate";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Shared UI helpers ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:     { label: "hr.timesheets.status.draft", cls: "text-neutral-700 bg-neutral-100 border-neutral-200",  icon: "edit_note" },
  submitted: { label: "hr.timesheets.status.submitted", cls: "text-amber-700 bg-amber-50 border-amber-200",         icon: "pending" },
  approved:  { label: "timesheet.import.origin.approved", cls: "text-green-700 bg-green-50 border-green-200",         icon: "check_circle" },
  rejected:  { label: "hr.timesheets.status.rejected", cls: "text-red-700 bg-red-50 border-red-200",               icon: "cancel" },
  imported:  { label: "timesheet.import.origin.imported", cls: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: "history" },
  verified_historical: { label: "timesheet.import.origin.verified", cls: "text-violet-700 bg-violet-50 border-violet-200", icon: "verified" },
  returned: { label: "hr.timesheets.status.returned", cls: "text-amber-700 bg-amber-50 border-amber-200", icon: "undo" },
};

const BUCKET_ICONS: Record<string, string> = {
  delivery:       "task_alt",
  meeting:        "groups",
  communication:  "chat_bubble",
  administration: "settings",
  other:          "category",
};

const BUCKET_COLORS: Record<string, string> = {
  delivery:       "text-blue-600",
  meeting:        "text-violet-600",
  communication:  "text-sky-600",
  administration: "text-amber-600",
  other:          "text-neutral-500",
};

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-neutral-100 rounded" />
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="h-4 w-36 bg-neutral-100 rounded" />
    </div>
  );
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

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TimesheetDetailPage() {
  const { t, localeTag } = useI18n();
  const { fmt: formatDateShort, fmtRelative: formatDateRelative } = useFormatDate();
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = Number(params?.id);

  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const u = readStoredUser();
      if (u) {
        setIsAdmin(
          (u.permissions ?? []).some((p) => ["hr.admin", "hr.approve", "hr.edit", "system.admin"].includes(p))
        );
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError(t("hr.timesheets.detail.invalidId"));
      return;
    }
    hrApi.getTimesheet(id)
      .then((res) => setTimesheet((res.data as any).data ?? res.data))
      .catch(() => setError(t("hr.timesheets.detail.loadFailed")))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    if (!timesheet) return;
    setActionLoading(true);
    try {
      await hrApi.approveTimesheet(timesheet.id);
      toast.success(t("hr.timesheets.approved"));
      const res = await hrApi.getTimesheet(timesheet.id);
      setTimesheet((res.data as any).data ?? res.data);
    } catch (err) {
      setError(t("hr.timesheets.approveFailed"));
      toast.error(t("hr.timesheets.notApproved"), apiErrorMessage(err, t("hr.timesheets.approveFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!timesheet || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await hrApi.rejectTimesheet(timesheet.id, rejectReason.trim());
      toast.success(t("hr.timesheets.rejected"));
      const res = await hrApi.getTimesheet(timesheet.id);
      setTimesheet((res.data as any).data ?? res.data);
      setShowRejectModal(false);
      setRejectReason("");
    } catch (err) {
      setError(t("hr.timesheets.rejectFailed"));
      toast.error(t("hr.timesheets.notRejected"), apiErrorMessage(err, t("hr.timesheets.rejectFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse" />
        <div className="h-7 w-64 bg-neutral-100 rounded animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !timesheet) {
    return (
      <div className="w-full min-w-0">
        <div className="card p-8 text-center">
          <span className="material-symbols-outlined text-[48px] text-neutral-300">error</span>
          <p className="mt-3 text-sm text-neutral-600">{error ?? t("hr.timesheets.detail.notFound")}</p>
          <button onClick={() => router.back()} className="btn-secondary mt-4">{t("hr.timesheets.detail.goBack")}</button>
        </div>
      </div>
    );
  }

  const isHistorical = timesheet.origin === "historical_import"
    || timesheet.status === "imported"
    || timesheet.status === "verified_historical";
  const sc = STATUS_CONFIG[timesheet.status] ?? STATUS_CONFIG.draft;
  const entries: TimesheetEntry[] = timesheet.entries ?? [];
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalOT    = entries.reduce((s, e) => s + (e.overtime_hours ?? 0), 0);
  const expectedH  = 40;
  const missing    = Math.max(0, expectedH - totalHours);

  // Hours by project
  const byProject: Record<string, { label: string; hours: number }> = {};
  for (const e of entries) {
    const key   = e.project_id ? String(e.project_id) : "__none__";
    const label = e.project?.label ?? t("hr.timesheets.detail.noProject");
    if (!byProject[key]) byProject[key] = { label, hours: 0 };
    byProject[key].hours += e.hours;
  }

  // Week label
  const weekStart = new Date(timesheet.week_start + "T00:00:00");
  const weekEnd   = new Date(timesheet.week_end   + "T00:00:00");
  const weekLabel = `${weekStart.toLocaleDateString(localeTag, { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" })}`;

  const userName   = timesheet.user?.name ?? t("hr.timesheets.detail.staffMember");
  const approverName = timesheet.approver?.name;

  // Timeline steps
  type TimelineStatus = "done" | "current" | "pending";
  const steps: { label: string; done: boolean; current: boolean; date?: string | null }[] = isHistorical
    ? [
        { label: t("timesheet.import.origin.imported"), done: true, current: timesheet.status === "imported" },
        {
          label: t("timesheet.import.origin.verified"),
          done: timesheet.status === "verified_historical",
          current: timesheet.status === "verified_historical",
          date: timesheet.approved_at,
        },
      ]
    : [
        { label: t("hr.timesheets.status.draft"), done: true, current: timesheet.status === "draft" },
        {
          label:   t("hr.timesheets.detail.stepSubmitted"),
          done:    ["submitted", "approved", "rejected"].includes(timesheet.status),
          current: timesheet.status === "submitted",
          date:    timesheet.submitted_at,
        },
        {
          label:   timesheet.status === "rejected" ? t("hr.timesheets.status.rejected") : t("timesheet.import.origin.approved"),
          done:    ["approved", "rejected"].includes(timesheet.status),
          current: ["approved", "rejected"].includes(timesheet.status),
          date:    timesheet.approved_at,
        },
      ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("hr.timesheets.detail.weekOf", { week: weekLabel })}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "nav.timesheets", href: "/hr/timesheets" },
              { label: t("hr.timesheets.detail.weekOf", { week: weekLabel }) },
            ]}
          />
        }
        meta={
          <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", sc.cls)}>
            <span className="material-symbols-outlined text-[14px]">{sc.icon}</span>
            {t(sc.label)}
          </div>
        }
        actions={
          <>
          <a
            href={hrApi.exportTimesheetUrl(timesheet.id, "pdf")}
            className="btn-secondary text-sm"
            target="_blank"
            rel="noreferrer"
          >
            PDF {/* i18n-ignore */}
          </a>
          <a
            href={hrApi.exportTimesheetUrl(timesheet.id, "excel")}
            className="btn-secondary text-sm"
            target="_blank"
            rel="noreferrer"
          >
            Excel {/* i18n-ignore */}
          </a>
          <a
            href={hrApi.exportTimesheetUrl(timesheet.id, "csv")}
            className="btn-secondary text-sm"
            target="_blank"
            rel="noreferrer"
          >
            CSV {/* i18n-ignore */}
          </a>
          {timesheet.status === "draft" && timesheet.origin !== "historical_import" && (
            <Link href="/hr/timesheets" className="btn-secondary">{t("common.edit")}</Link>
          )}
          {isAdmin && timesheet.status === "submitted" && (
            <>
              <button type="button" onClick={handleApprove} disabled={actionLoading} className="btn-primary disabled:opacity-50">
                {actionLoading ? t("hr.timesheets.detail.processing") : t("common.approve")}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {t("common.reject")}
              </button>
            </>
          )}
          </>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {isHistorical && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          {t("timesheet.import.readOnly")}
        </div>
      )}

      {/* Main 2-col layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* LEFT: Entries table */}
        <div className="col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
              <SectionIcon icon="schedule" color="text-blue-600" bg="bg-blue-50" />
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">{t("hr.timesheets.detail.timeEntries")}</h2>
                <p className="text-xs text-neutral-500">{t("hr.timesheets.detail.entriesThisWeek", { count: entries.length })}</p>
              </div>
            </div>

            {entries.length === 0 ? (
              <EmptyState icon="schedule" title={t("hr.timesheets.detail.noEntries")} className="py-12 min-h-0" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("hr.timesheets.col.date")}</th>
                    <th>{t("hr.timesheets.detail.workType")}</th>
                    <th>{t("hr.timesheets.col.project")}</th>
                    <th>{t("hr.timesheets.detail.activity")}</th>
                    <th className="text-right">{t("hr.timesheets.col.hours")}</th>
                    <th className="text-right">{t("hr.timesheets.detail.ot")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const bucket = entry.work_bucket ?? "other";
                    const icon   = BUCKET_ICONS[bucket] ?? "category";
                    const color  = BUCKET_COLORS[bucket] ?? "text-neutral-500";
                    const entryDate = new Date(entry.work_date + "T00:00:00");
                    return (
                      <tr key={entry.id ?? idx}>
                        <td className="text-xs text-neutral-600">
                          {entryDate.toLocaleDateString(localeTag, { weekday: "short", day: "numeric", month: "short" })}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("material-symbols-outlined text-[15px]", color)}>{icon}</span>
                            <span className="text-xs capitalize text-neutral-700">{t(`hr.timesheets.bucket.${bucket}`)}</span>
                          </div>
                        </td>
                        <td className="text-xs text-neutral-600">
                          {entry.project?.label ?? <span className="text-neutral-300">—</span>}
                        </td>
                        <td className="text-xs text-neutral-600">
                          {entry.activity_type ?? <span className="text-neutral-300">—</span>}
                        </td>
                        <td className="text-right text-sm font-semibold text-neutral-800">{entry.hours}h</td>
                        <td className="text-right text-xs text-amber-600">
                          {(entry.overtime_hours ?? 0) > 0 ? `${entry.overtime_hours}h` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-50">
                    <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-neutral-600">{t("hr.timesheets.detail.total")}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-neutral-900">{totalHours}h</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-amber-600">
                      {totalOT > 0 ? `${totalOT}h` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT: 3 stacked cards */}
        <div className="space-y-4">
          {/* Summary card */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <SectionIcon icon="bar_chart" color="text-indigo-600" bg="bg-indigo-50" />
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("hr.timesheets.detail.summary")}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t("hr.timesheets.detail.totalHours")}</span>
                <span className="text-sm font-bold text-neutral-900">{totalHours.toFixed(1)}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t("hr.timesheets.detail.overtime")}</span>
                <span className={cn("text-sm font-semibold", totalOT > 0 ? "text-amber-600" : "text-neutral-400")}>
                  {totalOT > 0 ? `+${totalOT.toFixed(1)}h` : t("hr.timesheets.detail.none")}
                </span>
              </div>
              {missing > 0 && timesheet.status === "draft" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">{t("hr.timesheets.detail.missing")}</span>
                  <span className="text-sm font-semibold text-red-600">{missing.toFixed(1)}h</span>
                </div>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className={cn("h-full rounded-full", totalHours > expectedH ? "bg-amber-500" : "bg-primary")}
                style={{ width: `${Math.min(100, (totalHours / expectedH) * 100)}%` }}
              />
            </div>
          </div>

          {/* Hours by project */}
          {Object.keys(byProject).length > 0 && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <SectionIcon icon="pie_chart" color="text-emerald-600" bg="bg-emerald-50" />
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("hr.timesheets.detail.byProject")}</span>
              </div>
              {Object.values(byProject).map((p) => (
                <div key={p.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-600 truncate max-w-[120px]">{p.label}</span>
                    <span className="text-xs font-medium text-neutral-800">{p.hours.toFixed(1)}h</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: totalHours > 0 ? `${(p.hours / totalHours) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Employee info */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <SectionIcon icon="person" color="text-violet-600" bg="bg-violet-50" />
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("hr.timesheets.detail.employee")}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0", avatarColor(userName))}>
                {initials(userName)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-800 truncate">{userName}</p>
                <p className="text-xs text-neutral-500 truncate">{timesheet.user?.email ?? ""}</p>
              </div>
            </div>
            {timesheet.submitted_at && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t("hr.timesheets.detail.stepSubmitted")}</span>
                <span className="text-xs text-neutral-700">{formatDateShort(timesheet.submitted_at)}</span>
              </div>
            )}
            {approverName && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t("hr.timesheets.detail.approvedBy")}</span>
                <span className="text-xs text-neutral-700">{approverName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rejection reason */}
      {timesheet.status === "rejected" && timesheet.rejection_reason && (
        <div className="card p-4 border-red-200 bg-red-50 space-y-1">
          <p className="text-sm font-semibold text-red-700">{t("hr.timesheets.detail.rejectionReason")}</p>
          <p className="text-sm text-red-600">{timesheet.rejection_reason}</p>
        </div>
      )}

      {/* Approval Timeline */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <SectionIcon icon="timeline" color="text-neutral-600" bg="bg-neutral-100" />
          <h2 className="text-sm font-semibold text-neutral-900">{t("hr.timesheets.detail.timeline")}</h2>
        </div>
        <div className="flex items-center gap-0">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    step.done && step.current && timesheet.status === "rejected"
                      ? "bg-red-100 text-red-600 border-2 border-red-400"
                      : step.done
                      ? "bg-green-100 text-green-600 border-2 border-green-400"
                      : "bg-neutral-100 text-neutral-400 border-2 border-neutral-200"
                  )}
                >
                  {step.done ? (
                    <span className="material-symbols-outlined text-[16px]">
                      {step.current && timesheet.status === "rejected" ? "close" : "check"}
                    </span>
                  ) : (
                    <span className="text-xs">{i + 1}</span>
                  )}
                </div>
                <p className={cn("mt-1.5 text-xs font-medium", step.done ? "text-neutral-800" : "text-neutral-400")}>
                  {step.label}
                </p>
                {step.date && (
                  <p className="text-[10px] text-neutral-400">{formatDateShort(step.date)}</p>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-2 mb-5", steps[i + 1].done ? "bg-green-300" : "bg-neutral-200")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="card w-full max-w-md p-6 space-y-4">
              <h3 className="text-base font-semibold text-neutral-900">{t("hr.timesheets.rejectTitle")}</h3>
              <p className="text-sm text-neutral-600">{t("hr.timesheets.rejectPrompt")}</p>
              <textarea
                rows={4}
                className="form-input resize-none"
                placeholder={t("hr.timesheets.rejectPlaceholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowRejectModal(false)}>{t("common.cancel")}</button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || actionLoading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? t("hr.timesheets.rejecting") : t("common.reject")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
