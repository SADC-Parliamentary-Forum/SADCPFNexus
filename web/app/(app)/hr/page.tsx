"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect } from "react";
import Link from "next/link";
import { hrApi, type Timesheet } from "@/lib/api";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { HR_HUB_CARDS } from "@/lib/hubs/hr";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { labelKey: string; cls: string }> = {
  approved: { labelKey: "hr.status.approved", cls: "badge-success" },
  submitted: { labelKey: "hr.status.submitted", cls: "badge-warning" },
  rejected: { labelKey: "hr.status.rejected", cls: "badge-danger" },
  draft: { labelKey: "hr.status.draft", cls: "badge-muted" },
};

function formatPeriod(ts: Timesheet) {
  const start = new Date(ts.week_start).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const end = new Date(ts.week_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${start} – ${end}`;
}

interface HRSummary {
  hours_this_month: number;
  overtime_mtd: number;
  annual_leave_left: number;
  lil_hours_available: number;
}

export default function HRPage() {
  const { t } = useI18n();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [summary, setSummary] = useState<HRSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hrApi.listTimesheets()
      .then((res) => setTimesheets((res.data as { data?: Timesheet[] }).data ?? []))
      .catch(() => setError(t("hr.timesheets.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    hrApi.getSummary().then((res) => setSummary(res.data as HRSummary)).catch(() => { });
  }, []);

  const stats = [
    { label: t("hr.stat.hours"), value: summary != null ? `${summary.hours_this_month} hrs` : "—", icon: "schedule", color: "text-primary", bg: "bg-primary/10" },
    { label: t("hr.stat.overtime"), value: summary != null ? `${summary.overtime_mtd} hrs` : "—", icon: "more_time", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: t("hr.stat.leave"), value: summary != null ? `${summary.annual_leave_left}` : "—", icon: "event_available", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: t("hr.stat.lil"), value: summary != null ? `${summary.lil_hours_available} hrs` : "—", icon: "swap_horiz", color: "text-primary", bg: "bg-primary/10" },
  ];

  const quickActions = [
    { label: t("hr.action.timesheet"), desc: t("hr.action.timesheetHint"), icon: "edit_calendar", href: "/hr/timesheets" },
    { label: t("hr.action.leave"), desc: t("hr.action.leaveHint"), icon: "event_available", href: "/leave/create" },
    { label: t("hr.action.advance"), desc: t("hr.action.advanceHint"), icon: "account_balance", href: "/salary-advances/create" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="hr.hub"
        subtitle="hr.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "hr.hub" }]} />}
      />

      <ModuleHubCards cards={HR_HUB_CARDS} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.label}</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{s.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.color} text-[20px]`}>{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {quickActions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="card p-4 flex items-center gap-3 hover:border-primary/30 hover:shadow-elevated transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-primary text-[20px]">{a.icon}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{a.label}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{a.desc}</p>
            </div>
            <span className="material-symbols-outlined text-neutral-300 dark:text-neutral-600 text-[18px] ml-auto">chevron_right</span>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 dark:text-neutral-500 text-[18px]">calendar_today</span>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("hr.timesheets.recent")}</h3>
          </div>
          <Link href="/hr/timesheets" className="text-xs font-semibold text-primary">{t("hr.timesheets.viewAll")}</Link>
        </div>

        {error && (
          <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800/50 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error_outline</span>
            {error}
          </div>
        )}

        {loading ? (
          <div className="px-5 py-10 text-center">
            <div className="flex items-center justify-center gap-2 text-neutral-400 dark:text-neutral-500">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              <span className="text-sm">{t("common.loading")}</span>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50 dark:divide-neutral-700/50">
            {timesheets.map((ts) => {
              const s = statusConfig[ts.status] ?? { labelKey: ts.status, cls: "badge-muted" };
              return (
                <Link
                  key={ts.id}
                  href={`/hr/timesheets?week=${ts.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{formatPeriod(ts)}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {ts.total_hours} hrs{ts.overtime_hours ? ` · ${ts.overtime_hours} hrs OT` : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${s.cls}`}>{statusConfig[ts.status] ? t(s.labelKey) : ts.status}</span>
                </Link>
              );
            })}
            {timesheets.length === 0 && (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-4xl text-neutral-200 dark:text-neutral-600">calendar_today</span>
                <p className="mt-3 text-sm text-neutral-400 dark:text-neutral-500">{t("hr.timesheets.empty")}</p>
                <Link href="/hr/timesheets" className="mt-3 inline-block text-sm font-semibold text-primary">
                  {t("hr.timesheets.submitFirst")}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
