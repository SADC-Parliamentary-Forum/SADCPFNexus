"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { financeApi, lookupsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { useFormDraft } from "@/lib/useFormDraft";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type AdvanceTypeOption = { value: string; label: string; desc?: string; icon?: string };

type EligibilityResult = {
  eligible: boolean;
  reason?: string;
  net_salary: number | null;
  gross_salary: number | null;
  max_eligible: number | null;
  salary_basis?: string;
  payslip: { id: number; period_month: number; period_year: number; currency: string } | null;
  exposure?: {
    has_outstanding_balance: boolean;
    outstanding_balance: number;
    has_active_advance: boolean;
    blocked: boolean;
    reasons: string[];
    active_advance?: { id: number; reference_number: string; status: string; amount: number } | null;
  };
  policy?: { recovery_rule: string; max_salary_percentage: number; salary_basis: string };
  intended_recovery_payroll_date?: string;
};

const STEPS = [
  { id: 0, label: "salaryAdvances.create.step.eligibility", icon: "assignment_turned_in" },
  { id: 1, label: "salaryAdvances.create.step.amount",      icon: "payments" },
  { id: 2, label: "salaryAdvances.create.step.review",      icon: "draw" },
];

export default function SalaryAdvanceCreatePage() {
  const router = useRouter();
  const toast = useToast();
  const { t, localeTag } = useI18n();
  const [step, setStep] = useState(0);

  // Data from API
  const [advanceTypes, setAdvanceTypes]     = useState<AdvanceTypeOption[]>([]);
  const [eligibility, setEligibility]       = useState<EligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);

  // Form fields
  const [advanceType, setAdvanceType]         = useState("");
  const [amount, setAmount]                   = useState("");
  const [repaymentMonths] = useState("1");
  const [purpose, setPurpose]                 = useState("");
  const [justification, setJustification]     = useState("");
  const [consented, setConsented]             = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Autosave the request locally (never the deduction consent, which must be
  // given afresh). Once created, a retry submits the same advance instead of
  // creating another one.
  const draftValue = useMemo(
    () => ({ step: Math.min(step, 1), advanceType, amount, purpose, justification }),
    [step, advanceType, amount, purpose, justification],
  );
  const draft = useFormDraft("salary-advance.create", draftValue);
  const createdIdRef = useRef<number | null>(null);
  const restoreDraft = () => {
    const v = draft.restore();
    if (!v) return;
    setAdvanceType(v.advanceType ?? "");
    setAmount(v.amount ?? "");
    setPurpose(v.purpose ?? "");
    setJustification(v.justification ?? "");
    setStep(v.advanceType ? Math.min(Math.max(v.step ?? 0, 0), 1) : 0);
  };

  const defaultCurrency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";
  const currencySymbol  = defaultCurrency === "NAD" ? "N$" : defaultCurrency;

  useEffect(() => {
    lookupsApi.get(["advance_types"]).then((res) => setAdvanceTypes(res.data.advance_types ?? [])).catch(() => {});
    setEligibilityLoading(true);
    financeApi.getSalaryAdvanceEligibility()
      .then((res) => setEligibility(res.data))
      .catch(() => setEligibility(null))
      .finally(() => setEligibilityLoading(false));
  }, []);

  // Derived computations — v1 policy is full EOM recovery (single payroll month)
  const amountNum        = parseFloat(amount) || 0;
  const isFullEom        = (eligibility?.policy?.recovery_rule ?? "full_eom") === "full_eom";
  const monthsNum        = isFullEom ? 1 : (parseInt(repaymentMonths) || 1);
  const netSalary        = eligibility?.net_salary ?? null;
  const maxEligible      = eligibility?.max_eligible ?? null;
  const monthlyDeduction = monthsNum > 0 && amountNum > 0 ? amountNum / monthsNum : 0;
  const exceedsMax       = maxEligible != null && amountNum > maxEligible;
  const percentOfMax     = maxEligible != null && maxEligible > 0 ? Math.min((amountNum / maxEligible) * 100, 100) : 0;
  const payslipLabel     = eligibility?.payslip
    ? eligibility.payslip.period_month >= 1 && eligibility.payslip.period_month <= 12
      ? new Date(eligibility.payslip.period_year, eligibility.payslip.period_month - 1, 1).toLocaleDateString(localeTag, { month: "short", year: "numeric" })
      : `${eligibility.payslip.period_month} ${eligibility.payslip.period_year}`
    : null;
  const recoveryLabel = eligibility?.intended_recovery_payroll_date
    ? new Date(eligibility.intended_recovery_payroll_date).toLocaleDateString(localeTag, {
        day: "2-digit", month: "short", year: "numeric",
      })
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        return d.toLocaleDateString(localeTag, { day: "2-digit", month: "short", year: "numeric" });
      })();

  // Validation per step
  const canProceed = () => {
    if (step === 0) return !!advanceType;
    if (step === 1) return eligibility?.eligible === true && !!amount && !!purpose && !!justification && amountNum > 0 && !exceedsMax;
    if (step === 2) return consented;
    return false;
  };

  const selectedType = advanceTypes.find((at) => at.value === advanceType);

  const handleSubmit = async (asDraft = false) => {
    if (!asDraft && !canProceed()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        advance_type:                   advanceType,
        amount:                         amountNum,
        currency:                       defaultCurrency,
        repayment_months:               monthsNum,
        purpose,
        justification,
        deduction_authority_confirmed:  consented,
      };
      const existingId = createdIdRef.current;
      const { data } = existingId
        ? await financeApi.updateAdvance(existingId, payload)
        : await financeApi.createAdvance(payload, `${draft.operationKey}:create`);
      const id = data.data?.id ?? (data as { id?: number }).id;
      if (id) createdIdRef.current = id;
      draft.clear();
      if (!asDraft && id) {
        await financeApi.submitAdvance(id, { deduction_authority_confirmed: true });
      }
      toast.success(asDraft ? t("salaryAdvances.create.toast.draftSaved") : t("salaryAdvances.create.toast.submitted"));
      router.push(id ? `/salary-advances/${id}` : "/salary-advances");
    } catch (err) {
      const message = apiErrorMessage(err, t("salaryAdvances.create.toast.submitFailed"));
      setError(message);
      toast.error(asDraft ? t("salaryAdvances.create.toast.draftNotSaved") : t("salaryAdvances.create.toast.notSubmitted"), message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 0: Eligibility & Classification ───────────────────────────────────
  const renderStep0 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{t("salaryAdvances.create.s0.title")}</h3>
        <p className="text-sm text-neutral-500 mt-0.5">
          {t("salaryAdvances.create.s0.subtitle")}
        </p>
      </div>

      {/* Eligibility indicators */}
      {eligibilityLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : !eligibility?.eligible ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5">warning</span>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {eligibility?.exposure?.blocked ? t("salaryAdvances.create.s0.blocked") : t("salaryAdvances.create.s0.notEligibleYet")}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {eligibility?.exposure?.has_outstanding_balance
                ? t("salaryAdvances.create.s0.outstanding", {
                    amount: `${currencySymbol} ${Number(eligibility.exposure.outstanding_balance).toLocaleString()}`,
                  })
                : eligibility?.exposure?.has_active_advance
                  ? t("salaryAdvances.create.s0.activeAdvance", {
                      ref: eligibility.exposure.active_advance?.reference_number ?? t("salaryAdvances.create.s0.inProgress"),
                    })
                  : eligibility?.reason === "no_confirmed_payslip"
                    ? t("salaryAdvances.create.s0.noPayslip")
                    : t("salaryAdvances.create.s0.notEligible")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>
            <div>
              <p className="text-xs font-semibold text-green-800">{t("salaryAdvances.detail.snapshot.net")}</p>
              <p className="text-[11px] text-green-600">
                {netSalary != null ? `${currencySymbol} ${netSalary.toLocaleString()}` : "—"}
                {payslipLabel ? ` (${payslipLabel})` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>
            <div>
              <p className="text-xs font-semibold text-green-800">{t("salaryAdvances.create.s0.noActive")}</p>
              <p className="text-[11px] text-green-600">{t("salaryAdvances.create.s0.accountClear")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>
            <div>
              <p className="text-xs font-semibold text-green-800">{t("salaryAdvances.create.s0.maxAdvance")}</p>
              <p className="text-[11px] text-green-600">
                {maxEligible != null ? `${currencySymbol} ${maxEligible.toLocaleString()}` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Advance type grid */}
      <div className="space-y-2">
        <p className="block text-xs font-semibold text-neutral-700">
          {t("salaryAdvances.create.s0.advanceType")} <span className="text-red-500">*</span>
        </p>
        {advanceTypes.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {advanceTypes.map((at) => (
              <button
                key={at.value}
                type="button"
                onClick={() => setAdvanceType(at.value)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                  advanceType === at.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-neutral-200 bg-white hover:border-neutral-300",
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  advanceType === at.value ? "bg-primary text-white" : "bg-primary/10 text-primary",
                )}>
                  <span className="material-symbols-outlined text-[18px]">{at.icon ?? "payments"}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{at.label}</p>
                  {at.desc && <p className="text-xs text-neutral-500 mt-0.5">{at.desc}</p>}
                </div>
                {advanceType === at.value && (
                  <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Policy summary */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-blue-700 p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[18px]">policy</span>
          <p className="text-sm font-semibold">{t("salaryAdvances.create.policy.title")}</p>
        </div>
        <ul className="text-xs opacity-90 space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">arrow_right</span>
            {t("salaryAdvances.create.policy.max")}
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">arrow_right</span>
            {t("salaryAdvances.create.policy.recovery")}
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">arrow_right</span>
            {t("salaryAdvances.create.policy.oneActive")}
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">arrow_right</span>
            {t("salaryAdvances.create.policy.chain")}
          </li>
        </ul>
      </div>
    </div>
  );

  // ─── Step 1: Amount & full EOM recovery ─────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{t("salaryAdvances.create.s1.title")}</h3>
        <p className="text-sm text-neutral-500 mt-0.5">
          {t("salaryAdvances.create.s1.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Amount */}
        <div className="space-y-1.5">
          <label htmlFor="salary-advance-create-amount" className="block text-xs font-semibold text-neutral-700">
            {t("salaryAdvances.create.s1.amount", { currency: defaultCurrency })} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">
              {currencySymbol}
            </span>
            <input
              id="salary-advance-create-amount"
              type="number" min="100" step="100"
              className={cn("form-input pl-10", exceedsMax ? "border-red-300 ring-red-200 focus:border-red-400" : "")}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {exceedsMax && (
            <p className="text-[11px] text-red-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">error</span>
              {t("salaryAdvances.create.s1.exceeds", { amount: `${currencySymbol} ${maxEligible?.toLocaleString() ?? "—"}` })}
            </p>
          )}
          {maxEligible != null && !exceedsMax && amountNum > 0 && (
            <>
              <div className="mt-1 w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${percentOfMax}%` }} />
              </div>
              <p className="text-[11px] text-neutral-400">{t("salaryAdvances.create.s1.ofMax", { percent: percentOfMax.toFixed(0) })}</p>
            </>
          )}
        </div>

        {/* Full EOM recovery */}
        <div className="space-y-1.5">
          <p className="block text-xs font-semibold text-neutral-700">{t("salaryAdvances.detail.step.recovery")}</p>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.detail.fullAmountOneMonth")}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {t("salaryAdvances.create.s1.intendedRecovery")} <span className="font-medium text-neutral-800">{recoveryLabel}</span>
            </p>
            {amountNum > 0 && (
              <p className="text-xs text-neutral-500 mt-1">
                {t("salaryAdvances.create.s1.deduction")} <span className="font-semibold text-neutral-800">{currencySymbol} {monthlyDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Purpose */}
      <div className="space-y-1.5">
        <label htmlFor="salary-advances-create-purpose" className="block text-xs font-semibold text-neutral-700">
          {t("salaryAdvances.detail.purpose")} <span className="text-red-500">*</span>
        </label>
        <input id="salary-advances-create-purpose"
          className="form-input"
          placeholder={t("salaryAdvances.create.s1.purposePlaceholder")}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
      </div>

      {/* Justification */}
      <div className="space-y-1.5">
        <label htmlFor="salary-advances-create-detailed-justification" className="block text-xs font-semibold text-neutral-700">
          {t("salaryAdvances.create.s1.justification")} <span className="text-red-500">*</span>
        </label>
        <textarea id="salary-advances-create-detailed-justification"
          rows={4}
          className="form-input resize-none"
          placeholder={t("salaryAdvances.create.s1.justificationPlaceholder")}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />
        <p className="text-[11px] text-neutral-400 text-right">{justification.length}/500</p>
      </div>

      {/* Deduction preview box */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-5">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">info</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-900 mb-3">{t("salaryAdvances.create.s1.projected")}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">{t("salaryAdvances.detail.snapshot.net")}</span>
                <span className="font-medium text-neutral-800">
                  {netSalary != null ? `${currencySymbol} ${netSalary.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">{t("salaryAdvances.create.s1.maxEligible")}</span>
                <span className="font-medium text-neutral-800">
                  {maxEligible != null ? `${currencySymbol} ${maxEligible.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">{t("salaryAdvances.create.s1.advanceAmount")}</span>
                <span className="font-medium text-neutral-800">
                  {amountNum > 0 ? `${currencySymbol} ${amountNum.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">{t("salaryAdvances.detail.step.recovery")}</span>
                <span className="font-medium text-neutral-800">{t("salaryAdvances.detail.fullAmountOneMonth")}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-primary/10 pt-2 mt-1">
                <span className="text-neutral-600 font-medium">{t("salaryAdvances.create.payrollDeduction")}</span>
                <span className="font-bold text-primary font-mono">
                  {monthlyDeduction > 0 ? `${currencySymbol} ${monthlyDeduction.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">{t("salaryAdvances.create.s1.intendedRecoveryDate")}</span>
                <span className="font-medium text-neutral-800">{recoveryLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Step 2: Review & Sign ───────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{t("salaryAdvances.create.step.review")}</h3>
        <p className="text-sm text-neutral-500 mt-0.5">
          {t("salaryAdvances.create.s2.subtitle")}
        </p>
      </div>

      {/* Summary card */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[18px]">{selectedType?.icon ?? "payments"}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">{selectedType?.label ?? advanceType}</p>
            <p className="text-xs text-neutral-500">{t("salaryAdvances.create.title")}</p>
          </div>
        </div>

        <div className="divide-y divide-neutral-100">
          {[
            { label: t("salaryAdvances.create.s2.amountRequested"), value: `${currencySymbol} ${amountNum.toLocaleString()}` },
            { label: t("salaryAdvances.detail.step.recovery"), value: t("salaryAdvances.detail.fullAmountOneMonth") },
            { label: t("salaryAdvances.create.payrollDeduction"), value: `${currencySymbol} ${monthlyDeduction.toFixed(2)}`, highlight: true },
            { label: t("salaryAdvances.create.s2.intendedRecovery"), value: recoveryLabel },
            { label: t("salaryAdvances.detail.purpose"), value: purpose },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="flex justify-between py-2.5 text-sm">
              <span className="text-neutral-500">{label}</span>
              <span className={cn("font-medium text-right max-w-[60%]", highlight ? "text-primary font-bold" : "text-neutral-800")}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {justification && (
          <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3">
            <p className="text-[11px] text-neutral-400 font-medium mb-1">{t("salaryAdvances.detail.justification")}</p>
            <p className="text-xs text-neutral-600 leading-relaxed">{justification}</p>
          </div>
        )}
      </div>

      {/* Consent checkbox */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <label htmlFor="salary-advances-create-setconsented-e-target-checked-i-authorise-full-p" className="flex items-start gap-3 cursor-pointer">
          <input id="salary-advances-create-setconsented-e-target-checked-i-authorise-full-p"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
          />
          <div>
            <p className="text-sm font-semibold text-amber-900">{t("salaryAdvances.create.s2.consentTitle")}</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              {t("salaryAdvances.create.s2.consentBody", {
                amount: `${currencySymbol} ${amountNum.toLocaleString()}`,
                date: recoveryLabel,
              })}
            </p>
          </div>
        </label>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );

  const stepContent = [renderStep0, renderStep1, renderStep2];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("salaryAdvances.create.title")}
        subtitle={t("salaryAdvances.create.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.finance", href: "/finance" },
              { label: "salaryAdvances.type.salary", href: "/salary-advances" },
              { label: "salaryAdvances.create.newRequest" },
            ]}
          />
        }
      />

      {draft.restorable && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800" role="status">
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span className="flex-1">
            {t("salaryAdvances.create.draftFound", { date: new Date(draft.restorable.savedAt).toLocaleString(localeTag) })}
          </span>
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={restoreDraft}>{t("salaryAdvances.create.restore")}</button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={draft.discard}>{t("salaryAdvances.create.discard")}</button>
        </div>
      )}

      <div className="card p-5">
        <Stepper
          steps={STEPS.map((s) => ({ label: t(s.label) }))}
          currentStep={step + 1}
        />
      </div>

      {/* Step content */}
      <div className="card p-6">
        {stepContent[step]?.()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 0 ? setStep(step - 1) : router.push("/salary-advances")}
          className="btn-secondary flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {step === 0 ? t("common.cancel") : t("common.back")}
        </button>

        <div className="flex items-center gap-2">
          {step === 2 ? (
            <>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {t("salaryAdvances.create.saveDraft")}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting || !consented}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {submitting ? t("salaryAdvances.create.submitting") : t("salaryAdvances.create.submitRequest")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="btn-primary flex items-center gap-2 disabled:opacity-40"
            >
              {t("salaryAdvances.create.nextStep")}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
