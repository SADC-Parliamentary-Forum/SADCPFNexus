"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const correspondenceSettings = [
  {
    title: "admin.correspondence.subjectFiles",
    description: "admin.correspondence.subjectFilesDesc",
    href: "/correspondence/subject-files",
    icon: "folder_managed",
  },
  {
    title: "admin.correspondence.letterhead",
    description: "admin.correspondence.letterheadDesc",
    href: "/correspondence/letterhead",
    icon: "branding_watermark",
  },
  {
    title: "admin.correspondence.retention",
    description: "admin.correspondence.retentionDesc",
    href: "/correspondence/retention",
    icon: "policy",
  },
  {
    title: "admin.correspondence.contacts",
    description: "admin.correspondence.contactsDesc",
    href: "/correspondence/contacts",
    icon: "contacts",
  },
  {
    title: "admin.correspondence.registry",
    description: "admin.correspondence.registryDesc",
    href: "/correspondence/registry",
    icon: "mark_email_read",
  },
];

export default function AdminCorrespondencePage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <ModulePageHeader
        title={t("admin.correspondence.title")}
        subtitle={t("admin.correspondence.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.correspondence.title") },
            ]}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {correspondenceSettings.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card group flex min-h-[144px] flex-col justify-between p-5 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-[24px] text-sky-700">
                {item.icon}
              </span>
              <span className="material-symbols-outlined text-[20px] text-neutral-300 transition-colors group-hover:text-primary">
                arrow_forward
              </span>
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t(item.title)}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t(item.description)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
