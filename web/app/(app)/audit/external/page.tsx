"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditPageShell, AuditRowActions, AuditTable } from "@/components/audit/AuditChrome";

export default function AuditExternalPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "external"],
    queryFn: async () => (await auditApi.listExternal({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const create = useMutation({
    mutationFn: (externalTitle: string) => auditApi.createExternal({
      title: externalTitle,
      access_starts_at: new Date().toISOString().slice(0, 10),
      access_ends_at: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["audit", "external"] });
    },
  });

  return (
    <AuditPageShell
      title="audit.external.title"
      subtitle="audit.external.subtitle"
      loading={isLoading}
      isEmpty={!isLoading && rows.length === 0}
      emptyTitle="audit.external.empty"
      actions={
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const externalTitle = title.trim();
            if (!externalTitle || create.isPending) return;
            create.mutate(externalTitle);
          }}
        >
          <label htmlFor="audit-external-title" className="sr-only">{t("audit.external.placeholder")}</label>
          <input
            id="audit-external-title"
            className="form-input min-w-[12rem] flex-1 disabled:opacity-60"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("audit.external.placeholder")}
            disabled={create.isPending}
          />
          <button
            type="submit"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={create.isPending || !title.trim()}
          >
            {create.isPending ? t("audit.external.creating") : t("audit.external.create")}
          </button>
        </form>
      }
    >
      <AuditTable columns={["audit.col.title", "audit.col.firm", "audit.col.access", "audit.col.actions"]}>
        {rows.map((r) => (
          <tr key={String(r.id)} className="border-b border-neutral-100">
            <td className="px-3 py-2.5">{String(r.title)}</td>
            <td className="px-3 py-2.5">{String(r.auditor_firm ?? "—")}</td>
            <td className="px-3 py-2.5">{r.access_active ? t("audit.access.active") : t("audit.access.closed")}</td>
            <td className="px-3 py-2.5">
              <AuditRowActions>
                <button type="button" className="btn-secondary text-xs" onClick={() => auditApi.activateExternal(Number(r.id)).then(() => qc.invalidateQueries({ queryKey: ["audit", "external"] }))}>
                  {t("audit.external.activate")}
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => auditApi.revokeExternal(Number(r.id)).then(() => qc.invalidateQueries({ queryKey: ["audit", "external"] }))}>
                  {t("audit.external.revoke")}
                </button>
              </AuditRowActions>
            </td>
          </tr>
        ))}
      </AuditTable>
    </AuditPageShell>
  );
}
