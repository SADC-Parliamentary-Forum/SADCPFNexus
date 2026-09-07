"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { FormSection } from "@/components/ui/FormSection";
import { AuditPageShell, AuditTable } from "@/components/audit/AuditChrome";

export default function AuditCampaignsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "campaigns"],
    queryFn: async () => (await auditApi.listCampaigns({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];
  const [title, setTitle] = useState("");

  const create = useMutation({
    mutationFn: () =>
      auditApi.createCampaign({
        title,
        items: [{ control_title: "Sample control under test", control_ref: "CTL-1" }],
      }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["audit", "campaigns"] });
    },
  });

  return (
    <AuditPageShell
      title="audit.campaigns.title"
      subtitle="audit.campaigns.subtitle"
      loading={isLoading}
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <div className="space-y-5">
        <FormSection title="audit.campaigns.create" icon="fact_check">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="audit-campaign-title" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.col.title")}</label>
              <input id="audit-campaign-title" className="form-input w-full" placeholder={t("audit.campaigns.placeholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={!title || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("audit.campaigns.creating") : t("audit.campaigns.create")}
            </button>
          </div>
        </FormSection>

        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("audit.campaigns.empty")}</p>
        ) : (
          <AuditTable columns={["audit.col.title", "audit.col.status", "audit.col.riskLink"]}>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-neutral-100">
                <td className="px-3 py-2.5">{String(r.title)}</td>
                <td className="px-3 py-2.5 capitalize">{String(r.status)}</td>
                <td className="px-3 py-2.5">{r.risk_campaign_id ? `#${r.risk_campaign_id}` : "—"}</td>
              </tr>
            ))}
          </AuditTable>
        )}
      </div>
    </AuditPageShell>
  );
}
