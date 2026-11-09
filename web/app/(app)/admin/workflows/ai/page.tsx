"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { ObjectSummary } from "@/components/ui/ObjectSummary";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
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
      toast("success", t("admin.workflows.ai.ready"), t("admin.workflows.ai.readyDesc"));
    } catch {
      toast("error", t("admin.workflows.ai.suggestFailed"), t("admin.workflows.ai.unavailable"));
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
      toast("success", t("admin.workflows.ai.applied"), t("admin.workflows.ai.appliedDesc"));
    } catch (e: any) {
      toast("error", t("admin.workflows.ai.applyBlocked"), e?.response?.data?.message || t("admin.workflows.ai.guardPrevented"));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("admin.workflows.ai.title")}
        subtitle={t("admin.workflows.ai.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.crumb.workflows"), href: "/admin/workflows" },
              { label: t("admin.workflows.ai.crumb") },
            ]}
          />
        }
        actions={
          <Link href="/admin/workflows" className="btn-secondary text-sm">
            {t("workflows.simulate.back")}
          </Link>
        }
      />

      <FormSection title={t("admin.workflows.ai.guardStatus")} icon="shield">
        <ObjectSummary value={guards} />
      </FormSection>

      <FormSection title={t("admin.workflows.ai.request")} icon="psychology" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.workflows.ai.type")} htmlFor="suggestion-kind" required className="min-w-[260px]">
            <select
              id="suggestion-kind"
              className="form-input"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {SUGGESTION_KINDS.map((item) => (
                <option key={item} value={item}>
                  {t(`admin.workflows.ai.kind.${item}`)}
                </option>
              ))}
            </select>
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={suggest}>
            {t("admin.workflows.ai.suggest")}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={applySafe} disabled={!suggestionId(suggestion)}>
            {t("admin.workflows.ai.applyNote")}
          </button>
        </div>
      </FormSection>

      {suggestion ? (
        <FormSection title={t("admin.workflows.ai.suggestion")} icon="lightbulb">
          <ObjectSummary value={suggestion} />
        </FormSection>
      ) : null}
    </div>
  );
}
