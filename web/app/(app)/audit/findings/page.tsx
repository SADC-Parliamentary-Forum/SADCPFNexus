"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditPageShell, AuditTable } from "@/components/audit/AuditChrome";

export default function AuditFindingsPage() {
  useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "findings"],
    queryFn: async () => (await auditApi.listFindings({ per_page: 100 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  return (
    <AuditPageShell
      title="audit.findings.title"
      subtitle="audit.findings.subtitle"
      loading={isLoading}
      isEmpty={!isLoading && rows.length === 0}
      emptyTitle="audit.findings.empty"
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <AuditTable columns={["audit.col.reference", "audit.col.title", "audit.col.rating", "audit.col.status", "audit.col.confidentiality"]}>
        {rows.map((r) => (
          <tr key={String(r.id)} className="border-b border-neutral-100">
            <td className="px-3 py-2.5">{String(r.reference_number ?? "—")}</td>
            <td className="px-3 py-2.5">{String(r.title)}</td>
            <td className="px-3 py-2.5 capitalize">{String(r.rating ?? "—")}</td>
            <td className="px-3 py-2.5 capitalize">{String(r.status)}</td>
            <td className="px-3 py-2.5">{String(r.confidentiality_level)}</td>
          </tr>
        ))}
      </AuditTable>
    </AuditPageShell>
  );
}
