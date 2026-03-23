"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { imprestApi, lookupsApi } from "@/lib/api";

const STEPS = ["Request Details", "Justification", "Review & Submit"];

interface FormData {
  budget_line: string;
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
  const [budgetLines, setBudgetLines] = useState<string[]>([]);
  const [form, setForm] = useState<FormData>({
    budget_line: "",
    amount_requested: "",
    currency: "USD",
    expected_liquidation_date: "",
    purpose: "",
    justification: "",
  });

  useEffect(() => {
    lookupsApi.get(["budget_lines"]).then((res) => {
      setBudgetLines(res.data.budget_lines ?? []);
    }).catch(() => {});
  }, []);

  const updateField = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canNext = () => {
    if (step === 0) return form.budget_line && form.amount_requested && form.expected_liquidation_date && form.purpose;
    return true;
  };

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      const payload = {
        budget_line: form.budget_line,
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
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <a href="/imprest" className="hover:text-primary transition-colors">Imprest</a>
          <span>/</span>
          <span className="text-gray-700 font-medium">New Request</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">New Imprest Request</h2>
        <p className="text-sm text-gray-500 mt-0.5">Initiate a new petty cash request for operational expenses.</p>
      </div>

      {/* FY Banner */}
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-medium text-amber-700">
        <span className="material-symbols-outlined text-[16px]">info</span>
        FY 2025-2026 Period Open
      </div>

      {/* Stepper */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-card p-5">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i < step ? "bg-primary text-white" :
                  i === step ? "bg-primary text-white" :
                  "bg-gray-100 text-gray-400"
                }`}>
                  {i < step ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-primary" : i < step ? "text-gray-700" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? "bg-primary" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0: Request Details */}
      {step === 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Form */}
          <div className="flex-1 rounded-xl bg-white border border-gray-100 shadow-card p-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">1</span>
              General Information
            </h3>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Budget Line <span className="text-red-500">*</span></label>
              <select
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.budget_line}
                onChange={(e) => updateField("budget_line", e.target.value)}
              >
                <option value="">Select a budget line...</option>
                {budgetLines.map((bl) => <option key={bl} value={bl}>{bl}</option>)}
              </select>
              <p className="text-[11px] text-gray-400">Funds will be reserved from this line item immediately upon approval.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">Amount Requested <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="0.00"
                    value={form.amount_requested}
                    onChange={(e) => updateField("amount_requested", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">Currency</label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="NAD">NAD</option>
                  <option value="ZAR">ZAR</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Expected Liquidation Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.expected_liquidation_date}
                onChange={(e) => updateField("expected_liquidation_date", e.target.value)}
              />
              <p className="text-[11px] text-gray-400">Must be within 5 business days of activity completion.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Purpose of Imprest <span className="text-red-500">*</span></label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder="Describe the specific need for these funds..."
                value={form.purpose}
                onChange={(e) => updateField("purpose", e.target.value)}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-64 space-y-4">
            <div className="rounded-xl bg-white border border-gray-100 shadow-card p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                Balance Check
              </h4>
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Unliquidated Balance</span>
                    <span className="material-symbols-outlined text-amber-500 text-[14px]">pending</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">$150.00</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    1 Request Outstanding
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Your Limit</span>
                    <span className="material-symbols-outlined text-primary text-[14px]">verified_user</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">$5,000.00</p>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                    <div className="bg-primary h-1 rounded-full" style={{ width: "3%" }} />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">3% utilised</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-primary to-blue-700 p-4 text-white">
              <p className="text-xs font-semibold mb-1">Need Help?</p>
              <p className="text-[11px] opacity-80 mb-3">Contact Finance for questions about budget lines or limits.</p>
              <button className="w-full rounded-md bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold transition-colors">
                Contact Finance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Justification */}
      {step === 1 && (
        <div className="rounded-xl bg-white border border-gray-100 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">2</span>
            Supporting Justification
          </h3>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Detailed Justification</label>
            <textarea
              rows={6}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
              placeholder="Provide detailed justification for this imprest request, including why alternative procurement channels are not suitable..."
              value={form.justification}
              onChange={(e) => updateField("justification", e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-blue-500 text-[16px] mt-0.5">tips_and_updates</span>
            <p className="text-xs text-blue-700">A strong justification increases the likelihood of quick approval. Include details about urgency, vendor availability, and policy compliance.</p>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="rounded-xl bg-white border border-gray-100 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">3</span>
            Review & Submit
          </h3>

          <div className="space-y-2">
            {[
              { label: "Budget Line", value: form.budget_line || "—" },
              { label: "Amount Requested", value: form.amount_requested ? `${form.currency} ${parseFloat(form.amount_requested).toLocaleString()}` : "—" },
              { label: "Liquidation Deadline", value: form.expected_liquidation_date || "—" },
              { label: "Purpose", value: form.purpose || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-start py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 flex-shrink-0 w-40">{label}</span>
                <span className="text-xs font-medium text-gray-900 text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-amber-700">Once submitted, this request will enter the approval workflow. Ensure all details are accurate before proceeding.</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
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
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next Step
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
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
