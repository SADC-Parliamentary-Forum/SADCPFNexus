"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { ADMIN_HUB_CARDS } from "@/lib/hubs/admin";
import { adminConsoleApi, type AdminConsoleDashboard } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

const adminLinks = [
  {
    title: "Operational Control",
    description: "Platform health, modules, configuration, feature flags, jobs, queues, and break-glass controls.",
    href: "/admin/operations",
    icon: "monitoring",
    color: "text-slate-700",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
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
    href: "/admin/access/roles",
    icon: "admin_panel_settings",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
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
    href: "/admin/audit-trail",
    icon: "manage_search",
    color: "text-neutral-600",
    bg: "bg-neutral-100",
    border: "border-neutral-200",
  },
  {
    title: "Ledger Verification",
    description: "Cryptographic integrity checks, manifest hashes, and compliance audit status.",
    href: "/admin/ledger",
    icon: "verified_user",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-100",
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
  {
    title: "HR Administration",
    description: "Configure grade bands, salary scales, job families, contract types, leave profiles, and HR governance settings.",
    href: "/settings/hr",
    icon: "tune",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  {
    title: "Correspondence Settings",
    description: "Configure file codes, signatory roles, and reference number rules for the registry.",
    href: "/admin/correspondence",
    icon: "mark_email_read",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
  },
];

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<AdminConsoleDashboard | null>(null);

  useEffect(() => {
    adminConsoleApi.dashboard().then((res) => setDashboard(res.data.data)).catch(() => setDashboard(null));
  }, []);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Admin"
        subtitle="System configuration, user management, and organisational settings."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Admin" }]} />}
      />

      <ModuleHubCards cards={ADMIN_HUB_CARDS} />

      {dashboard ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Platform", dashboard.status],
            ["Active modules", dashboard.cards.modules_active],
            ["Pending config", dashboard.cards.configuration_pending],
            ["Open dead letters", dashboard.cards.dead_letters_open],
            ["Data-quality issues", dashboard.cards.data_quality_open],
          ].map(([label, value]) => (
            <div key={String(label)} className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
              <p className="mt-1 text-lg font-semibold capitalize text-neutral-900">{String(value ?? "-").replaceAll("_", " ")}</p>
            </div>
          ))}
        </div>
      ) : null}

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
