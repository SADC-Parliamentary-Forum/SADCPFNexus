"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { ADMIN_HUB_CARDS } from "@/lib/hubs/admin";
import { adminConsoleApi, type AdminConsoleDashboard } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const adminLinks = [
  {
    title: "admin.home.operationalControl",
    description: "admin.home.operationalControlDesc",
    href: "/admin/operations",
    icon: "monitoring",
    color: "text-slate-700",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
  {
    title: "admin.home.userManagement",
    description: "admin.home.userManagementDesc",
    href: "/admin/users",
    icon: "people",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    title: "admin.home.rolesPermissions",
    description: "admin.home.rolesPermissionsDesc",
    href: "/admin/access/roles",
    icon: "admin_panel_settings",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    title: "admin.home.departments",
    description: "admin.home.departmentsDesc",
    href: "/admin/departments",
    icon: "corporate_fare",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
  },
  {
    title: "admin.home.positions",
    description: "admin.home.positionsDesc",
    href: "/admin/positions",
    icon: "work",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
  {
    title: "admin.home.payslipManagement",
    description: "admin.home.payslipManagementDesc",
    href: "/admin/payslips",
    icon: "receipt_long",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  {
    title: "admin.home.systemSettings",
    description: "admin.home.systemSettingsDesc",
    href: "/admin/settings",
    icon: "settings",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  {
    title: "admin.home.email",
    description: "admin.home.emailDesc",
    href: "/admin/email",
    icon: "forward_to_inbox",
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-100",
  },
  {
    title: "admin.home.approvalWorkflows",
    description: "admin.home.approvalWorkflowsDesc",
    href: "/admin/workflows",
    icon: "account_tree",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
  },
  {
    title: "admin.home.notificationTemplates",
    description: "admin.home.notificationTemplatesDesc",
    href: "/admin/notifications",
    icon: "notifications",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
  },
  {
    title: "admin.home.auditLogs",
    description: "admin.home.auditLogsDesc",
    href: "/admin/audit-trail",
    icon: "manage_search",
    color: "text-neutral-600",
    bg: "bg-neutral-100",
    border: "border-neutral-200",
  },
  {
    title: "admin.home.ledgerVerification",
    description: "admin.home.ledgerVerificationDesc",
    href: "/admin/ledger",
    icon: "verified_user",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  {
    title: "admin.home.governanceConfiguration",
    description: "admin.home.governanceConfigurationDesc",
    href: "/admin/governance",
    icon: "account_balance",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  {
    title: "admin.home.calendarUpload",
    description: "admin.home.calendarUploadDesc",
    href: "/admin/calendar",
    icon: "event",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  {
    title: "admin.home.timesheetProjects",
    description: "admin.home.timesheetProjectsDesc",
    href: "/admin/timesheet-projects",
    icon: "list_alt",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
  },
  {
    title: "admin.home.hrAdministration",
    description: "admin.home.hrAdministrationDesc",
    href: "/settings/hr",
    icon: "tune",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  {
    title: "admin.home.correspondenceSettings",
    description: "admin.home.correspondenceSettingsDesc",
    href: "/admin/correspondence",
    icon: "mark_email_read",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
  },
];

export default function AdminPage() {
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<AdminConsoleDashboard | null>(null);

  useEffect(() => {
    adminConsoleApi.dashboard().then((res) => setDashboard(res.data.data)).catch(() => setDashboard(null));
  }, []);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title={t("admin.homeLabel")}
        subtitle={t("admin.home.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.homeLabel") }]} />}
      />

      <ModuleHubCards cards={ADMIN_HUB_CARDS} />

      {dashboard ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [t("admin.home.statPlatform"), dashboard.status],
            [t("admin.home.statModules"), dashboard.cards.modules_active],
            [t("admin.home.statPendingConfig"), dashboard.cards.configuration_pending],
            [t("admin.auditTrail.stat.openDeadLetters"), dashboard.cards.dead_letters_open],
            [t("admin.home.statDataQuality"), dashboard.cards.data_quality_open],
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
              <h2 className="text-base font-semibold text-neutral-900">{t(item.title)}</h2>
              <p className="text-sm text-neutral-500 mt-0.5">{t(item.description)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
