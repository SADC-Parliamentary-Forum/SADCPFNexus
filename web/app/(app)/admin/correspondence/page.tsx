"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";

const correspondenceSettings = [
  {
    title: "Subject Files",
    description: "Maintain file codes and subject-file structure for registry classification.",
    href: "/correspondence/subject-files",
    icon: "folder_managed",
  },
  {
    title: "Letterhead",
    description: "Configure official correspondence branding and letterhead templates.",
    href: "/correspondence/letterhead",
    icon: "branding_watermark",
  },
  {
    title: "Retention Rules",
    description: "Manage retention periods and disposal controls for correspondence records.",
    href: "/correspondence/retention",
    icon: "policy",
  },
  {
    title: "Contacts",
    description: "Maintain organisation contacts used in correspondence workflows.",
    href: "/correspondence/contacts",
    icon: "contacts",
  },
  {
    title: "Registry",
    description: "Review the correspondence registry and reference-number sequence.",
    href: "/correspondence/registry",
    icon: "mark_email_read",
  },
];

export default function AdminCorrespondencePage() {
  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Correspondence Settings"
        subtitle="Registry configuration, file codes, retention controls, and correspondence templates."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Correspondence Settings" },
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
                {item.title}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {item.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
