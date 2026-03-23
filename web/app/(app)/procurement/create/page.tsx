"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STEPS = ["Item Details", "Vendor Quotes", "Review & Submit"];

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "USD";

interface Item {
  id: number;
  description: string;
  quantity: string;
  unit: string;
  estimated_unit_price: string;
}

interface Quote {
  id: number;
  vendor_name: string;
  quoted_amount: string;
  is_recommended: boolean;
  notes: string;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  procurement_method: string;
  budget_line: string;
  required_by_date: string;
  justification: string;
  items: Item[];
  quotes: Quote[];
}

export default function ProcurementCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>({
    title: "", description: "", category: "goods",
    procurement_method: "quotation", budget_line: "",
    required_by_date: "", justification: "",
    items: [{ id: 1, description: "", quantity: "1", unit: "unit", estimated_unit_price: "" }],
    quotes: [
      { id: 1, vendor_name: "", quoted_amount: "", is_recommended: false, notes: "" },
      { id: 2, vendor_name: "", quoted_amount: "", is_recommended: false, notes: "" },
      { id: 3, vendor_name: "", quoted_amount: "", is_recommended: false, notes: "" },
    ],
  });

  const set = (f: keyof FormData, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const totalEstimated = form.items.reduce((s, i) => s + (parseFloat(i.estimated_unit_price) || 0) * (parseInt(i.quantity) || 0), 0);

  const addItem = () => setForm((p) => ({ ...p, items: [...p.items, { id: Date.now(), description: "", quantity: "1", unit: "unit", estimated_unit_price: "" }] }));
  const removeItem = (id: number) => setForm((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  const updateItem = (id: number, field: keyof Item, value: string) =>
    setForm((p) => ({ ...p, items: p.items.map((i) => i.id === id ? { ...i, [field]: value } : i) }));

  const updateQuote = (id: number, field: keyof Quote, value: string | boolean) =>
    setForm((p) => ({ ...p, quotes: p.quotes.map((q) => q.id === id ? { ...q, [field]: value } : q) }));

  const setRecommended = (id: number) =>
    setForm((p) => ({ ...p, quotes: p.quotes.map((q) => ({ ...q, is_recommended: q.id === id })) }));

  const canNext = () => {
    if (step === 0) return form.title && form.description && form.category && form.items.every((i) => i.description);
    if (step === 1) return form.procurement_method === "direct" || form.quotes.filter((q) => q.vendor_name && q.quoted_amount).length >= (form.procurement_method === "quotation" ? 3 : 1);
    return true;
  };

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      router.push("/procurement");
    } finally {
      setSubmitting(false);
    }
  };

  const filledQuotes = form.quotes.filter((q) => q.vendor_name && q.quoted_amount);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/procurement" className="hover:text-primary transition-colors">Procurement</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">New Requisition</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">New Procurement Requisition</h2>
        <p className="text-sm text-gray-500 mt-0.5">Submit a request to procure goods, services, or works.</p>
      </div>

      {/* Stepper */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-card p-5">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${i < step ? "bg-primary text-white" : i === step ? "bg-primary text-white" : "bg-gray-100 text-gray-400"}`}>
                  {i < step ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-primary" : i < step ? "text-gray-700" : "text-gray-400"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${i < step ? "bg-primary" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0: Item Details */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-gray-100 shadow-card p-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900">Requisition Details</h3>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Requisition Title <span className="text-red-500">*</span></label>
              <input className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. Office Furniture for Conference Room" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Category <span className="text-red-500">*</span></label>
                <select className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" value={form.category} onChange={(e) => set("category", e.target.value)}>
                  <option value="goods">Goods</option>
                  <option value="services">Services</option>
                  <option value="works">Works</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Procurement Method</label>
                <select className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" value={form.procurement_method} onChange={(e) => set("procurement_method", e.target.value)}>
                  <option value="quotation">Three Quotes</option>
                  <option value="tender">Open Tender</option>
                  <option value="direct">Direct Award</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Budget Line</label>
                <input className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. OP-2024-EQP-001" value={form.budget_line} onChange={(e) => set("budget_line", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Required By Date</label>
                <input type="date" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" value={form.required_by_date} onChange={(e) => set("required_by_date", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Description <span className="text-red-500">*</span></label>
              <textarea rows={3} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" placeholder="Describe what is being procured and why it is needed..." value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Justification</label>
              <textarea rows={2} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" placeholder="Provide business justification for this procurement..." value={form.justification} onChange={(e) => set("justification", e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
              <button onClick={addItem} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, i) => (
                <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Item {i + 1}</span>
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-4 sm:col-span-2 space-y-1">
                      <label className="block text-[11px] font-medium text-gray-600">Description <span className="text-red-500">*</span></label>
                      <input className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Item description" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-gray-600">Qty</label>
                      <input type="number" min="1" className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-gray-600">Unit</label>
                      <input className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="unit" value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)} />
                    </div>
                    <div className="col-span-2 sm:col-span-1 space-y-1">
                      <label className="block text-[11px] font-medium text-gray-600">Unit Price</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input type="number" min="0" step="0.01" className="w-full rounded-md border border-gray-200 bg-white pl-5 pr-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="0.00" value={item.estimated_unit_price} onChange={(e) => updateItem(item.id, "estimated_unit_price", e.target.value)} />
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-end justify-end">
                      <span className="text-xs font-semibold text-primary">
                        ${((parseFloat(item.estimated_unit_price) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
              <span className="text-sm font-medium text-gray-700">Total Estimated Value</span>
              <span className="text-base font-bold text-primary">{DEFAULT_CURRENCY} {totalEstimated.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Vendor Quotes */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-gray-100 shadow-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Vendor Quotes</h3>
              {form.procurement_method === "quotation" && (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  Minimum 3 quotes required
                </span>
              )}
              {form.procurement_method === "direct" && (
                <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  Direct award — 1 vendor
                </span>
              )}
            </div>

            <div className="space-y-4">
              {form.quotes.map((quote, i) => (
                <div key={quote.id} className={`rounded-xl border p-4 space-y-3 transition-all ${quote.is_recommended ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quote {i + 1}</span>
                    {quote.is_recommended && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <span className="material-symbols-outlined text-[14px]">star</span>
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-gray-600">Vendor Name <span className="text-red-500">*</span></label>
                      <input className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. Office World Ltd" value={quote.vendor_name} onChange={(e) => updateQuote(quote.id, "vendor_name", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-gray-600">Quoted Amount ({DEFAULT_CURRENCY}) <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input type="number" min="0" step="0.01" className="w-full rounded-md border border-gray-200 bg-white pl-5 pr-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="0.00" value={quote.quoted_amount} onChange={(e) => updateQuote(quote.id, "quoted_amount", e.target.value)} />
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="block text-[11px] font-medium text-gray-600">Notes</label>
                      <input className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Delivery time, warranty, payment terms..." value={quote.notes} onChange={(e) => updateQuote(quote.id, "notes", e.target.value)} />
                    </div>
                  </div>
                  {quote.vendor_name && quote.quoted_amount && (
                    <div className="flex justify-end">
                      <button onClick={() => setRecommended(quote.id)} className={`text-xs font-semibold rounded-full px-3 py-1 border transition-colors ${quote.is_recommended ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"}`}>
                        {quote.is_recommended ? "★ Recommended" : "Recommend This"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filledQuotes.length >= 2 && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quote Comparison</p>
                <div className="space-y-2">
                  {filledQuotes.sort((a, b) => parseFloat(a.quoted_amount) - parseFloat(b.quoted_amount)).map((q, i) => (
                    <div key={q.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{i + 1}. {q.vendor_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{DEFAULT_CURRENCY} {parseFloat(q.quoted_amount).toLocaleString()}</span>
                        {i === 0 && <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Lowest</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="rounded-xl bg-white border border-gray-100 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-900">Review & Submit</h3>
          <div className="space-y-2">
            {[
              { label: "Title", value: form.title },
              { label: "Category", value: form.category },
              { label: "Method", value: form.procurement_method },
              { label: "Items", value: `${form.items.length} line item(s)` },
              { label: "Est. Value", value: `${DEFAULT_CURRENCY} ${totalEstimated.toFixed(2)}` },
              { label: "Quotes", value: `${filledQuotes.length} vendor quote(s)` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 w-32">{label}</span>
                <span className="text-xs font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-amber-700">This request will be routed through the procurement approval matrix based on the total value. Ensure all three quotes are attached before submitting.</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(true)} disabled={submitting} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">Save Draft</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Next Step
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button onClick={() => handleSubmit(false)} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit Requisition"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
