"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";

export default function PeopleAiPage() {
  const [kind, setKind] = useState("access_recommendation");
  const suggest = useMutation({
    mutationFn: () => peopleAuthorityApi.aiSuggest({ kind, context: {} }),
  });
  const apply = useMutation({
    mutationFn: (id: number) =>
      peopleAuthorityApi.aiApply(id, {
        action: "attach_note",
        confirmed: true,
        note: "Human confirmed note only",
      }),
  });

  const suggestion = (suggest.data?.data as { data?: Record<string, unknown> } | undefined)?.data;
  const suggestionId = suggestion?.id as number | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ModulePageHeader
        title="AI Assist"
        subtitle="Suggestions only - never auto-grants access, authority, delegation, or signing rights."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "AI Assist" },
            ]}
          />
        }
        actions={
          <Link href="/people" className="btn-secondary text-sm">
            Hub
          </Link>
        }
      />

      <FormSection title="Request a suggestion" icon="smart_toy" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Suggestion kind" htmlFor="ai-kind" className="min-w-[220px]">
            <select id="ai-kind" className="form-input" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="access_recommendation">Access recommendation</option>
              <option value="anomalous_privilege">Anomalous privilege</option>
              <option value="nl_org_search">NL org search</option>
              <option value="succession_hint">Succession hint</option>
              <option value="skills_gap">Skills gap</option>
            </select>
          </FormField>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={suggest.isPending}
            onClick={() => suggest.mutate()}
          >
            {suggest.isPending ? "Requesting…" : "Request suggestion"}
          </button>
        </div>
      </FormSection>

      {!suggestion && !suggest.isPending ? (
        <div className="card">
          <EmptyState icon="psychology" title="No suggestion yet" description="Choose a kind and request a suggestion." />
        </div>
      ) : null}

      {suggestion ? (
        <FormSection title="Suggestion" icon="lightbulb" dense>
          <LabelledRecord value={suggestion} />
          {suggestionId ? (
            <button
              type="button"
              className="btn-secondary mt-4 text-sm"
              disabled={apply.isPending}
              onClick={() => apply.mutate(suggestionId)}
            >
              Confirm attach note
            </button>
          ) : null}
        </FormSection>
      ) : null}
    </div>
  );
}
