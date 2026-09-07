"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { FormSection } from "@/components/ui/FormSection";
import { AuditPageShell, AuditTable } from "@/components/audit/AuditChrome";

export default function AuditQaPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "qa"],
    queryFn: async () => (await auditApi.listQaReviews({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];
  const [outcome, setOutcome] = useState("satisfactory");
  const [summary, setSummary] = useState("");

  const create = useMutation({
    mutationFn: () =>
      auditApi.createQaReview({
        review_type: "engagement_qa",
        outcome,
        findings_summary: summary || "QA peer review recorded",
      }),
    onSuccess: () => {
      setSummary("");
      qc.invalidateQueries({ queryKey: ["audit", "qa"] });
    },
  });

  return (
    <AuditPageShell
      title="audit.qa.title"
      subtitle="audit.qa.subtitle"
      loading={isLoading}
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <div className="space-y-5">
        <FormSection title="audit.qa.record" icon="verified">
          <div className="space-y-3">
            <div>
              <label htmlFor="audit-qa-outcome" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.qa.outcome")}</label>
              <select id="audit-qa-outcome" className="form-input w-full" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="pending">{t("audit.qa.pending")}</option>
                <option value="satisfactory">{t("audit.qa.satisfactory")}</option>
                <option value="needs_improvement">{t("audit.qa.needsImprovement")}</option>
                <option value="unsatisfactory">{t("audit.qa.unsatisfactory")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="audit-qa-summary" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.qa.summary")}</label>
              <textarea id="audit-qa-summary" className="form-input w-full" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? t("audit.qa.recording") : t("audit.qa.record")}
              </button>
            </div>
          </div>
        </FormSection>

        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("audit.qa.empty")}</p>
        ) : (
          <AuditTable columns={["audit.col.type", "audit.col.outcome", "audit.col.summary"]}>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-neutral-100">
                <td className="px-3 py-2.5">{String(r.review_type)}</td>
                <td className="px-3 py-2.5">{String(r.outcome)}</td>
                <td className="px-3 py-2.5">{String(r.findings_summary ?? "—")}</td>
              </tr>
            ))}
          </AuditTable>
        )}
      </div>
    </AuditPageShell>
  );
}
