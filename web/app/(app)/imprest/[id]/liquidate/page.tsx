"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ReceiptLine {
  id: number;
  description: string;
  amount: string;
  receipt_date: string;
  vendor: string;
}

export default function ImprestLiquidatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [lines, setLines] = useState<ReceiptLine[]>([
    { id: 1, description: "", amount: "", receipt_date: "", vendor: "" },
  ]);
  const [notes, setNotes] = useState("");

  const approved = { amount: 850, currency: "USD", reference: "IMP-X4KD9F2A" };
  const totalSpent = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const balance = approved.amount - totalSpent;

  const addLine = () =>
    setLines((prev) => [...prev, { id: Date.now(), description: "", amount: "", receipt_date: "", vendor: "" }]);

  const removeLine = (id: number) =>
    setLines((prev) => prev.filter((l) => l.id !== id));

  const updateLine = (id: number, field: keyof ReceiptLine, value: string) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      router.push(`/imprest/${params.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <Link href="/imprest" className="hover:text-primary transition-colors">Imprest</Link>
          <span>/</span>
          <Link href={`/imprest/${params.id}`} className="hover:text-primary transition-colors font-mono">{approved.reference}</Link>
          <span>/</span>
          <span className="text-neutral-700 font-medium">Liquidate</span>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Submit Liquidation</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Record all expenditures and attach supporting receipts.</p>
      </div>

      {/* Approved amount banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-blue-500">account_balance_wallet</span>
          <div>
            <p className="text-xs text-blue-600 font-medium">Approved Imprest Amount</p>
            <p className="text-lg font-bold text-blue-800">{approved.currency} {approved.amount.toLocaleString()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-blue-600">Balance Remaining</p>
          <p className={`text-lg font-bold ${balance >= 0 ? "text-blue-800" : "text-red-600"}`}>
            {approved.currency} {balance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Receipt lines */}
      <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Expenditure Lines</h3>
          <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Add Line
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={line.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Line {i + 1}</span>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(line.id)} className="text-red-400 hover:text-red-600 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="block text-[11px] font-medium text-neutral-600">Description <span className="text-red-500">*</span></label>
                  <input
                    className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Printer toner cartridge (black)"
                    value={line.description}
                    onChange={(e) => updateLine(line.id, "description", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-neutral-600">Vendor / Supplier</label>
                  <input
                    className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Office World"
                    value={line.vendor}
                    onChange={(e) => updateLine(line.id, "vendor", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-neutral-600">Receipt Date</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    value={line.receipt_date}
                    onChange={(e) => updateLine(line.id, "receipt_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-neutral-600">Amount ({approved.currency}) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-md border border-neutral-200 bg-white pl-6 pr-2.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      placeholder="0.00"
                      value={line.amount}
                      onChange={(e) => updateLine(line.id, "amount", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Total Expenditure</span>
            <span className="font-bold text-neutral-900">{approved.currency} {totalSpent.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-neutral-200 pt-2 mt-1">
            <span className="text-neutral-500">Balance {balance >= 0 ? "to Return" : "Overspent"}</span>
            <span className={`font-bold ${balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {approved.currency} {Math.abs(balance).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">Additional Notes</h3>
        <textarea
          rows={3}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
          placeholder="Any additional remarks about this liquidation..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">warning</span>
          <p className="text-xs text-amber-700">Original receipts must be submitted to Finance within 2 business days of this digital submission.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href={`/imprest/${params.id}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting || lines.some((l) => !l.description || !l.amount)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Liquidation"}
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </div>
    </div>
  );
}
