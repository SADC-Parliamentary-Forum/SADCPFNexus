"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditPageShell, AuditTable } from "@/components/audit/AuditChrome";

export default function AuditUniversePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "universe"],
    queryFn: async () => (await auditApi.listUniverse({ per_page: 100 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const create = useMutation({
    mutationFn: (entityName: string) => auditApi.createUniverse({ name: entityName, entity_type: "process" }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["audit", "universe"] });
    },
  });

  return (
    <AuditPageShell
      title="audit.universe.title"
      subtitle="audit.universe.subtitle"
      loading={isLoading}
      isEmpty={!isLoading && rows.length === 0}
      emptyTitle="audit.universe.empty"
      actions={
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const entityName = name.trim();
            if (!entityName || create.isPending) return;
            create.mutate(entityName);
          }}
        >
          <label htmlFor="audit-universe-name" className="sr-only">{t("audit.universe.placeholder")}</label>
          <input
            id="audit-universe-name"
            className="form-input min-w-[12rem] flex-1 disabled:opacity-60"
            placeholder={t("audit.universe.placeholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={create.isPending}
          />
          <button
            type="submit"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={create.isPending || !name.trim()}
          >
            {create.isPending ? t("audit.universe.adding") : t("audit.universe.add")}
          </button>
        </form>
      }
    >
      <AuditTable columns={["audit.col.name", "audit.col.type", "audit.col.risk", "audit.col.status"]}>
        {rows.map((r) => (
          <tr key={String(r.id)} className="border-b border-neutral-100">
            <td className="px-3 py-2.5">{String(r.name)}</td>
            <td className="px-3 py-2.5">{String(r.entity_type)}</td>
            <td className="px-3 py-2.5">{String(r.risk_profile ?? "—")}</td>
            <td className="px-3 py-2.5 capitalize">{String(r.status)}</td>
          </tr>
        ))}
      </AuditTable>
    </AuditPageShell>
  );
}
