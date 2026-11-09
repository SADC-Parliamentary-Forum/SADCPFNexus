"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function PeopleAiPage() {
  const { t } = useI18n();
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
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("people.ai.title")}
        subtitle={t("people.ai.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.ai.title") },
            ]}
          />
        }
        actions={
          <Link href="/people" className="btn-secondary text-sm">
            {t("people.common.hub")}
          </Link>
        }
      />

      <FormSection title={t("people.ai.requestSection")} icon="smart_toy" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("people.ai.kind")} htmlFor="ai-kind" className="min-w-[220px]">
            <select id="ai-kind" className="form-input" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="access_recommendation">{t("people.ai.kindAccess")}</option>
              <option value="anomalous_privilege">{t("people.ai.kindAnomalous")}</option>
              <option value="nl_org_search">{t("people.ai.kindNlSearch")}</option>
              <option value="succession_hint">{t("people.ai.kindSuccession")}</option>
              <option value="skills_gap">{t("people.ai.kindSkillsGap")}</option>
            </select>
          </FormField>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={suggest.isPending}
            onClick={() => suggest.mutate()}
          >
            {suggest.isPending ? t("people.ai.requesting") : t("people.ai.request")}
          </button>
        </div>
      </FormSection>

      {!suggestion && !suggest.isPending ? (
        <div className="card">
          <EmptyState icon="psychology" title={t("people.ai.emptyTitle")} description={t("people.ai.emptyHint")} />
        </div>
      ) : null}

      {suggestion ? (
        <FormSection title={t("people.ai.suggestion")} icon="lightbulb" dense>
          <LabelledRecord value={suggestion} />
          {suggestionId ? (
            <button
              type="button"
              className="btn-secondary mt-4 text-sm"
              disabled={apply.isPending}
              onClick={() => apply.mutate(suggestionId)}
            >
              {t("people.ai.confirmAttach")}
            </button>
          ) : null}
        </FormSection>
      ) : null}
    </div>
  );
}
