"use client";

import Link from "next/link";

const adminLinks = [
  {
    title: "User Management",
    description: "Manage system access, roles, and security for all personnel.",
    href: "/admin/users",
    icon: "people",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    title: "Roles & Permissions",
    description: "Configure roles and assign permissions across the platform.",
    href: "/admin/roles",
    icon: "admin_panel_settings",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-100",
  },
  {
    title: "Departments",
    description: "Manage organisational structure and department hierarchy.",
    href: "/admin/departments",
    icon: "corporate_fare",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
  },
  {
    title: "Positions",
    description: "Manage establishment positions, grades, and headcount allocations.",
    href: "/admin/positions",
    icon: "work",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
  {
    title: "Payslip Management",
    description: "Bulk upload and manage employee payslips by period.",
    href: "/admin/payslips",
    icon: "receipt_long",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  {
    title: "System Settings",
    description: "Configure organisation details, fiscal year, and platform settings.",
    href: "/admin/settings",
    icon: "settings",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  {
    title: "Approval Workflows",
    description: "Define approval chains and thresholds for each module.",
    href: "/admin/workflows",
    icon: "account_tree",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
  },
  {
    title: "Notification Templates",
    description: "Manage email and system notification templates with variables.",
    href: "/admin/notifications",
    icon: "notifications",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
  },
  {
    title: "Audit Logs",
    description: "Full activity audit trail with user, module, and IP tracking.",
    href: "/admin/audit",
    icon: "manage_search",
    color: "text-neutral-600",
    bg: "bg-neutral-100",
    border: "border-neutral-200",
  },
  {
    title: "Governance Configuration",
    description: "Manage data policies, thresholds, and institution-wide governance settings.",
    href: "/admin/governance",
    icon: "account_balance",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  {
    title: "Calendar Upload",
    description: "Upload SADC public holidays, UN days, and calendar entries.",
    href: "/admin/calendar",
    icon: "event",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  {
    title: "Timesheet Projects",
    description: "Manage project options shown on the HR timesheets page.",
    href: "/admin/timesheet-projects",
    icon: "list_alt",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">
          System configuration, user management, and organisational settings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card p-5 flex flex-col gap-3 hover:border-neutral-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.bg} border ${item.border}`}
              >
                <span
                  className={`material-symbols-outlined ${item.color}`}
                  style={{ fontSize: "28px", fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                >
                  {item.icon}
                </span>
              </div>
              <span className="material-symbols-outlined text-neutral-300 group-hover:text-primary text-[20px] transition-colors">
                arrow_forward
              </span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">{item.title}</h2>
              <p className="text-sm text-neutral-500 mt-0.5">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
