"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { mandeApi } from "@/lib/api";

export default function MandeAiAssistPage() {
  const [scope, setScope] = useState("narrative_draft");
  const [context, setContext] = useState("Q2 donor indicators without actuals");
  const [last, setLast] = useState<Record<string, unknown> | null>(null);

  const draft = useMutation({
    mutationFn: () => mandeApi.aiAssist({ scope, context }).then((r) => r.data.data),
    onSuccess: (row) => setLast(row),
  });
  const confirm = useMutation({
    mutationFn: () => mandeApi.confirmAiAssist(String(last?.draft ?? "")).then((r) => r.data.data),
    onSuccess: (row) => setLast(row),
  });

  const filters = (last?.suggested_filters ?? []) as Array<{ key: string; label: string; href?: string }>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <ModulePageHeader
        title="M&E narrative assist"
        subtitle="Stub drafts and filter suggestions only. Human confirm required. Live LLM stays operator-owned (CR-8). Never auto-mutates indicators."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "M&E", href: "/mande" }, { label: "Narrative assist" }]} />}
      />
      <div className="card space-y-3 p-4 text-sm" data-testid="mande-ai-assist">
        <label className="block">
          Scope
          <select className="form-input mt-1" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="narrative_draft">Narrative draft</option>
            <option value="nl_filter_suggest">NL filter suggest</option>
            <option value="indicator_summary">Indicator summary</option>
          </select>
        </label>
        <textarea className="form-input min-h-[80px]" value={context} onChange={(e) => setContext(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => draft.mutate()} disabled={draft.isPending}>
          Generate draft
        </button>
      </div>
      {last && (
        <div className="card space-y-3 p-4 text-sm">
          <LabelledRecord value={last} />
          {filters.length > 0 ? (
            <div className="flex flex-wrap gap-2" data-testid="mande-nl-filter-hrefs">
              {filters.map((row) => (
                <Link key={row.key} href={row.href || "/mande/indicators"} className="btn-secondary text-sm">
                  Apply {row.label}
                </Link>
              ))}
            </div>
          ) : null}
          {last.requires_confirmation ? (
            <button type="button" className="btn-secondary" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              Confirm for my notes only
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
