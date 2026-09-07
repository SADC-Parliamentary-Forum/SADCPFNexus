"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditPageShell } from "@/components/audit/AuditChrome";

function asRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  }
  return [];
}

export default function AuditTemplatesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "templates"],
    queryFn: async () => (await auditApi.listTemplates()).data.data as Array<Record<string, unknown>>,
  });
  const engagementsQuery = useQuery({
    queryKey: ["audit", "engagements", "template-apply"],
    queryFn: async () => asRows((await auditApi.listEngagements({ per_page: 50 })).data),
  });
  const [engagementId, setEngagementId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const templates = data ?? [];
  const engagements = engagementsQuery.data ?? [];

  const apply = useMutation({
    mutationFn: () =>
      auditApi.applyTemplate({
        engagement_id: Number(engagementId),
        donor_template_id: Number(templateId),
      }),
    onSuccess: () => {
      setErr(null);
      setMsg(t("audit.templates.applied"));
      qc.invalidateQueries({ queryKey: ["audit", "templates"] });
      qc.invalidateQueries({ queryKey: ["audit", "engagements"] });
    },
    onError: () => {
      setMsg(null);
      setErr(t("audit.templates.applyError"));
    },
  });

  return (
    <AuditPageShell
      title="audit.templates.title"
      subtitle="audit.templates.subtitle"
      loading={isLoading}
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <div className="space-y-5">
        {templates.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("audit.templates.empty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {templates.map((tmpl) => (
              <li key={String(tmpl.id)} className="card p-4">
                <div className="font-medium">{String(tmpl.name)} <span className="text-neutral-500">({String(tmpl.code)})</span></div>
                <div className="text-neutral-600">{String(tmpl.donor_name ?? "Generic")} · {String(tmpl.applies_to)}</div>
                <p className="mt-1">{String(tmpl.guidance ?? "")}</p>
              </li>
            ))}
          </ul>
        )}

        <FormSection title="audit.templates.apply" icon="description">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!engagementId || !templateId) {
                setErr(t("audit.templates.applyError"));
                return;
              }
              apply.mutate();
            }}
          >
            <div>
              <label htmlFor="audit-template-engagement" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {t("audit.templates.engagement")} <span className="text-red-500">*</span>
              </label>
              <select
                id="audit-template-engagement"
                className="form-input w-full"
                value={engagementId}
                onChange={(e) => setEngagementId(e.target.value)}
              >
                <option value="">{t("audit.templates.selectEngagement")}</option>
                {engagements.map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>
                    {String(row.reference_number ?? row.id)} · {String(row.title ?? t("audit.engagements.title"))}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-template-select" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {t("audit.templates.template")} <span className="text-red-500">*</span>
              </label>
              <select
                id="audit-template-select"
                className="form-input w-full"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">{t("audit.templates.selectTemplate")}</option>
                {templates.map((tmpl) => (
                  <option key={String(tmpl.id)} value={String(tmpl.id)}>
                    {String(tmpl.name)} ({String(tmpl.code)})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary text-sm" disabled={apply.isPending}>
                {apply.isPending ? t("audit.templates.applying") : t("audit.templates.apply")}
              </button>
            </div>
            {msg && <p className="text-sm text-green-700">{msg}</p>}
            {err && <p className="text-sm text-red-700">{err}</p>}
          </form>
        </FormSection>
      </div>
    </AuditPageShell>
  );
}
