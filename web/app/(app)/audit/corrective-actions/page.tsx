"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditPageShell } from "@/components/audit/AuditChrome";

export default function AuditCorrectiveActionsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "findings", "ca"],
    queryFn: async () => (await auditApi.listFindings({ per_page: 100, status: "corrective_in_progress,due_for_verification,reopened" })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  return (
    <AuditPageShell
      title="audit.corrective.title"
      subtitle="audit.corrective.subtitle"
      loading={isLoading}
      isEmpty={!isLoading && rows.length === 0}
      emptyTitle="audit.corrective.empty"
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <div className="grid grid-cols-1 gap-3">
        {rows.map((r) => (
          <div key={String(r.id)} className="card p-4">
            <p className="font-medium text-neutral-900">{String(r.reference_number)} — {String(r.title)}</p>
            <p className="mt-1 text-sm text-neutral-600">{t("audit.col.status")}: <span className="capitalize">{String(r.status)}</span></p>
          </div>
        ))}
      </div>
    </AuditPageShell>
  );
}
