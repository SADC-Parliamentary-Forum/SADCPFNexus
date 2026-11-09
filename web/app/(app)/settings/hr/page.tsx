"use client";

import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const BADGE_KEYS: Record<string, string> = {
  Core: "settings.hr.home.badge.core",
  "Phase 2": "settings.hr.home.badge.phase2",
  "Phase 3": "settings.hr.home.badge.phase3",
};

const settingsLinks = [
  {
    title: "settings.hr.home.gradeBands.title",
    description: "settings.hr.home.gradeBands.description",
    href: "/settings/hr/grade-bands",
    icon: "grade",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    badge: "Core",
  },
  {
    title: "settings.hr.home.salaryScales.title",
    description: "settings.hr.home.salaryScales.description",
    href: "/settings/hr/salary-scales",
    icon: "payments",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
    badge: "Core",
  },
  {
    title: "settings.hr.home.jobFamilies.title",
    description: "settings.hr.home.jobFamilies.description",
    href: "/settings/hr/job-families",
    icon: "category",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
    badge: null,
  },
  {
    title: "settings.hr.home.contractTypes.title",
    description: "settings.hr.home.contractTypes.description",
    href: "/settings/hr/contract-types",
    icon: "description",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    badge: "Phase 2",
  },
  {
    title: "settings.hr.home.leaveProfiles.title",
    description: "settings.hr.home.leaveProfiles.description",
    href: "/settings/hr/leave-profiles",
    icon: "event_available",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
    badge: "Phase 2",
  },
  {
    title: "settings.hr.home.allowanceProfiles.title",
    description: "settings.hr.home.allowanceProfiles.description",
    href: "/settings/hr/allowance-profiles",
    icon: "attach_money",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    badge: "Phase 2",
  },
  {
    title: "settings.hr.home.appraisalTemplates.title",
    description: "settings.hr.home.appraisalTemplates.description",
    href: "/settings/hr/appraisal-templates",
    icon: "rate_review",
    color: "text-pink-600",
    bg: "bg-pink-50",
    border: "border-pink-100",
    badge: "Phase 3",
  },
  {
    title: "settings.hr.home.personnelFileSections.title",
    description: "settings.hr.home.personnelFileSections.description",
    href: "/settings/hr/personnel-file-sections",
    icon: "folder_shared",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    badge: "Phase 3",
  },
  {
    title: "settings.hr.home.approvalMatrix.title",
    description: "settings.hr.home.approvalMatrix.description",
    href: "/settings/hr/approval-matrix",
    icon: "account_tree",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-100",
    badge: "Phase 3",
  },
  {
    title: "settings.hr.home.audit.title",
    description: "settings.hr.home.audit.description",
    href: "/settings/hr/audit",
    icon: "receipt_long",
    color: "text-neutral-600",
    bg: "bg-neutral-100",
    border: "border-neutral-200",
    badge: "Phase 3",
  },
];

export default function HrSettingsDashboard() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <ModulePageHeader
        title={t("settings.hr.home.title")}
        subtitle={t("settings.hr.home.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.admin", href: "/admin" }, { label: t("settings.hr.home.breadcrumb") }]} />}
      />

      {/* Governance notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex gap-3">
        <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5 shrink-0">policy</span>
        <div>
          <p className="text-sm font-medium text-amber-800">{t("settings.hr.home.noticeTitle")}</p>
          <p className="text-sm text-amber-700 mt-0.5">
            {t("settings.hr.home.noticeBody")}
          </p>
        </div>
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((item) => (
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
                    {t(item.title)}
                  </span>
                  {item.badge && (
                    <span className={
                      item.badge === "Core"
                        ? "text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                        : item.badge === "Phase 2"
                        ? "text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
                        : "text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500"
                    }>
                      {t(BADGE_KEYS[item.badge] ?? item.badge)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{t(item.description)}</p>
              </div>
            </Link>
        ))}
      </div>
    </div>
  );
}
