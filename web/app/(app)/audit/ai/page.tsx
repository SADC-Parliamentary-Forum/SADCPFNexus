"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
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

const KINDS = [
  "workpaper_summary",
  "duplicate_findings",
  "root_cause",
  "draft_report",
  "evidence_index",
  "nl_search",
  "investigation_pack",
] as const;

export default function AuditAiAssistPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [kind, setKind] = useState("duplicate_findings");
  const [engagementId, setEngagementId] = useState("");
  const [last, setLast] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState("");

  const engagementsQuery = useQuery({
    queryKey: ["audit", "engagements", "ai-assist"],
    queryFn: async () => asRows((await auditApi.listEngagements({ per_page: 50 })).data),
  });

  const suggestion = (last?.suggestion ?? null) as Record<string, unknown> | null;
  const nextQuestions = Array.isArray(suggestion?.next_questions) ? suggestion.next_questions as string[] : [];

  const suggest = useMutation({
    mutationFn: async () => (await auditApi.aiSuggest({
      kind,
      engagement_id: engagementId ? Number(engagementId) : undefined,
    })).data.data as Record<string, unknown>,
    onSuccess: (row) => setLast(row),
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!last?.id) throw new Error("No suggestion");
      return (await auditApi.aiApply(Number(last.id), {
        action: "attach_note",
        confirmed: true,
        note: note || "Human-confirmed AI suggestion note",
      })).data.data;
    },
    onSuccess: (row) => {
      setLast(row as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  return (
    <AuditPageShell
      title="audit.ai.title"
      subtitle="audit.ai.subtitle"
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-1">
          <p>{t("audit.ai.warnConfirm")}</p>
          <p>{t("audit.ai.warnNever")}</p>
          <p>{t("audit.ai.neverCloses")}</p>
        </div>

        <FormSection title="audit.ai.generate" icon="smart_toy">
          <div className="space-y-3">
            <div>
              <label htmlFor="audit-ai-kind" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.ai.kind")}</label>
              <select id="audit-ai-kind" className="form-input w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{t(`audit.ai.kind.${k}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-ai-engagement" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.ai.engagement")}</label>
              <select
                id="audit-ai-engagement"
                className="form-input w-full"
                data-testid="audit-engagement-id"
                value={engagementId}
                onChange={(e) => setEngagementId(e.target.value)}
              >
                <option value="">{t("audit.ai.selectEngagement")}</option>
                {(engagementsQuery.data ?? []).map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>
                    {String(row.reference_number ?? row.id)} · {String(row.title ?? t("audit.engagements.title"))}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
                {suggest.isPending ? t("audit.ai.generating") : t("audit.ai.generate")}
              </button>
            </div>
          </div>
        </FormSection>

        {last && (
          <div className="card space-y-3 p-4 text-sm">
            <div>{t("audit.ai.status")}: <strong>{String(last.status)}</strong> · {t("audit.ai.provider")}: {String(last.provider)}</div>
            {nextQuestions.length > 0 ? (
              <ul className="list-disc pl-5" data-testid="audit-next-questions">
                {nextQuestions.map((q) => <li key={q}>{q}</li>)}
              </ul>
            ) : null}
            <LabelledRecord value={last.suggestion} />
            {last.status === "pending_confirmation" && (
              <>
                <div>
                  <label htmlFor="audit-ai-note" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.ai.note")}</label>
                  <input id="audit-ai-note" className="form-input w-full" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => apply.mutate()} disabled={apply.isPending}>
                    {t("audit.ai.confirm")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AuditPageShell>
  );
}
