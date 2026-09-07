"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditPageShell } from "@/components/audit/AuditChrome";

export default function AuditSettingsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "settings"],
    queryFn: async () => (await auditApi.settings()).data.data,
  });
  const configured = Boolean((data as { charter_configured?: boolean } | undefined)?.charter_configured);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState("sg");

  const save = useMutation({
    mutationFn: () =>
      auditApi.updateSettings({
        charter_configured: true,
        charter_notes: notes || String((data as { charter_notes?: string })?.charter_notes ?? ""),
        plan_approval_mode: mode || String((data as { plan_approval_mode?: string })?.plan_approval_mode ?? "sg"),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit", "settings"] }),
  });

  const currentMode = String((data as { plan_approval_mode?: string })?.plan_approval_mode ?? "sg");

  return (
    <AuditPageShell
      title="audit.settings.title"
      subtitle="audit.settings.subtitle"
      loading={isLoading}
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <FormSection title="audit.settings.title" icon="settings">
        <div className="space-y-4 text-sm">
          {configured ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-medium text-emerald-800">{t("audit.settings.configured")}</div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-800">{t("audit.settings.pending")}</div>
          )}
          <p>{configured ? t("audit.settings.configuredBody") : t("audit.settings.pendingBody")}</p>
          <p>{t("audit.settings.approvalMode")}: <strong>{t(`audit.settings.mode.${currentMode}`) === `audit.settings.mode.${currentMode}` ? currentMode : t(`audit.settings.mode.${currentMode}`)}</strong></p>
          <p className="text-neutral-600">
            {(data as { charter_notes?: string })?.charter_notes ?? t("audit.settings.pending")}
          </p>
          <div>
            <label htmlFor="audit-settings-mode" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.settings.approvalMode")}</label>
            <select id="audit-settings-mode" className="form-input w-full" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="sg">{t("audit.settings.mode.sg")}</option>
              <option value="governance">{t("audit.settings.mode.governance")}</option>
              <option value="configurable">{t("audit.settings.mode.configurable")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="audit-settings-notes" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.settings.notes")}</label>
            <textarea id="audit-settings-notes" className="form-input w-full" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? t("audit.settings.saving") : t("audit.settings.save")}
            </button>
          </div>
        </div>
      </FormSection>
    </AuditPageShell>
  );
}
