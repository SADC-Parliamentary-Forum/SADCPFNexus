"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditTemplatesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "templates"],
    queryFn: async () => (await auditApi.listTemplates()).data.data as Array<Record<string, unknown>>,
  });
  const [engagementId, setEngagementId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const apply = useMutation({
    mutationFn: () =>
      auditApi.applyTemplate({
        engagement_id: Number(engagementId),
        donor_template_id: Number(templateId),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit", "templates"] }),
  });

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Donor audit templates</h1>
      <p className="text-sm text-neutral-600">Template library applied to engagements/reports.</p>

      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <ul className="space-y-2 text-sm">
          {(data ?? []).map((t) => (
            <li key={String(t.id)} className="border rounded p-3 bg-white">
              <div className="font-medium">{String(t.name)} <span className="text-neutral-500">({String(t.code)})</span></div>
              <div className="text-neutral-600">{String(t.donor_name ?? "Generic")} · {String(t.applies_to)}</div>
              <p className="mt-1">{String(t.guidance ?? "")}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="border rounded p-4 bg-white space-y-3 text-sm">
        <label className="block">
          Engagement ID
          <input className="mt-1 border rounded px-2 py-1 w-full" value={engagementId} onChange={(e) => setEngagementId(e.target.value)} />
        </label>
        <label className="block">
          Template ID
          <input className="mt-1 border rounded px-2 py-1 w-full" value={templateId} onChange={(e) => setTemplateId(e.target.value)} />
        </label>
        <button type="button" className="px-3 py-1.5 bg-neutral-900 text-white rounded" onClick={() => apply.mutate()} disabled={apply.isPending}>
          Apply template
        </button>
      </div>
    </div>
  );
}
