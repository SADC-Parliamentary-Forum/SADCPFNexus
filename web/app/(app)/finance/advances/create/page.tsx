"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { financeApi, lookupsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type AdvanceTypeOption = { value: string; label: string; desc?: string; icon?: string };

type EligibilityResult = {
  eligible: boolean;
  reason?: string;
  net_salary: number | null;
  gross_salary: number | null;
  max_eligible: number | null;
  payslip: { id: number; period_month: number; period_year: number; currency: string } | null;
};

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STEPS = [
  { id: 0, label: "Eligibility",  icon: "assignment_turned_in" },
  { id: 1, label: "Schedule",     icon: "calendar_month" },
  { id: 2, label: "Review & Sign", icon: "draw" },
];

export default function SalaryAdvanceCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Data from API
  const [advanceTypes, setAdvanceTypes]     = useState<AdvanceTypeOption[]>([]);
  const [eligibility, setEligibility]       = useState<EligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);

  // Form fields
  const [advanceType, setAdvanceType]         = useState("");
  const [amount, setAmount]                   = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState("12");
  const [purpose, setPurpose]                 = useState("");
  const [justification, setJustification]     = useState("");
  const [consented, setConsented]             = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

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

  // Derived computations
  const amountNum        = parseFloat(amount) || 0;
  const monthsNum        = parseInt(repaymentMonths) || 12;
  const netSalary        = eligibility?.net_salary ?? null;
  const maxEligible      = eligibility?.max_eligible ?? null;
  const monthlyDeduction = monthsNum > 0 && amountNum > 0 ? amountNum / monthsNum : 0;
  const exceedsMax       = maxEligible != null && amountNum > maxEligible;
  const percentOfMax     = maxEligible != null && maxEligible > 0 ? Math.min((amountNum / maxEligible) * 100, 100) : 0;
  const payslipLabel     = eligibility?.payslip
    ? `${MONTH_NAMES[eligibility.payslip.period_month] ?? eligibility.payslip.period_month} ${eligibility.payslip.period_year}`
    : null;

  const nextPayDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(25);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  })();

  // Validation per step
  const canProceed = () => {
    if (step === 0) return !!advanceType;
    if (step === 1) return eligibility?.eligible === true && !!amount && !!purpose && !!justification && amountNum > 0 && !exceedsMax;
    if (step === 2) return consented;
    return false;
  };

  const selectedType = advanceTypes.find((t) => t.value === advanceType);

  const handleSubmit = async (asDraft = false) => {
    if (!asDraft && !canProceed()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        advance_type:     advanceType,
        amount:           amountNum,
        currency:         defaultCurrency,
        repayment_months: monthsNum,
        purpose,
        justification,
      };
      const { data } = await financeApi.createAdvance(payload);
      const id = data.data?.id ?? (data as { id?: number }).id;
      if (!asDraft && id) await financeApi.submitAdvance(id);
      router.push("/finance");
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 0: Eligibility & Classification ───────────────────────────────────
  const renderStep0 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">Eligibility & Classification</h3>
        <p className="text-sm text-neutral-500 mt-0.5">
          Select the advance type that matches your situation. Policy limits apply per classification.
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
            <p className="text-sm font-semibold text-amber-900">Salary Not Yet Confirmed</p>
            <p className="text-xs text-amber-700 mt-1">
              Your payslip has not been confirmed by HR. You will not be able to proceed until HR confirms your net salary.
              Please contact HR to confirm your latest payslip.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>
            <div>
              <p className="text-xs font-semibold text-green-800">Confirmed Net Salary</p>
              <p className="text-[11px] text-green-600">
                {netSalary != null ? `${currencySymbol} ${netSalary.toLocaleString()}` : "—"}
                {payslipLabel ? ` (${payslipLabel})` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>
            <div>
              <p className="text-xs font-semibold text-green-800">No Active Advance</p>
              <p className="text-[11px] text-green-600">Account is clear</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>
            <div>
              <p className="text-xs font-semibold text-green-800">Maximum Advance</p>
              <p className="text-[11px] text-green-600">
                {maxEligible != null ? `${currencySymbol} ${maxEligible.toLocaleString()}` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Advance type grid */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-neutral-700">
          Advance Type <span className="text-red-500">*</span>
        </label>
        {advanceTypes.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {advanceTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setAdvanceType(t.value)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                  advanceType === t.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-neutral-200 bg-white hover:border-neutral-300",
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  advanceType === t.value ? "bg-primary text-white" : "bg-primary/10 text-primary",
                )}>
                  <span className="material-symbols-outlined text-[18px]">{t.icon ?? "payments"}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{t.label}</p>
                  {t.desc && <p className="text-xs text-neutral-500 mt-0.5">{t.desc}</p>}
                </div>
                {advanceType === t.value && (
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
          <p className="text-sm font-semibold">Policy Limits (Class A)</p>
        </div>
        <ul className="text-xs opacity-90 space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">arrow_right</span>
            Maximum advance: 50% of confirmed net salary
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">arrow_right</span>
            Maximum repayment: 24 months
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">arrow_right</span>
            One active advance at a time
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">arrow_right</span>
            Subject to Secretary General approval
          </li>
        </ul>
      </div>
    </div>
  );

  // ─── Step 1: Amount & Payback Schedule ──────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">Amount & Repayment Schedule</h3>
        <p className="text-sm text-neutral-500 mt-0.5">
          Specify the advance amount and choose a repayment period. The deduction starts from your next pay cycle.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Amount */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-700">
            Amount ({defaultCurrency}) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">
              {currencySymbol}
            </span>
            <input
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
              Exceeds 50% of net salary ({currencySymbol} {maxEligible?.toLocaleString() ?? "—"})
            </p>
          )}
          {maxEligible != null && !exceedsMax && amountNum > 0 && (
            <>
              <div className="mt-1 w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${percentOfMax}%` }} />
              </div>
              <p className="text-[11px] text-neutral-400">{percentOfMax.toFixed(0)}% of maximum limit</p>
            </>
          )}
        </div>

        {/* Repayment period */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-700">Repayment Period</label>
          <select className="form-input" value={repaymentMonths} onChange={(e) => setRepaymentMonths(e.target.value)}>
            {[3, 6, 9, 12, 18, 24].map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </div>
      </div>

      {/* Purpose */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-neutral-700">
          Purpose <span className="text-red-500">*</span>
        </label>
        <input
          className="form-input"
          placeholder="e.g. Medical expenses, School fees, Home improvement…"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
      </div>

      {/* Justification */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-neutral-700">
          Detailed Justification <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={4}
          className="form-input resize-none"
          placeholder="Explain why this advance is necessary and how it will be used…"
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
            <p className="text-sm font-semibold text-neutral-900 mb-3">Projected Deduction Schedule</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Confirmed Net Salary</span>
                <span className="font-medium text-neutral-800">
                  {netSalary != null ? `${currencySymbol} ${netSalary.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Maximum Eligible (50%)</span>
                <span className="font-medium text-neutral-800">
                  {maxEligible != null ? `${currencySymbol} ${maxEligible.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Advance Amount</span>
                <span className="font-medium text-neutral-800">
                  {amountNum > 0 ? `${currencySymbol} ${amountNum.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Repayment Period</span>
                <span className="font-medium text-neutral-800">{monthsNum} months</span>
              </div>
              <div className="flex justify-between text-sm border-t border-primary/10 pt-2 mt-1">
                <span className="text-neutral-600 font-medium">Monthly Deduction</span>
                <span className="font-bold text-primary font-mono">
                  {monthlyDeduction > 0 ? `${currencySymbol} ${monthlyDeduction.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">First Deduction Date</span>
                <span className="font-medium text-neutral-800">{nextPayDate}</span>
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
        <h3 className="text-base font-semibold text-neutral-900">Review & Sign</h3>
        <p className="text-sm text-neutral-500 mt-0.5">
          Review your request summary. Your digital consent below authorises the Finance Department to proceed.
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
            <p className="text-xs text-neutral-500">Salary Advance Request</p>
          </div>
        </div>

        <div className="divide-y divide-neutral-100">
          {[
            { label: "Amount Requested", value: `${currencySymbol} ${amountNum.toLocaleString()}` },
            { label: "Repayment Period", value: `${monthsNum} months` },
            { label: "Monthly Deduction", value: `${currencySymbol} ${monthlyDeduction.toFixed(2)}`, highlight: true },
            { label: "First Deduction", value: nextPayDate },
            { label: "Purpose", value: purpose },
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
            <p className="text-[11px] text-neutral-400 font-medium mb-1">Justification</p>
            <p className="text-xs text-neutral-600 leading-relaxed">{justification}</p>
          </div>
        )}
      </div>

      {/* Consent checkbox */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
          />
          <div>
            <p className="text-sm font-semibold text-amber-900">I authorise the deduction of monthly instalments</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              By checking this box, I authorise the Finance Department to deduct {currencySymbol} {monthlyDeduction.toFixed(2)}{" "}
              from my salary each month beginning {nextPayDate}, for {monthsNum} consecutive pay cycles,
              until the full advance of {currencySymbol} {amountNum.toLocaleString()} is repaid.
              I understand this consent is digitally logged and irrevocable after final approval.
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/finance" className="hover:text-primary transition-colors">Finance</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/finance/advances" className="hover:text-primary transition-colors">Salary Advance</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">New Request</span>
      </div>

      {/* Page header */}
      <div>
        <h1 className="page-title">Salary Advance Request</h1>
        <p className="page-subtitle">Subject to policy limits and Secretary General approval.</p>
      </div>

      {/* Progress stepper */}
      <div className="card p-5">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all flex-shrink-0",
                step > i ? "bg-green-500 text-white" : step === i ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400",
              )}>
                {step > i ? (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                ) : (
                  <span className="text-xs">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-semibold truncate",
                  step === i ? "text-primary" : step > i ? "text-green-600" : "text-neutral-400",
                )}>
                  {s.label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-shrink-0 w-6", step > i ? "bg-green-300" : "bg-neutral-200")} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${((step) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="card p-6">
        {stepContent[step]?.()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 0 ? setStep(step - 1) : router.push("/finance/advances")}
          className="btn-secondary flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {step === 0 ? "Cancel" : "Back"}
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
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting || !consented}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="btn-primary flex items-center gap-2 disabled:opacity-40"
            >
              Next Step
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
