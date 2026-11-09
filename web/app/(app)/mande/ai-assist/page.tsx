"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { mandeApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// Stub drafts only, human confirm required. Never auto-mutates indicators.
export default function MandeAiAssistPage() {
  const { t } = useI18n();
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
    <div className="w-full min-w-0 space-y-4 p-6">
      <ModulePageHeader
        title={t("mande.aiAssist.title")}
        subtitle={t("mande.aiAssist.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.crumb"), href: "/mande" }, { label: t("mande.aiAssist.crumb") }]} />}
      />
      <div className="card space-y-3 p-4 text-sm" data-testid="mande-ai-assist">
        <label htmlFor="mande-ai-assist-scope-setscope-e-target-value-narrative-draft-nl" className="block">
          {t("mande.aiAssist.scope")}
          <select id="mande-ai-assist-scope-setscope-e-target-value-narrative-draft-nl" className="form-input mt-1" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="narrative_draft">{t("mande.aiAssist.narrativeDraft")}</option>
            <option value="nl_filter_suggest">{t("mande.aiAssist.nlFilter")}</option>
            <option value="indicator_summary">{t("mande.aiAssist.indicatorSummary")}</option>
          </select>
        </label>
        <textarea className="form-input min-h-[80px]" aria-label={t("mande.aiAssist.context")} value={context} onChange={(e) => setContext(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => draft.mutate()} disabled={draft.isPending}>
          {t("mande.aiAssist.generate")}
        </button>
      </div>
      {last && (
        <div className="card space-y-3 p-4 text-sm">
          <LabelledRecord value={last} />
          {filters.length > 0 ? (
            <div className="flex flex-wrap gap-2" data-testid="mande-nl-filter-hrefs">
              {filters.map((row) => (
                <Link key={row.key} href={row.href || "/mande/indicators"} className="btn-secondary text-sm">
                  {t("mande.aiAssist.apply", { label: row.label })}
                </Link>
              ))}
            </div>
          ) : null}
          {last.requires_confirmation ? (
            <button type="button" className="btn-secondary" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              {t("mande.aiAssist.confirm")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
