"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";

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
          <dl className="grid gap-2 text-sm">
            {Object.entries(suggestion).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-neutral-100 py-2">
                <dt className="capitalize text-neutral-500">{k.replace(/_/g, " ")}</dt>
                <dd className="max-w-[60%] text-right font-medium text-neutral-800 break-words">
                  {typeof v === "object" && v != null ? JSON.stringify(v) : String(v ?? "-")}
                </dd>
              </div>
            ))}
          </dl>
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
