"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { FormField } from "@/components/ui/FormSection";

function asRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  }
  return [];
}

export default function AuditTemplatesPage() {
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
      setMsg("Template applied to the selected engagement. Human review of the report remains required.");
      qc.invalidateQueries({ queryKey: ["audit", "templates"] });
      qc.invalidateQueries({ queryKey: ["audit", "engagements"] });
    },
    onError: () => {
      setMsg(null);
      setErr("Could not apply the template. Select an engagement and a donor template.");
    },
  });

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Donor audit templates</h1>
      <p className="text-sm text-neutral-600">Template library applied to engagements/reports.</p>

      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <ul className="space-y-2 text-sm">
          {templates.map((t) => (
            <li key={String(t.id)} className="border rounded p-3 bg-white">
              <div className="font-medium">{String(t.name)} <span className="text-neutral-500">({String(t.code)})</span></div>
              <div className="text-neutral-600">{String(t.donor_name ?? "Generic")} · {String(t.applies_to)}</div>
              <p className="mt-1">{String(t.guidance ?? "")}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="border rounded p-4 bg-white space-y-3 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!engagementId || !templateId) {
            setErr("Select an engagement and a donor template.");
            return;
          }
          apply.mutate();
        }}
      >
        <FormField label="Engagement" htmlFor="audit-template-engagement" required>
          <select
            id="audit-template-engagement"
            className="form-input"
            value={engagementId}
            onChange={(e) => setEngagementId(e.target.value)}
          >
            <option value="">Select engagement</option>
            {engagements.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.reference_number ?? row.id)} · {String(row.title ?? "Engagement")}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Donor template" htmlFor="audit-template-select" required>
          <select
            id="audit-template-select"
            className="form-input"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Select template</option>
            {templates.map((t) => (
              <option key={String(t.id)} value={String(t.id)}>
                {String(t.name)} ({String(t.code)})
              </option>
            ))}
          </select>
        </FormField>
        <button type="submit" className="px-3 py-1.5 bg-neutral-900 text-white rounded" disabled={apply.isPending}>
          {apply.isPending ? "Applying…" : "Apply template"}
        </button>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-700">{err}</p>}
      </form>
    </div>
  );
}
