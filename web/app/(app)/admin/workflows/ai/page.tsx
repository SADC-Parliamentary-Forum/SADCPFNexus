"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { ObjectSummary } from "@/components/ui/ObjectSummary";
import { useToast } from "@/components/ui/Toast";

const SUGGESTION_KINDS = [
  "config_suggestion",
  "bottleneck_prediction",
  "approver_resolution_hint",
  "anomaly_detection",
  "policy_to_workflow_hint",
  "nl_workflow_search",
];

function suggestionId(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "number" ? id : null;
}

export default function WorkflowAiPage() {
  const { toast } = useToast();
  const [guards, setGuards] = useState<unknown>(null);
  const [kind, setKind] = useState("config_suggestion");
  const [suggestion, setSuggestion] = useState<unknown>(null);

  useEffect(() => {
    workflowEngineApi
      .aiGuards()
      .then((res) => setGuards(res.data.data))
      .catch(() => setGuards(null));
  }, []);

  const suggest = async () => {
    try {
      const res = await workflowEngineApi.aiSuggest({ kind, context: { query: "leave parallel certify" } });
      setSuggestion((res.data as { data?: unknown }).data ?? res.data);
      toast("success", "Suggestion ready", "Human confirmation required before apply.");
    } catch {
      toast("error", "Suggest failed", "AI assist unavailable.");
    }
  };

  const applySafe = async () => {
    const id = suggestionId(suggestion);
    if (!id) return;
    try {
      await workflowEngineApi.aiApply(id, {
        action: "attach_draft_note",
        confirmed: true,
        note: "Human-confirmed draft note only",
      });
      toast("success", "Applied", "Safe draft note attached. AI did not publish or approve.");
    } catch (e: any) {
      toast("error", "Apply blocked", e?.response?.data?.message || "Guard prevented unsafe action.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ModulePageHeader
        title="AI Configuration Assist"
        subtitle="Workflow suggestions with guardrails and human-confirmed application."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Workflows", href: "/admin/workflows" },
              { label: "AI Assist" },
            ]}
          />
        }
        actions={
          <Link href="/admin/workflows" className="btn-secondary text-sm">
            Back to workflows
          </Link>
        }
      />

      <FormSection title="Guard status" icon="shield">
        <ObjectSummary value={guards} />
      </FormSection>

      <FormSection title="Request suggestion" icon="psychology" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Suggestion type" htmlFor="suggestion-kind" required className="min-w-[260px]">
            <select
              id="suggestion-kind"
              className="form-input"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {SUGGESTION_KINDS.map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={suggest}>
            Suggest
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={applySafe} disabled={!suggestionId(suggestion)}>
            Apply draft note
          </button>
        </div>
      </FormSection>

      {suggestion ? (
        <FormSection title="Suggestion" icon="lightbulb">
          <ObjectSummary value={suggestion} />
        </FormSection>
      ) : null}
    </div>
  );
}
