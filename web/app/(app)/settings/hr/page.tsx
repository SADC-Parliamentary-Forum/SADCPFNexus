"use client";

import Link from "next/link";

const settingsLinks = [
  {
    title: "Position Grades",
    description: "Define grade bands, employment categories, leave entitlements, and eligibility rules.",
    href: "/settings/hr/grade-bands",
    icon: "grade",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    badge: "Core",
    available: true,
  },
  {
    title: "Salary Scales",
    description: "Configure notch-based salary scales linked to each grade band with effective dates.",
    href: "/settings/hr/salary-scales",
    icon: "payments",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
    badge: "Core",
    available: true,
  },
  {
    title: "Job Families",
    description: "Group positions into functional families such as Finance, ICT, and Parliamentary Affairs.",
    href: "/settings/hr/job-families",
    icon: "category",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
    badge: null,
    available: true,
  },
  {
    title: "Contract Types",
    description: "Define contract templates — permanent, fixed-term, temporary, consultancy.",
    href: "/settings/hr/contract-types",
    icon: "description",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    badge: "Phase 2",
    available: true,
  },
  {
    title: "Leave Profiles",
    description: "Set leave day entitlements by grade category for each leave type.",
    href: "/settings/hr/leave-profiles",
    icon: "event_available",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
    badge: "Phase 2",
    available: true,
  },
  {
    title: "Allowance Profiles",
    description: "Configure transport, housing, communication, and subsistence allowance rules.",
    href: "/settings/hr/allowance-profiles",
    icon: "attach_money",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    badge: "Phase 2",
    available: true,
  },
  {
    title: "Appraisal Templates",
    description: "Define appraisal cycles, rating scales, KRA counts, and template configurations.",
    href: "/settings/hr/appraisal-templates",
    icon: "rate_review",
    color: "text-pink-600",
    bg: "bg-pink-50",
    border: "border-pink-100",
    badge: "Phase 3",
    available: true,
  },
  {
    title: "Personnel File Sections",
    description: "Configure document sections, visibility levels, retention rules, and mandatory requirements.",
    href: "/settings/hr/personnel-file-sections",
    icon: "folder_shared",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    badge: "Phase 3",
    available: true,
  },
  {
    title: "Approval Matrix",
    description: "Define who approves HR actions — recruitment, promotion, salary adjustment, and more.",
    href: "/settings/hr/approval-matrix",
    icon: "account_tree",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-100",
    badge: "Phase 3",
    available: true,
  },
  {
    title: "Settings Audit Log",
    description: "Immutable history of every change made to HR master data, with before/after values.",
    href: "/settings/hr/audit",
    icon: "receipt_long",
    color: "text-neutral-600",
    bg: "bg-neutral-100",
    border: "border-neutral-200",
    badge: "Phase 3",
    available: true,
  },
];

export default function HrSettingsDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <Link href="/admin" className="hover:text-neutral-700 transition-colors">Admin</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700 font-medium">HR Administration</span>
        </div>
        <h1 className="page-title">HR Master Data &amp; Rules</h1>
        <p className="page-subtitle">
          Governed configuration for position grading, salary scales, employment terms, and HR workflows.
          All sensitive changes require approval before taking effect.
        </p>
      </div>

      {/* Governance notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex gap-3">
        <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5 shrink-0">policy</span>
        <div>
          <p className="text-sm font-medium text-amber-800">Governed configuration area</p>
          <p className="text-sm text-amber-700 mt-0.5">
            Changes to grade bands and salary scales follow a draft → review → approved → published lifecycle.
            Published records cannot be edited directly — a new version must be created and approved.
          </p>
        </div>
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((item) =>
          item.available ? (
            <Link
              key={item.href}
              href={item.href}
              className={`card p-5 flex gap-4 items-start hover:shadow-md transition-shadow border ${item.border} group`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                <span className={`material-symbols-outlined text-[20px] ${item.color}`}>{item.icon}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900 text-sm group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                  {item.badge && (
                    <span className={
                      item.badge === "Core"
                        ? "text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                        : item.badge === "Phase 2"
                        ? "text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
                        : "text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500"
                    }>
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{item.description}</p>
              </div>
            </Link>
          ) : (
            <div
              key={item.href}
              className={`card p-5 flex gap-4 items-start border ${item.border} opacity-60 cursor-not-allowed`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                <span className={`material-symbols-outlined text-[20px] ${item.color}`}>{item.icon}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900 text-sm">{item.title}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-400">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{item.description}</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
