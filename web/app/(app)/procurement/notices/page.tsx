"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { noticeBoardApi } from "@/lib/api";
import { LabelledRecord } from "@/components/ui/LabelledRecord";

type Notice = {
  id?: number;
  reference_number: string;
  title: string;
  notice?: string | null;
  status: string;
  submission_deadline?: string | null;
  sealed_mode?: boolean;
};

export default function StaffNoticeBoardPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [templateKey, setTemplateKey] = useState("open_tender");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "notice-board"],
    queryFn: () => noticeBoardApi.staff().then((r) => r.data.data as Notice[]),
  });

  const templates = useQuery({
    queryKey: ["procurement", "newspaper-templates"],
    queryFn: () => noticeBoardApi.newspaperTemplates().then((r) => r.data.data),
  });

  const pack = useQuery({
    queryKey: ["procurement", "newspaper-pack", selectedId, templateKey],
    queryFn: () => noticeBoardApi.newspaperPack(selectedId as number, templateKey).then((r) => r.data.data),
    enabled: Boolean(selectedId),
  });

  const save = useMutation({
    mutationFn: () => noticeBoardApi.saveNewspaperChecklist(selectedId as number, { ticks, template_key: templateKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement", "newspaper-pack", selectedId] });
    },
  });

  const llmDraft = useMutation({
    mutationFn: () => noticeBoardApi.newspaperLlmDraft(selectedId as number, { template_key: templateKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement", "newspaper-pack", selectedId] });
    },
  });

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title="Tender Notice Board"
        subtitle="Published advertisements plus newspaper-notice templates and a human publication checklist. This never auto-awards a supplier."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Tender Notice Board" }]} />}
      />

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">Failed to load notices.</div>
      )}
      {isLoading && <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>}

      <div className="card space-y-2 p-4 text-sm" data-testid="newspaper-notice-templates">
        <p className="font-medium">Newspaper notice templates</p>
        <p className="text-neutral-600">
          Live LLM drafting stays operator-owned. Templates fill from the tender; publication ticks are human.
          Auto-award: {templates.data?.auto_award ? "on" : "off"}.
          HTTP LLM suggestion: {templates.data?.llm_live ? "configured" : "off until PROCUREMENT_NOTICE_LLM_URL is set"}.
        </p>
        <ul className="list-disc pl-5 text-neutral-700">
          {(templates.data?.templates ?? []).map((t) => (
            <li key={String(t.key)}>{String(t.label)}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {(data ?? []).map((n) => (
          <article key={n.reference_number} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{n.title}</p>
                <p className="text-xs font-mono text-neutral-500">{n.reference_number}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-500">{n.status}</span>
            </div>
            {n.notice && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{n.notice}</p>}
            <p className="text-xs text-neutral-500">
              Deadline: {n.submission_deadline ?? "—"} · Sealed: {n.sealed_mode ? "Yes" : "No"}
            </p>
            {n.id ? (
              <button type="button" className="btn-secondary text-sm" onClick={() => setSelectedId(n.id as number)}>
                Open newspaper checklist
              </button>
            ) : null}
          </article>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="card p-8 text-center text-sm text-neutral-400">No published notices.</div>
        )}
      </div>

      {pack.data ? (
        <div className="card space-y-3 p-4 text-sm" data-testid="newspaper-notice-checklist">
          <p className="font-medium">Checklist for {String(pack.data.reference_number)}</p>
          <label className="block text-sm">
            Template
            <select className="form-input mt-1" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              {(templates.data?.templates ?? []).map((t) => (
                <option key={String(t.key)} value={String(t.key)}>{String(t.label)}</option>
              ))}
            </select>
          </label>
          <pre className="whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs" data-testid="filled-newspaper-notice">{String(pack.data.filled_notice)}</pre>
          {pack.data.llm_suggestion ? (
            <pre className="whitespace-pre-wrap rounded bg-amber-50 p-3 text-xs" data-testid="llm-newspaper-suggestion">{String(pack.data.llm_suggestion)}</pre>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              data-testid="copy-filled-notice"
              onClick={async () => {
                await navigator.clipboard.writeText(String(pack.data.filled_notice));
                setCopyMsg("Filled notice copied. Publication still requires a human.");
              }}
            >
              Copy filled notice
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => window.print()}
            >
              Print
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={llmDraft.isPending || !selectedId}
              onClick={() => llmDraft.mutate()}
            >
              {llmDraft.isPending ? "Drafting…" : "Request LLM draft"}
            </button>
          </div>
          {copyMsg ? <p className="text-xs text-green-700">{copyMsg}</p> : null}
          {((pack.data.checklist as Array<Record<string, unknown>>) ?? []).map((item) => (
            <label key={String(item.key)} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(ticks[String(item.key)] ?? item.complete)}
                disabled={!item.manual}
                onChange={(e) => setTicks((prev) => ({ ...prev, [String(item.key)]: e.target.checked }))}
              />
              <span>{String(item.label)} {item.manual ? "" : "(detected)"}</span>
            </label>
          ))}
          <button type="button" className="btn-primary text-sm" disabled={save.isPending} onClick={() => save.mutate()}>
            Save human ticks
          </button>
          <LabelledRecord value={{ auto_award: pack.data.auto_award }} />
        </div>
      ) : null}
    </div>
  );
}
