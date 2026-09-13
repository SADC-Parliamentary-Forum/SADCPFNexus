"use client";

import type { ReactNode } from "react";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

/** Shared chrome for /settings/hr/* master-data pages. */
export function HrSettingsHeader({
  title,
  subtitle,
  actions,
  crumbs,
  meta,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  crumbs?: { label: string; href?: string }[];
  meta?: ReactNode;
}) {
  const items = crumbs ?? [
    { label: "nav.admin", href: "/admin" },
    { label: "HR Administration", href: "/settings/hr" },
    { label: title },
  ];
  return (
    <ModulePageHeader
      title={title}
      subtitle={subtitle}
      breadcrumbs={<PageBreadcrumbs items={items} />}
      actions={actions}
      meta={meta}
    />
  );
}
