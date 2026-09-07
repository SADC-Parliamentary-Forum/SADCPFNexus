"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  riskApi,
  tenantUsersApi,
  type RiskObjectiveOption,
  type TenantUserOption,
} from "@/lib/api";
import axios from "axios";

const CATEGORIES = [
  { value: "strategic", icon: "flag" },
  { value: "operational", icon: "settings" },
  { value: "financial", icon: "payments" },
  { value: "compliance", icon: "gavel" },
  { value: "reputational", icon: "verified_user" },
  { value: "security", icon: "security" },
  { value: "other", icon: "more_horiz" },
] as const;

const LIKELIHOODS = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
] as const;

const IMPACTS = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
] as const;

const FREQUENCIES = [
  { value: "monthly" },
  { value: "quarterly" },
  { value: "bi_annual" },
  { value: "annual" },
] as const;

function riskLevelFromScore(s: number): { key: "critical" | "high" | "medium" | "low"; cls: string } {
  if (s >= 16) return { key: "critical", cls: "text-red-700 bg-red-100 border-red-300" };
  if (s >= 11) return { key: "high", cls: "text-orange-700 bg-orange-100 border-orange-300" };
  if (s >= 6) return { key: "medium", cls: "text-yellow-700 bg-yellow-100 border-yellow-300" };
  return { key: "low", cls: "text-green-700 bg-green-100 border-green-300" };
}

function objectiveLabel(o: RiskObjectiveOption): string {
  const title = o.code ? `${o.code} — ${o.title}` : o.title;
  return o.plan_name ? `${title} (${o.plan_name})` : title;
}

export default function CreateRiskPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    likelihood: 0,
    impact: 0,
    review_frequency: "",
    next_review_date: "",
    strategic_objective_id: "",
    risk_owner_id: "",
    cause: "",
    event_description: "",
    consequence: "",
    register_scope: "department",
    is_confidential: false,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [owners, setOwners] = useState<TenantUserOption[]>([]);
  const [objectives, setObjectives] = useState<RiskObjectiveOption[]>([]);

  const score = form.likelihood * form.impact;
  const level = score > 0 ? riskLevelFromScore(score) : null;

  useEffect(() => {
    tenantUsersApi.list()
      .then((r) => setOwners(r.data.data ?? []))
      .catch(() => setOwners([]));
    riskApi.listObjectives()
      .then((r) => setObjectives(r.data.data ?? []))
      .catch(() => setObjectives([]));
  }, []);

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
  }

  async function handleSubmit(e: React.FormEvent, andSubmit = false) {
    e.preventDefault();
    setApiError(null);

    if (andSubmit) {
      const next: Record<string, string[]> = {};
      if (!form.strategic_objective_id) next.strategic_objective_id = [t("risk.create.objectiveRequired")];
      if (!form.risk_owner_id) next.risk_owner_id = [t("risk.create.ownerRequired")];
      if (Object.keys(next).length > 0) {
        setErrors((prev) => ({ ...prev, ...next }));
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.review_frequency) delete payload.review_frequency;
      if (!form.next_review_date) delete payload.next_review_date;
      if (!form.strategic_objective_id) delete payload.strategic_objective_id;
      else payload.strategic_objective_id = Number(form.strategic_objective_id);
      if (!form.risk_owner_id) delete payload.risk_owner_id;
      else payload.risk_owner_id = Number(form.risk_owner_id);
      if (!form.cause) delete payload.cause;
      if (!form.event_description) delete payload.event_description;
      if (!form.consequence) delete payload.consequence;

      const res = await riskApi.create(payload as Parameters<typeof riskApi.create>[0]);
      const created = res.data.data;

      if (andSubmit) {
        await riskApi.submit(created.id);
      }
      router.push(`/risk/${created.id}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
      } else {
        setApiError(
          axios.isAxiosError(err)
            ? err.response?.data?.message ?? t("risk.create.error")
            : t("risk.create.error"),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ModulePageHeader
        title="risk.create.title"
        subtitle="risk.create.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "risk.hub", href: "/risk" },
              { label: "risk.create.title" },
            ]}
          />
        }
      />

      {apiError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {apiError}
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
        <FormSection
          title="risk.create.section.basics"
          description="risk.create.section.basicsHint"
          icon="report"
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="risk-title" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {t("risk.create.titleLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                id="risk-title"
                className={`form-input w-full ${errors.title ? "border-red-400" : ""}`}
                placeholder={t("risk.create.titlePlaceholder")}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
              {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title[0]}</p>}
            </div>

            <div>
              <label htmlFor="risk-description" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {t("risk.create.description")} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="risk-description"
                className={`form-input w-full h-28 resize-none ${errors.description ? "border-red-400" : ""}`}
                placeholder={t("risk.create.descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
              {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description[0]}</p>}
            </div>

            <fieldset className="min-w-0">
              <legend id="risk-category-label" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {t("risk.create.category")} <span className="text-red-500">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-labelledby="risk-category-label">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c.value}
                    role="radio"
                    aria-checked={form.category === c.value}
                    onClick={() => set("category", c.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                      form.category === c.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[15px] ${form.category === c.value ? "text-primary" : "text-neutral-400"}`}>{c.icon}</span>
                    {t(`risk.create.category.${c.value}`)}
                  </button>
                ))}
              </div>
              {errors.category && <p className="text-xs text-red-600 mt-1">{errors.category[0]}</p>}
            </fieldset>
          </div>
        </FormSection>

        <FormSection
          title="risk.create.section.bowtie"
          description="risk.create.section.bowtieHint"
          icon="account_tree"
        >
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="risk-cause" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("risk.create.cause")}</label>
              <textarea id="risk-cause" className="form-input w-full h-16 resize-none" value={form.cause} onChange={(e) => set("cause", e.target.value)} />
            </div>
            <div>
              <label htmlFor="risk-event-description" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("risk.create.event")}</label>
              <textarea id="risk-event-description" className="form-input w-full h-16 resize-none" value={form.event_description} onChange={(e) => set("event_description", e.target.value)} />
            </div>
            <div>
              <label htmlFor="risk-consequence" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("risk.create.consequence")}</label>
              <textarea id="risk-consequence" className="form-input w-full h-16 resize-none" value={form.consequence} onChange={(e) => set("consequence", e.target.value)} />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="risk.create.section.scoring"
          description="risk.create.section.scoringHint"
          icon="analytics"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <fieldset className="min-w-0">
              <legend id="risk-likelihood-label" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {t("risk.create.likelihood")} <span className="text-red-500">*</span>
              </legend>
              <div className="space-y-1.5" role="radiogroup" aria-labelledby="risk-likelihood-label">
                {LIKELIHOODS.map((l) => (
                  <button
                    type="button"
                    key={l.value}
                    role="radio"
                    aria-checked={form.likelihood === l.value}
                    onClick={() => set("likelihood", l.value)}
                    className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-xs transition-all ${
                      form.likelihood === l.value
                        ? "border-primary bg-primary/5"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${form.likelihood === l.value ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>
                      {l.value}
                    </span>
                    <div className="text-left">
                      <p className="font-semibold text-neutral-800">{t(`risk.create.likelihood.${l.value}`)}</p>
                      <p className="text-neutral-400 text-[10px]">{t(`risk.create.likelihood.${l.value}.desc`)}</p>
                    </div>
                  </button>
                ))}
              </div>
              {errors.likelihood && <p className="text-xs text-red-600 mt-1">{errors.likelihood[0]}</p>}
            </fieldset>

            <fieldset className="min-w-0">
              <legend id="risk-impact-label" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {t("risk.create.impact")} <span className="text-red-500">*</span>
              </legend>
              <div className="space-y-1.5" role="radiogroup" aria-labelledby="risk-impact-label">
                {IMPACTS.map((im) => (
                  <button
                    type="button"
                    key={im.value}
                    role="radio"
                    aria-checked={form.impact === im.value}
                    onClick={() => set("impact", im.value)}
                    className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-xs transition-all ${
                      form.impact === im.value
                        ? "border-primary bg-primary/5"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${form.impact === im.value ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>
                      {im.value}
                    </span>
                    <div className="text-left">
                      <p className="font-semibold text-neutral-800">{t(`risk.create.impact.${im.value}`)}</p>
                      <p className="text-neutral-400 text-[10px]">{t(`risk.create.impact.${im.value}.desc`)}</p>
                    </div>
                  </button>
                ))}
              </div>
              {errors.impact && <p className="text-xs text-red-600 mt-1">{errors.impact[0]}</p>}
            </fieldset>
          </div>

          {score > 0 && level && (
            <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center gap-3 ${level.cls}`}>
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              <div>
                <p className="text-sm font-bold">{t("risk.create.score", { score, level: t(`risk.create.level.${level.key}`) })}</p>
                <p className="text-xs opacity-80">{t("risk.create.scoreDetail", { likelihood: form.likelihood, impact: form.impact })}</p>
              </div>
            </div>
          )}
        </FormSection>

        <FormSection
          title="risk.create.section.accountability"
          description="risk.create.section.accountabilityHint"
          icon="manage_accounts"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="risk-strategic-objective-id" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {t("risk.create.objective")}
                </label>
                <select
                  id="risk-strategic-objective-id"
                  className={`form-input w-full ${errors.strategic_objective_id ? "border-red-400" : ""}`}
                  value={form.strategic_objective_id}
                  onChange={(e) => set("strategic_objective_id", e.target.value)}
                >
                  <option value="">{t("risk.create.objectivePlaceholder")}</option>
                  {objectives.map((o) => (
                    <option key={o.id} value={o.id}>{objectiveLabel(o)}</option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">
                  {objectives.length === 0 ? t("risk.create.objectiveEmpty") : t("risk.create.objectiveHint")}
                </p>
                {errors.strategic_objective_id && <p className="text-xs text-red-600 mt-1">{errors.strategic_objective_id[0]}</p>}
              </div>
              <div>
                <label htmlFor="risk-owner-user-id" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {t("risk.create.owner")}
                </label>
                <select
                  id="risk-owner-user-id"
                  className={`form-input w-full ${errors.risk_owner_id ? "border-red-400" : ""}`}
                  value={form.risk_owner_id}
                  onChange={(e) => set("risk_owner_id", e.target.value)}
                >
                  <option value="">{t("risk.create.ownerPlaceholder")}</option>
                  {owners.map((u) => (
                    <option key={u.id} value={u.id}>{u.email ? `${u.name} (${u.email})` : u.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">{t("risk.create.ownerHint")}</p>
                {errors.risk_owner_id && <p className="text-xs text-red-600 mt-1">{errors.risk_owner_id[0]}</p>}
              </div>
            </div>

            <label htmlFor="risk-is-confidential" className="flex items-center gap-2 text-sm">
              <input id="risk-is-confidential" type="checkbox" checked={form.is_confidential} onChange={(e) => setForm((p) => ({ ...p, is_confidential: e.target.checked }))} />
              {t("risk.create.confidential")}
            </label>
          </div>
        </FormSection>

        <FormSection
          title="risk.create.section.review"
          icon="event_repeat"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="risk-review-frequency" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("risk.create.frequency")}</label>
              <select
                id="risk-review-frequency"
                className="form-input w-full"
                value={form.review_frequency}
                onChange={(e) => set("review_frequency", e.target.value)}
              >
                <option value="">{t("risk.create.frequencyPlaceholder")}</option>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{t(`risk.create.frequency.${f.value}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="risk-next-review-date" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("risk.create.nextReview")}</label>
              <input
                id="risk-next-review-date"
                type="date"
                className="form-input w-full"
                value={form.next_review_date}
                onChange={(e) => set("next_review_date", e.target.value)}
              />
            </div>
          </div>
        </FormSection>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/risk" className="btn-secondary flex-shrink-0">
            {t("common.cancel")}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-secondary flex items-center gap-1.5"
          >
            {saving ? <span className="h-4 w-4 border-2 border-neutral-400 border-t-neutral-600 rounded-full animate-spin" /> : null}
            {t("risk.create.saveDraft")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={(e) => handleSubmit(e, true)}
            className="btn-primary flex items-center gap-1.5 min-w-[12rem] flex-1 justify-center"
          >
            {saving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
              <span className="material-symbols-outlined text-[16px]">send</span>
            )}
            {t("risk.create.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
