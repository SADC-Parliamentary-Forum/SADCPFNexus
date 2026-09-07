"use client";

import type { ReactNode } from "react";
import { RegisterShell } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export function AuditPageShell({
  title,
  subtitle,
  actions,
  loading,
  emptyTitle,
  emptyDescription,
  isEmpty,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  isEmpty?: boolean;
  children?: ReactNode;
}) {
  return (
    <RegisterShell
      title={title}
      subtitle={subtitle}
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: "audit.hub", href: "/audit" },
            { label: title },
          ]}
        />
      }
      actions={actions}
      loading={loading}
      empty={
        !loading && isEmpty && emptyTitle ? (
          <EmptyState icon="policy" title={emptyTitle} description={emptyDescription} />
        ) : undefined
      }
    >
      {children}
    </RegisterShell>
  );
}

export function AuditTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2.5">{t(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AuditRowActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}
