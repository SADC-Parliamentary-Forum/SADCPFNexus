"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { imprestApi, type OrgBudgetLine } from "@/lib/api";
import BudgetLinePicker from "@/components/budget/BudgetLinePicker";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { FormSection } from "@/components/ui/FormSection";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STEPS = [
  { label: "imprest.create.step.details" },
  { label: "imprest.create.step.justification" },
  { label: "imprest.create.step.review" },
];

interface FormData {
  budget_line: string;
  budget_line_id: number | null;
  amount_requested: string;
  currency: string;
  expected_liquidation_date: string;
  purpose: string;
  justification: string;
}

export default function ImprestCreatePage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>({
    budget_line: "",
    budget_line_id: null,
    amount_requested: "",
    currency: "NAD",
    expected_liquidation_date: "",
    purpose: "",
    justification: "",
  });

  const updateField = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canNext = () => {
    if (step === 0) {
      return (
        (form.budget_line_id || form.budget_line) &&
        form.amount_requested &&
        form.expected_liquidation_date &&
        form.purpose
      );
    }
    return true;
  };

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      const payload = {
        budget_line_id: form.budget_line_id ?? undefined,
        budget_line: form.budget_line || undefined,
        amount_requested: parseFloat(form.amount_requested) || 0,
        currency: form.currency,
        expected_liquidation_date: form.expected_liquidation_date,
        purpose: form.purpose,
        justification: form.justification || undefined,
      };
      const { data } = await imprestApi.create(payload);
      const createdId = data.data?.id ?? (data as { id?: number }).id;
      if (!asDraft && createdId) {
        await imprestApi.submit(createdId);
      }
      toast.success(asDraft ? t("imprest.create.savedDraft") : t("imprest.create.submitted"));
      router.push("/imprest");
    } catch (err) {
      toast.error(
        asDraft ? t("imprest.create.notSaved") : t("imprest.create.notSubmitted"),
        apiErrorMessage(err, t("imprest.create.saveFailed")),
      );
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("imprest.create.title")}
        subtitle={t("imprest.create.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("nav.imprest"), href: "/imprest" },
              { label: t("imprest.create.crumb") },
            ]}
          />
        }
      />

      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-medium text-amber-700">
        <span className="material-symbols-outlined text-[16px]">info</span>
        {t("imprest.create.reserveBanner")}
      </div>

      <div className="card p-5">
        <Stepper steps={STEPS.map((s) => ({ label: t(s.label) }))} currentStep={step + 1} />
      </div>

      {/* Step 0: Request Details */}
      {step === 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          <FormSection title={t("imprest.create.general")} icon="edit_note" className="flex-1 space-y-5">

            <BudgetLinePicker
              value={form.budget_line_id}
              amount={form.amount_requested ? Number(form.amount_requested) : null}
              required
              label={t("imprest.create.budgetLine")}
              onChange={(lineId: number | null, line: OrgBudgetLine | null) => {
                setForm((prev) => ({
                  ...prev,
                  budget_line_id: lineId,
                  budget_line: line
                    ? `${line.code || `#${line.id}`} — ${line.name || line.category}`
                    : prev.budget_line,
                }));
              }}
            />
            <p className="text-[11px] text-neutral-400 -mt-1">{t("imprest.create.reserveHint")}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="imprest-create-amount" className="block text-xs font-medium text-neutral-700">{t("imprest.create.amountRequested")} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                  <input
                    id="imprest-create-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-7 pr-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="0.00"
                    value={form.amount_requested}
                    onChange={(e) => updateField("amount_requested", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="imprest-create-currency" className="block text-xs font-medium text-neutral-700">{t("imprest.create.currency")}</label>
                <select id="imprest-create-currency"
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                >
                  <option value="NAD">NAD</option> {/* i18n-ignore */}
                  <option value="USD">USD</option> {/* i18n-ignore */}
                  <option value="EUR">EUR</option> {/* i18n-ignore */}
                  <option value="ZAR">ZAR</option> {/* i18n-ignore */}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="imprest-create-expected-liquidation-date" className="block text-xs font-medium text-neutral-700">{t("imprest.create.liquidationDate")} <span className="text-red-500">*</span></label>
              <input id="imprest-create-expected-liquidation-date"
                type="date"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.expected_liquidation_date}
                onChange={(e) => updateField("expected_liquidation_date", e.target.value)}
              />
              <p className="text-[11px] text-neutral-400">{t("imprest.create.liquidationHint")}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="imprest-create-purpose-of-imprest" className="block text-xs font-medium text-neutral-700">{t("imprest.create.purpose")} <span className="text-red-500">*</span></label>
              <textarea id="imprest-create-purpose-of-imprest"
                rows={4}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder={t("imprest.create.purposePlaceholder")}
                value={form.purpose}
                onChange={(e) => updateField("purpose", e.target.value)}
              />
            </div>
          </FormSection>

          {/* Sidebar */}
          <div className="lg:w-64 space-y-4">
            <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 shadow-card p-4">
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                {t("imprest.create.balanceCheck")}
              </h4>
              <div className="space-y-3">
                <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-neutral-500">{t("imprest.create.unliquidated")}</span>
                    <span className="material-symbols-outlined text-amber-500 text-[14px]">pending</span>
                  </div>
                  <p className="text-lg font-bold text-neutral-900">$150.00</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {t("imprest.create.outstanding")}
                  </div>
                </div>
                <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-neutral-500">{t("imprest.create.yourLimit")}</span>
                    <span className="material-symbols-outlined text-primary text-[14px]">verified_user</span>
                  </div>
                  <p className="text-lg font-bold text-neutral-900">$5,000.00</p>
                  <div className="mt-2 w-full bg-neutral-200 rounded-full h-1 overflow-hidden">
                    <div className="bg-primary h-1 rounded-full" style={{ width: "3%" }} />
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">{t("imprest.create.utilised", { pct: 3 })}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-primary to-blue-700 p-4 text-white">
              <p className="text-xs font-semibold mb-1">{t("imprest.create.needHelp")}</p>
              <p className="text-[11px] opacity-80 mb-3">{t("imprest.create.helpText")}</p>
              <button className="w-full rounded-md bg-white dark:bg-neutral-900/20 hover:bg-white dark:bg-neutral-900/30 px-3 py-1.5 text-xs font-semibold transition-colors">
                {t("imprest.create.contactFinance")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Justification */}
      {step === 1 && (
        <FormSection title={t("imprest.create.supporting")} icon="description" className="space-y-5">

          <div className="space-y-2">
            <label htmlFor="imprest-create-detailed-justification" className="block text-xs font-medium text-neutral-700">{t("imprest.create.detailedJustification")}</label>
            <textarea id="imprest-create-detailed-justification"
              rows={6}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
              placeholder={t("imprest.create.justificationPlaceholder")}
              value={form.justification}
              onChange={(e) => updateField("justification", e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-blue-500 text-[16px] mt-0.5">tips_and_updates</span>
            <p className="text-xs text-blue-700">{t("imprest.create.justificationTip")}</p>
          </div>
        </FormSection>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <FormSection title={t("imprest.create.step.review")} icon="fact_check" className="space-y-5">

          <div className="space-y-2">
            {[
              { label: t("imprest.create.budgetLine"), value: form.budget_line || "—" },
              { label: t("imprest.certificate.amountRequested"), value: form.amount_requested ? `${form.currency} ${parseFloat(form.amount_requested).toLocaleString()}` : "—" },
              { label: t("imprest.liquidate.deadline"), value: form.expected_liquidation_date || "—" },
              { label: t("imprest.create.purposeLabel"), value: form.purpose || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-start py-2 border-b border-neutral-50">
                <span className="text-xs text-neutral-500 flex-shrink-0 w-40">{label}</span>
                <span className="text-xs font-medium text-neutral-900 text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-amber-700">{t("imprest.create.reviewNote")}</p>
          </div>
        </FormSection>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="btn-secondary text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              {t("common.back")}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {t("correspondence.create.saveDraft")}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("imprest.create.nextStep")}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {submitting ? t("imprest.create.submitting") : t("imprest.create.submit")}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
