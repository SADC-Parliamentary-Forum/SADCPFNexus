"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { correspondenceApi } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function CorrespondenceMailMergePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["correspondence-templates"],
    queryFn: () => correspondenceApi.listTemplates().then((r) => r.data.data),
  });

  const [templateId, setTemplateId] = useState<number | "">("");
  const [fieldsRaw, setFieldsRaw] = useState('{\n  "recipient_name": "",\n  "subject_matter": "",\n  "letter_date": "",\n  "signatory_name": ""\n}');
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId],
  );

  const parseFields = () => {
    try {
      return JSON.parse(fieldsRaw) as Record<string, string>;
    } catch {
      throw new Error("Fields must be valid JSON object of string values.");
    }
  };

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error("Select a template.");
      return correspondenceApi.mailMergePreview({ template_id: Number(templateId), fields: parseFields() }).then((r) => r.data.data);
    },
    onSuccess: (data) => {
      setPreview(data);
      setError(null);
    },
    onError: (e: Error) => setError(e.message || "Preview failed"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error("Select a template.");
      return correspondenceApi.mailMergeCreate({
        template_id: Number(templateId),
        fields: parseFields(),
        type: "external",
      }).then((r) => r.data.data);
    },
    onSuccess: (letter) => {
      void qc.invalidateQueries({ queryKey: ["correspondence"] });
      router.push(`/correspondence/${letter.id}`);
    },
    onError: (e: Error) => setError(e.message || "Create failed"),
  });

  const createTemplateMutation = useMutation({
    mutationFn: () =>
      correspondenceApi.createTemplate({
        name: "Acknowledgement",
        code: `ACK-${Date.now().toString().slice(-6)}`,
        subject_template: "Acknowledgement — {{subject_matter}}",
        body_template:
          "Dear {{recipient_name}},\n\nWe acknowledge receipt of {{subject_matter}} dated {{letter_date}}.\n\nYours sincerely,\n{{signatory_name}}",
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["correspondence-templates"] }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Link href="/correspondence" className="hover:text-neutral-700">Correspondence</Link>
          <span>/</span>
          <span className="text-neutral-700">Mail merge</span>
        </div>
        <h1 className="page-title">Mail merge</h1>
        <p className="page-subtitle">
          Substitute template fields into a letter draft. AI assist on letter detail requires human confirm and never auto-sends.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 text-sm">
            <span className="mb-1 block text-neutral-600">Template</span>
            <select
              className="form-input w-full"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
              disabled={isLoading}
            >
              <option value="">Select…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-secondary text-sm" onClick={() => createTemplateMutation.mutate()} disabled={createTemplateMutation.isPending}>
            Seed acknowledgement template
          </button>
        </div>

        {selected && (
          <div className="rounded bg-neutral-50 p-3 text-xs text-neutral-600">
            <p className="font-medium text-neutral-800">Subject template</p>
            <pre className="whitespace-pre-wrap">{selected.subject_template}</pre>
            <p className="mt-2 font-medium text-neutral-800">Body template</p>
            <pre className="whitespace-pre-wrap">{selected.body_template}</pre>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">Field values (JSON)</span>
          <textarea className="form-input min-h-40 w-full font-mono text-xs" value={fieldsRaw} onChange={(e) => setFieldsRaw(e.target.value)} />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
            Preview merge
          </button>
          <button type="button" className="btn-primary text-sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            Create draft letter
          </button>
        </div>

        {preview && (
          <div className="space-y-2 border-t border-neutral-100 pt-4">
            <h2 className="text-sm font-medium">Preview</h2>
            <p className="text-sm font-semibold">{preview.subject}</p>
            <pre className="whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs text-neutral-800">{preview.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
