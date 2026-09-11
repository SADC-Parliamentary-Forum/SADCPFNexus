"use client";

import type { ReactNode } from "react";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

/** Shared chrome for /procurement/* operational lists and details. */
export function ProcurementPageHeader({
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
    { label: "nav.procurement", href: "/procurement" },
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
