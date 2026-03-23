"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { hrApi, type Timesheet } from "@/lib/api";

const statusConfig: Record<string, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "badge-success" },
  submitted: { label: "Submitted", cls: "badge-warning" },
  rejected: { label: "Rejected", cls: "badge-danger" },
  draft: { label: "Draft", cls: "badge-muted" },
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

const HR_TABS = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "timesheets", label: "Timesheets", icon: "calendar_today" },
  { key: "leave", label: "Leave", icon: "event_available" },
  { key: "payroll", label: "Payroll", icon: "account_balance" },
  { key: "performance", label: "Performance", icon: "trending_up" },
  { key: "appraisals", label: "Appraisals", icon: "rate_review" },
  { key: "conduct", label: "Conduct", icon: "gavel" },
  { key: "files", label: "Personal files", icon: "folder" },
];

function HRPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";

  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [summary, setSummary] = useState<HRSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hrApi.listTimesheets()
      .then((res) => setTimesheets((res.data as any).data ?? []))
      .catch(() => setError("Failed to load timesheets."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    hrApi.getSummary().then((res) => setSummary(res.data)).catch(() => { });
  }, []);

  const stats = [
    { label: "Hours This Month", value: summary != null ? `${summary.hours_this_month} hrs` : "—", icon: "schedule", color: "text-primary", bg: "bg-primary/10" },
    { label: "Overtime (MTD)", value: summary != null ? `${summary.overtime_mtd} hrs` : "—", icon: "more_time", color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Annual Leave Left", value: summary != null ? `${summary.annual_leave_left} days` : "—", icon: "event_available", color: "text-green-600", bg: "bg-green-50" },
    { label: "LIL Hours Available", value: summary != null ? `${summary.lil_hours_available} hrs` : "—", icon: "swap_horiz", color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const quickActions = [
    { label: "Submit Timesheet", desc: "Log this week's hours", icon: "edit_calendar", href: "/hr/timesheets" },
    { label: "Apply for Leave", desc: "Annual, sick, or LIL", icon: "event_available", href: "/leave/create" },
    { label: "Salary Advance", desc: "Request a pay advance", icon: "account_balance", href: "/finance/advances/create" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Human Resources</h1>
        <p className="page-subtitle">Timesheets, leave balances, payroll, and HR self-service.</p>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {HR_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => router.push(`/hr${tab.key !== "overview" ? `?tab=${tab.key}` : ""}`)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
              }`}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leave tab */}
      {activeTab === "leave" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">View and manage all staff leave requests.</p>
            <Link href="/hr/leave" className="btn-primary py-2 px-3 text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              Full Leave Manager
            </Link>
          </div>
          <Link href="/hr/leave" className="card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors group">
            <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600 text-[24px]">event_available</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Staff Leave Requests</p>
              <p className="text-xs text-neutral-500">Approve, reject, and manage leave applications for all staff.</p>
            </div>
            <span className="material-symbols-outlined text-neutral-300 text-[20px] ml-auto">chevron_right</span>
          </Link>
        </div>
      )}

      {/* Payroll tab */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Payroll management and payslip access.</p>
          <Link href="/finance" className="card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[24px]">account_balance</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Finance &amp; Payroll</p>
              <p className="text-xs text-neutral-500">Access payslips, salary advances, and finance records.</p>
            </div>
            <span className="material-symbols-outlined text-neutral-300 text-[20px] ml-auto">chevron_right</span>
          </Link>
        </div>
      )}

      {/* Timesheets tab */}
      {activeTab === "timesheets" && (
        <Link href="/hr/timesheets" className="card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[24px]">edit_calendar</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">My Timesheets</p>
            <p className="text-xs text-neutral-500">Log and submit your weekly hours.</p>
          </div>
          <span className="material-symbols-outlined text-neutral-300 text-[20px] ml-auto">chevron_right</span>
        </Link>
      )}

      {/* Performance tab */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Live performance tracking, status distribution, and employee profiles.</p>
          <Link href="/hr/performance" className="card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors group">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-primary text-[24px]">trending_up</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Performance Tracker</p>
              <p className="text-xs text-neutral-500">View status distribution, watchlist, and employee performance profiles.</p>
            </div>
            <span className="material-symbols-outlined text-neutral-300 text-[20px] ml-auto">chevron_right</span>
          </Link>
        </div>
      )}

      {/* Appraisals tab */}
      {activeTab === "appraisals" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Formal performance review cycles, self-assessment, supervisor and HOD review, SG decision.</p>
          <Link href="/hr/appraisals" className="card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors group">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-primary text-[24px]">rate_review</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Performance Appraisal</p>
              <p className="text-xs text-neutral-500">View and manage appraisal cycles and employee appraisals.</p>
            </div>
            <span className="material-symbols-outlined text-neutral-300 text-[20px] ml-auto">chevron_right</span>
          </Link>
        </div>
      )}

      {/* Conduct tab */}
      {activeTab === "conduct" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Commendations, warnings, and corrective actions that support performance review.</p>
          <Link href="/hr/conduct" className="card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors group">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-primary text-[24px]">gavel</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Conduct &amp; Recognition</p>
              <p className="text-xs text-neutral-500">View conduct and recognition records.</p>
            </div>
            <span className="material-symbols-outlined text-neutral-300 text-[20px] ml-auto">chevron_right</span>
          </Link>
        </div>
      )}

      {/* Personal files tab */}
      {activeTab === "files" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Employee directory and digital HR personal files.</p>
          <Link href="/hr/files" className="card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors group">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-primary text-[24px]">folder</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">HR Personal Files</p>
              <p className="text-xs text-neutral-500">Search employees, view file summaries, documents, and timeline.</p>
            </div>
            <span className="material-symbols-outlined text-neutral-300 text-[20px] ml-auto">chevron_right</span>
          </Link>
        </div>
      )}

      {/* Overview tab (default) */}
      {(activeTab === "overview" || !["leave", "payroll", "timesheets", "performance", "appraisals", "conduct", "files"].includes(activeTab)) && (
        <>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-500">{s.label}</p>
                    <p className="text-xl font-bold text-neutral-900 mt-1">{s.value}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined ${s.color} text-[20px]`}>{s.icon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="card p-4 flex items-center gap-3 hover:border-primary/30 hover:shadow-elevated transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <span className="material-symbols-outlined text-primary text-[20px]">{a.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{a.label}</p>
                  <p className="text-xs text-neutral-500">{a.desc}</p>
                </div>
                <span className="material-symbols-outlined text-neutral-300 text-[18px] ml-auto">chevron_right</span>
              </Link>
            ))}
          </div>

          {/* Recent timesheets */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-[18px]">calendar_today</span>
                <h3 className="text-sm font-semibold text-neutral-900">Recent Timesheets</h3>
              </div>
              <Link href="/hr/timesheets" className="text-xs font-semibold text-primary hover:underline">View all</Link>
            </div>

            {error && (
              <div className="px-5 py-3 bg-red-50 border-b border-red-100 text-sm text-red-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error_outline</span>
                {error}
              </div>
            )}

            {loading ? (
              <div className="px-5 py-10 text-center">
                <div className="flex items-center justify-center gap-2 text-neutral-400">
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  <span className="text-sm">Loading…</span>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {timesheets.map((ts) => {
                  const s = statusConfig[ts.status] ?? { label: ts.status, cls: "badge-muted" };
                  return (
                    <Link
                      key={ts.id}
                      href={`/hr/timesheets?week=${ts.id}`}
                      className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{formatPeriod(ts)}</p>
                          <p className="text-xs text-neutral-400">
                            {ts.total_hours} hrs{ts.overtime_hours ? ` · ${ts.overtime_hours} hrs OT` : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`badge ${s.cls}`}>{s.label}</span>
                    </Link>
                  );
                })}
                {timesheets.length === 0 && (
                  <div className="py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-neutral-200">calendar_today</span>
                    <p className="mt-3 text-sm text-neutral-400">No timesheets submitted yet.</p>
                    <Link href="/hr/timesheets" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                      Submit your first timesheet
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function HRPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-neutral-400">Loading...</div>}>
      <HRPageContent />
    </Suspense>
  );
}
