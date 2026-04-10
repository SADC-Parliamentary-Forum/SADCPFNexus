"use client";

import Link from "next/link";

interface SettingsCard {
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  items?: string[];
}

const SETTINGS_SECTIONS: SettingsCard[] = [
  {
    title: "HR Configuration",
    description: "Job families, salary scales, grade bands, leave profiles, contract types, appraisal templates, allowance profiles.",
    icon: "manage_accounts",
    href: "/settings/hr",
    color: "bg-blue-50 text-blue-600",
    items: ["Job Families", "Salary Scales", "Grade Bands", "Leave Profiles", "Contract Types", "Appraisal Templates", "Allowance Profiles"],
  },
  {
    title: "Approval Workflows",
    description: "Define multi-step approval chains for travel, leave, imprest, procurement, and other modules.",
    icon: "account_tree",
    href: "/admin/workflows",
    color: "bg-violet-50 text-violet-600",
    items: ["Travel Workflows", "Leave Workflows", "Imprest Workflows", "Procurement Workflows"],
  },
  {
    title: "Notification Templates",
    description: "Manage email notification templates sent to staff on request submission, approval, and rejection.",
    icon: "notifications_active",
    href: "/admin/notifications",
    color: "bg-amber-50 text-amber-600",
    items: ["Travel Notifications", "Leave Notifications", "Imprest Notifications", "Procurement Notifications"],
  },
  {
    title: "System Settings",
    description: "Organisation details, default currency, fiscal year start, timezone, letterhead configuration.",
    icon: "settings",
    href: "/admin/settings",
    color: "bg-neutral-100 text-neutral-600",
    items: ["Organisation Info", "Currency & Fiscal Year", "Timezone", "Letterhead"],
  },
  {
    title: "Roles & Permissions",
    description: "Create roles and assign granular permissions. Control what each user type can see and do.",
    icon: "admin_panel_settings",
    href: "/admin/roles",
    color: "bg-rose-50 text-rose-600",
    items: ["Role Matrix", "Create Roles", "Permission Groups"],
  },
  {
    title: "Departments & Portfolios",
    description: "Manage organisational departments and portfolio groupings for staff assignment.",
    icon: "corporate_fare",
    href: "/admin/departments",
    color: "bg-emerald-50 text-emerald-600",
    items: ["Departments", "Portfolios", "Positions"],
  },
  {
    title: "Holiday Calendars",
    description: "Configure public holidays and leave-impact dates used in timesheet conflict detection.",
    icon: "event_available",
    href: "/admin/holidays",
    color: "bg-teal-50 text-teal-600",
    items: ["Holiday Dates", "Calendar Groups"],
  },
  {
    title: "Timesheet Projects",
    description: "Define project codes and work buckets for timesheet classification.",
    icon: "task_alt",
    href: "/admin/timesheet-projects",
    color: "bg-indigo-50 text-indigo-600",
    items: ["Project Codes", "Work Buckets"],
  },
  {
    title: "Data Scope & RLS",
    description: "Review row-level security assignments and data isolation across departments and portfolios.",
    icon: "shield_lock",
    href: "/admin/data-scope",
    color: "bg-orange-50 text-orange-600",
    items: ["RLS Status", "Scope Assignments"],
  },
];

export default function SettingsHubPage() {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">System configuration, HR policy, roles, and organisation setup.</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="card p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${section.color}`}>
                <span className="material-symbols-outlined text-[20px]">{section.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-neutral-800 group-hover:text-primary transition-colors text-sm">
                  {section.title}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{section.description}</p>
              </div>
            </div>
            {section.items && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-neutral-100">
                {section.items.map((item) => (
                  <span key={item} className="text-[11px] text-neutral-500 bg-neutral-100 rounded px-2 py-0.5">
                    {item}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-primary font-medium mt-auto pt-1">
              Configure
              <span className="material-symbols-outlined text-[15px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
