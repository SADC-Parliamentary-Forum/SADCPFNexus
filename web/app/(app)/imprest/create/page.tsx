"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { imprestApi, type OrgBudgetLine } from "@/lib/api";
import BudgetLinePicker from "@/components/budget/BudgetLinePicker";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { FormSection } from "@/components/ui/FormSection";

const STEPS = [
  { label: "Request Details" },
  { label: "Justification" },
  { label: "Review & Submit" },
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
      router.push("/imprest");
    } catch {
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <ModulePageHeader
        title="New Imprest Request"
        subtitle="Initiate a new petty cash request for operational expenses."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Imprest", href: "/imprest" },
              { label: "New Request" },
            ]}
          />
        }
      />

      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-medium text-amber-700">
        <span className="material-symbols-outlined text-[16px]">info</span>
        Funds reserve from the selected budget line on approval.
      </div>

      <div className="card p-5">
        <Stepper steps={STEPS} currentStep={step + 1} />
      </div>

      {/* Step 0: Request Details */}
      {step === 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          <FormSection title="General Information" icon="edit_note" className="flex-1 space-y-5">

            <BudgetLinePicker
              value={form.budget_line_id}
              amount={form.amount_requested ? Number(form.amount_requested) : null}
              required
              label="Budget Line"
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
            <p className="text-[11px] text-neutral-400 -mt-1">Funds will be reserved from this line item immediately upon approval.</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-neutral-700">Amount Requested <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                  <input
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
                <label className="block text-xs font-medium text-neutral-700">Currency</label>
                <select
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                >
                  <option value="NAD">NAD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="ZAR">ZAR</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-700">Expected Liquidation Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.expected_liquidation_date}
                onChange={(e) => updateField("expected_liquidation_date", e.target.value)}
              />
              <p className="text-[11px] text-neutral-400">Must be within 5 business days of activity completion.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-700">Purpose of Imprest <span className="text-red-500">*</span></label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder="Describe the specific need for these funds..."
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
                Balance Check
              </h4>
              <div className="space-y-3">
                <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-neutral-500">Unliquidated Balance</span>
                    <span className="material-symbols-outlined text-amber-500 text-[14px]">pending</span>
                  </div>
                  <p className="text-lg font-bold text-neutral-900">$150.00</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    1 Request Outstanding
                  </div>
                </div>
                <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-neutral-500">Your Limit</span>
                    <span className="material-symbols-outlined text-primary text-[14px]">verified_user</span>
                  </div>
                  <p className="text-lg font-bold text-neutral-900">$5,000.00</p>
                  <div className="mt-2 w-full bg-neutral-200 rounded-full h-1 overflow-hidden">
                    <div className="bg-primary h-1 rounded-full" style={{ width: "3%" }} />
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">3% utilised</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-primary to-blue-700 p-4 text-white">
              <p className="text-xs font-semibold mb-1">Need Help?</p>
              <p className="text-[11px] opacity-80 mb-3">Contact Finance for questions about budget lines or limits.</p>
              <button className="w-full rounded-md bg-white dark:bg-neutral-900/20 hover:bg-white dark:bg-neutral-900/30 px-3 py-1.5 text-xs font-semibold transition-colors">
                Contact Finance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Justification */}
      {step === 1 && (
        <FormSection title="Supporting Justification" icon="description" className="space-y-5">

          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">Detailed Justification</label>
            <textarea
              rows={6}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
              placeholder="Provide detailed justification for this imprest request, including why alternative procurement channels are not suitable..."
              value={form.justification}
              onChange={(e) => updateField("justification", e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-blue-500 text-[16px] mt-0.5">tips_and_updates</span>
            <p className="text-xs text-blue-700">A strong justification increases the likelihood of quick approval. Include details about urgency, vendor availability, and policy compliance.</p>
          </div>
        </FormSection>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <FormSection title="Review & Submit" icon="fact_check" className="space-y-5">

          <div className="space-y-2">
            {[
              { label: "Budget Line", value: form.budget_line || "—" },
              { label: "Amount Requested", value: form.amount_requested ? `${form.currency} ${parseFloat(form.amount_requested).toLocaleString()}` : "—" },
              { label: "Liquidation Deadline", value: form.expected_liquidation_date || "—" },
              { label: "Purpose", value: form.purpose || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-start py-2 border-b border-neutral-50">
                <span className="text-xs text-neutral-500 flex-shrink-0 w-40">{label}</span>
                <span className="text-xs font-medium text-neutral-900 text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-amber-700">Once submitted, this request will enter the approval workflow. Ensure all details are accurate before proceeding.</p>
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
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Save Draft
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next Step
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Request"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
