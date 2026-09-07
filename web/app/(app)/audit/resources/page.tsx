"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { auditApi, tenantUsersApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { FormSection } from "@/components/ui/FormSection";
import { AuditPageShell, AuditTable } from "@/components/audit/AuditChrome";

export default function AuditResourcePage() {
  const { t } = useI18n();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit", "capacity"],
    queryFn: async () => (await auditApi.capacity()).data.data,
  });
  const usersQuery = useQuery({
    queryKey: ["tenant-users", "audit-resources"],
    queryFn: async () => (await tenantUsersApi.list()).data.data ?? [],
  });
  const [hours, setHours] = useState("40");
  const [label, setLabel] = useState("Fieldwork budget");

  const createBudget = useMutation({
    mutationFn: () => auditApi.createEffortBudget({ budget_hours: Number(hours), label }),
    onSuccess: () => refetch(),
  });

  const auditors = ((data as { auditors?: Array<Record<string, unknown>> })?.auditors) ?? [];
  const usersById = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of usersQuery.data ?? []) map.set(u.id, u.name);
    return map;
  }, [usersQuery.data]);

  return (
    <AuditPageShell
      title="audit.resources.title"
      subtitle="audit.resources.subtitle"
      loading={isLoading}
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="text-xs uppercase text-neutral-500">{t("audit.resources.totalBudget")}</div>
            <div className="mt-1 text-2xl font-semibold">{String((data as { total_budget_hours?: number })?.total_budget_hours ?? 0)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs uppercase text-neutral-500">{t("audit.resources.totalActual")}</div>
            <div className="mt-1 text-2xl font-semibold">{String((data as { total_actual_hours?: number })?.total_actual_hours ?? 0)}</div>
          </div>
        </div>

        <FormSection title="audit.resources.addBudget" icon="groups">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="audit-resource-hours" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.resources.hours")}</label>
              <input id="audit-resource-hours" className="form-input w-full" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div>
              <label htmlFor="audit-resource-label" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.resources.label")}</label>
              <input id="audit-resource-label" className="form-input w-full" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={() => createBudget.mutate()} disabled={createBudget.isPending}>
              {createBudget.isPending ? t("audit.resources.adding") : t("audit.resources.addBudget")}
            </button>
          </div>
        </FormSection>

        <AuditTable columns={["audit.col.auditor", "audit.col.budget", "audit.col.actual"]}>
          {auditors.map((a, i) => {
            const id = Number(a.auditor_user_id);
            const name = Number.isFinite(id) ? usersById.get(id) : undefined;
            return (
              <tr key={i} className="border-b border-neutral-100">
                <td className="px-3 py-2.5">{name ?? t("audit.unassigned")}</td>
                <td className="px-3 py-2.5">{String(a.budget_hours)}</td>
                <td className="px-3 py-2.5">{String(a.actual_hours)}</td>
              </tr>
            );
          })}
        </AuditTable>
      </div>
    </AuditPageShell>
  );
}
