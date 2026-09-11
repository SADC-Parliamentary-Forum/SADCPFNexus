"use client";

import type { ReactNode } from "react";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

/** Shared chrome for /salary-advances/* operational pages. */
export function SalaryAdvancePageHeader({
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
    { label: "nav.salary_advances", href: "/salary-advances" },
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
