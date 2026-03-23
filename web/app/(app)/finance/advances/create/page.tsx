"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { financeApi, lookupsApi } from "@/lib/api";

type AdvanceTypeOption = { value: string; label: string; desc?: string; icon?: string };

interface FormData {
  advance_type: string;
  amount: string;
  purpose: string;
  repayment_months: string;
  justification: string;
}

export default function SalaryAdvanceCreatePage() {
  const router = useRouter();
  const [advanceTypes, setAdvanceTypes] = useState<AdvanceTypeOption[]>([]);
  const [grossSalary, setGrossSalary] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>({
    advance_type: "", amount: "", purpose: "", repayment_months: "6", justification: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    lookupsApi.get(["advance_types"]).then((res) => {
      setAdvanceTypes(res.data.advance_types ?? []);
    }).catch(() => {});
    financeApi.getSummary().then((res) => {
      setGrossSalary(res.data.current_gross_salary ?? null);
    }).catch(() => {});
  }, []);

  const defaultCurrency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";
  const maxAdvanceFromEnv = process.env.NEXT_PUBLIC_MAX_ADVANCE_AMOUNT;
  const MAX_ADVANCE = maxAdvanceFromEnv ? parseInt(maxAdvanceFromEnv, 10) : 999999;
  const amount = parseFloat(form.amount) || 0;
  const monthlyDeduction = form.repayment_months ? (amount / parseInt(form.repayment_months)).toFixed(2) : "0.00";

  const set = (f: keyof FormData, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = async (asDraft = false) => {
    if (!canSubmit && !asDraft) return;
    setSubmitting(true);
    try {
      const payload = {
        advance_type: form.advance_type,
        amount: parseFloat(form.amount) || 0,
        currency: defaultCurrency,
        repayment_months: parseInt(form.repayment_months) || 6,
        purpose: form.purpose,
        justification: form.justification,
      };
      const { data } = await financeApi.createAdvance(payload);
      const id = data.data?.id ?? (data as { id?: number }).id;
      if (!asDraft && id) await financeApi.submitAdvance(id);
      router.push("/finance");
    } catch {
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = form.advance_type && form.amount && form.purpose && form.justification;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/finance" className="hover:text-primary transition-colors">Finance</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Salary Advance Request</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Request Salary Advance</h2>
        <p className="text-sm text-gray-500 mt-0.5">Subject to policy limits and approval. Maximum advance is 3× your monthly gross.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main form */}
        <div className="flex-1 space-y-5">
          {/* Advance type */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Advance Type <span className="text-red-500">*</span></h3>
            <div className="space-y-2">
              {advanceTypes.map((t) => (
                <button key={t.value} type="button" onClick={() => set("advance_type", t.value)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${form.advance_type === t.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className={`material-symbols-outlined text-[18px] ${form.advance_type === t.value ? "text-primary" : "text-gray-400"}`}>{t.icon ?? "payments"}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                    {t.desc && <p className="text-xs text-gray-500">{t.desc}</p>}
                  </div>
                  {form.advance_type === t.value && <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Amount & repayment */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Amount & Repayment</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Amount Requested ({defaultCurrency}) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{defaultCurrency === "NAD" ? "N$" : defaultCurrency}</span>
                  <input type="number" min="100" max={MAX_ADVANCE} step="100"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)} />
                </div>
                {amount > MAX_ADVANCE && <p className="text-[11px] text-red-500">Exceeds maximum ({defaultCurrency} {MAX_ADVANCE.toLocaleString()})</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Repayment Period</label>
                <select className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.repayment_months} onChange={(e) => set("repayment_months", e.target.value)}>
                  {[3, 6, 9, 12].map((m) => <option key={m} value={m}>{m} months</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Purpose <span className="text-red-500">*</span></label>
              <input className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder="Brief description of the purpose"
                value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Detailed Justification <span className="text-red-500">*</span></label>
              <textarea rows={3}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder="Explain why this advance is necessary and how it will be used..."
                value={form.justification} onChange={(e) => set("justification", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:w-64 space-y-4">
          <div className="rounded-xl bg-white border border-gray-100 shadow-card p-4 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Repayment Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Gross Salary</span>
                <span className="font-medium text-gray-900">
                  {grossSalary != null ? `${defaultCurrency} ${grossSalary.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Advance Amount</span>
                <span className="font-medium text-gray-900">{defaultCurrency} {amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-gray-50 pt-2 mt-1">
                <span className="text-gray-500">Monthly Deduction</span>
                <span className="font-bold text-primary">{defaultCurrency} {monthlyDeduction}</span>
              </div>
            </div>
            {MAX_ADVANCE < 999999 && (
              <>
                <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${Math.min((amount / MAX_ADVANCE) * 100, 100)}%` }} />
                </div>
                <p className="text-[11px] text-gray-400">
                  {((amount / MAX_ADVANCE) * 100).toFixed(0)}% of maximum advance limit
                </p>
              </>
            )}
          </div>

          <div className="rounded-xl bg-gradient-to-br from-primary to-blue-700 p-4 text-white">
            <p className="text-xs font-semibold mb-1">Policy Limits</p>
            <ul className="text-[11px] opacity-80 space-y-1">
              <li>• Max 3× monthly gross salary</li>
              <li>• Max repayment 12 months</li>
              <li>• One active advance at a time</li>
              <li>• Subject to SG approval</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Cancel
        </Link>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(true)} disabled={submitting} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Save Draft
          </button>
          <button onClick={() => handleSubmit(false)} disabled={submitting || !canSubmit || amount > MAX_ADVANCE}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? "Submitting…" : "Submit Request"}
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
