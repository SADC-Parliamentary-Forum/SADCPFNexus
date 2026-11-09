"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { noticeBoardApi } from "@/lib/api";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const toast = useToast();
  const { t } = useI18n();
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
      toast.success(t("procurement.notices.checklistSaved"));
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.notices.checklistNotSaved"), apiErrorMessage(err, t("procurement.notices.checklistSaveFailed")));
    },
  });

  const llmDraft = useMutation({
    mutationFn: () => noticeBoardApi.newspaperLlmDraft(selectedId as number, { template_key: templateKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement", "newspaper-pack", selectedId] });
      toast.success(t("procurement.notices.draftGenerated"));
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.notices.draftNotGenerated"), apiErrorMessage(err, t("procurement.notices.draftFailed")));
    },
  });

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title={t("procurement.notices.title")}
        subtitle={t("procurement.notices.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("procurement.notices.title") }]} />}
      />

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{t("procurement.notices.loadError")}</div>
      )}
      {isLoading && <div className="card p-8 text-center text-sm text-neutral-400">{t("common.loading")}</div>}

      <div className="card space-y-2 p-4 text-sm" data-testid="newspaper-notice-templates">
        <p className="font-medium">{t("procurement.notices.templatesTitle")}</p>
        <p className="text-neutral-600">
          {t("procurement.notices.templatesHint", {
            autoAward: templates.data?.auto_award ? t("procurement.notices.on") : t("procurement.notices.off"),
            llm: templates.data?.llm_live ? t("procurement.notices.configured") : t("procurement.notices.llmOff"),
          })}
        </p>
        <ul className="list-disc pl-5 text-neutral-700">
          {(templates.data?.templates ?? []).map((tpl) => (
            <li key={String(tpl.key)}>{String(tpl.label)}</li>
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
              {t("procurement.notices.meta", { deadline: n.submission_deadline ?? "—", sealed: n.sealed_mode ? t("procurement.yes") : t("procurement.no") })}
            </p>
            {n.id ? (
              <button type="button" className="btn-secondary text-sm" onClick={() => setSelectedId(n.id as number)}>
                {t("procurement.notices.openChecklist")}
              </button>
            ) : null}
          </article>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="card">
            <EmptyState icon="campaign" title={t("procurement.notices.empty")} />
          </div>
        )}
      </div>

      {pack.data ? (
        <div className="card space-y-3 p-4 text-sm" data-testid="newspaper-notice-checklist">
          <p className="font-medium">{t("procurement.notices.checklistFor", { ref: String(pack.data.reference_number) })}</p>
          <label htmlFor="procurement-notices-template-settemplatekey-e-target-value" className="block text-sm">
            {t("procurement.notices.template")}
            <select id="procurement-notices-template-settemplatekey-e-target-value" className="form-input mt-1" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              {(templates.data?.templates ?? []).map((tpl) => (
                <option key={String(tpl.key)} value={String(tpl.key)}>{String(tpl.label)}</option>
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
                setCopyMsg(t("procurement.notices.copied"));
              }}
            >
              {t("procurement.notices.copy")}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => window.print()}
            >
              {t("common.print")}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={llmDraft.isPending || !selectedId}
              onClick={() => llmDraft.mutate()}
            >
              {llmDraft.isPending ? t("procurement.notices.drafting") : t("procurement.notices.requestDraft")}
            </button>
          </div>
          {copyMsg ? <p className="text-xs text-green-700">{copyMsg}</p> : null}
          {((pack.data.checklist as Array<Record<string, unknown>>) ?? []).map((item) => (
            <label htmlFor="procurement-notices-setticks-prev" key={String(item.key)} className="flex items-center gap-2">
              <input id="procurement-notices-setticks-prev"
                type="checkbox"
                checked={Boolean(ticks[String(item.key)] ?? item.complete)}
                disabled={!item.manual}
                onChange={(e) => setTicks((prev) => ({ ...prev, [String(item.key)]: e.target.checked }))}
              />
              <span>{String(item.label)} {item.manual ? "" : t("procurement.notices.detected")}</span>
            </label>
          ))}
          <button type="button" className="btn-primary text-sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {t("procurement.notices.saveTicks")}
          </button>
          <LabelledRecord value={{ auto_award: pack.data.auto_award }} />
        </div>
      ) : null}
    </div>
  );
}
