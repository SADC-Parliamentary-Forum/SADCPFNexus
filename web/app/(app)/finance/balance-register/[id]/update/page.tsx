"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { bcreApi, type BalanceRegister } from "@/lib/api";

function fmt2(n: number | string) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_OPTIONS = [
  { value: "recovery",     label: "Recovery — reduces the balance (repayment received)" },
  { value: "disbursement", label: "Disbursement — increases the balance (funds paid out)" },
  { value: "adjustment",   label: "Adjustment — manual balance correction" },
  { value: "write_off",    label: "Write-off — reduces balance (debt forgiven)" },
];

export default function UpdateBalancePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [register, setRegister] = useState<BalanceRegister | null>(null);
  const [loadingReg, setLoadingReg] = useState(true);
  const [regError, setRegError]     = useState<string | null>(null);

  // Form state
  const [txnType, setTxnType]     = useState("recovery");
  const [amount, setAmount]       = useState("");
  const [referenceDoc, setRefDoc] = useState("");
  const [notes, setNotes]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    bcreApi.get(Number(id))
      .then(res => setRegister((res.data as any).data ?? res.data))
      .catch(() => setRegError("Failed to load register."))
      .finally(() => setLoadingReg(false));
  }, [id]);

  const amountNum   = parseFloat(amount) || 0;
  const reducingTypes = ["recovery", "write_off"];
  const previewBalance = register
    ? reducingTypes.includes(txnType)
      ? Number(register.balance) - amountNum
      : Number(register.balance) + amountNum
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!register || amountNum <= 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await bcreApi.createTransaction(register.id, {
        type:          txnType,
        amount:        amountNum,
        reference_doc: referenceDoc.trim() || undefined,
        notes:         notes.trim() || undefined,
      });
      router.push(`/finance/balance-register/${register.id}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message
        ?? e?.response?.data?.errors
        ?? "Failed to record transaction.";
      setSubmitError(typeof msg === "object" ? JSON.stringify(msg) : msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingReg) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-5 bg-neutral-200 rounded w-48" />
        <div className="card p-6 h-48 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (regError || !register) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{regError ?? "Register not found."}</div>
      </div>
    );
  }

  if (register.status === "locked") {
    return (
      <div className="p-6 space-y-4">
        <nav className="text-sm text-neutral-500 flex items-center gap-1">
          <Link href="/finance/balance-register" className="hover:text-primary">Balance Register</Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <Link href={`/finance/balance-register/${register.id}`} className="hover:text-primary">{register.reference_number}</Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-neutral-800 font-medium">Add Transaction</span>
        </nav>
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined">lock</span>
          <div>
            <p className="font-medium">Register is locked</p>
            <p className="text-sm mt-0.5">No transactions can be added while the register period is locked. Contact the Finance Controller to unlock.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
        <Link href="/finance/balance-register" className="hover:text-primary">Balance Register</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href={`/finance/balance-register/${register.id}`} className="hover:text-primary">{register.reference_number}</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">Add Transaction</span>
      </nav>

      <div>
        <h1 className="page-title">Add Balance Transaction</h1>
        <p className="page-subtitle">{register.reference_number} — {register.employee?.name ?? `Employee #${register.employee_id}`}</p>
      </div>

      {/* Current balance card */}
      <div className="card p-5 bg-blue-50 border-blue-200">
        <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Current Balance</p>
        <p className="text-2xl font-bold text-blue-800">NAD {fmt2(register.balance)}</p>
        <p className="text-xs text-blue-400 mt-1">Approved: NAD {fmt2(register.approved_amount)} · Processed: NAD {fmt2(register.total_processed)}</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Transaction type */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Transaction Type <span className="text-red-500">*</span></label>
          <select
            className="form-input w-full"
            value={txnType}
            onChange={e => setTxnType(e.target.value)}
            required
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Amount (NAD) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="form-input w-full"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
          {register.installment_amount && txnType === "recovery" && (
            <p className="text-xs text-neutral-400 mt-1">
              Monthly installment: NAD {fmt2(register.installment_amount)}
            </p>
          )}
        </div>

        {/* Balance preview */}
        {amountNum > 0 && (
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-3 ${
            previewBalance < 0
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}>
            <span className="material-symbols-outlined text-base">calculate</span>
            <span>
              New balance will be: <strong>NAD {fmt2(previewBalance)}</strong>
              {previewBalance < 0 && " — amount exceeds current balance"}
            </span>
          </div>
        )}

        {/* Reference document */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Reference Document</label>
          <input
            type="text"
            className="form-input w-full"
            placeholder="e.g. Payslip PSL-2026-04 or Receipt #1234"
            value={referenceDoc}
            onChange={e => setRefDoc(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Notes</label>
          <textarea
            className="form-input w-full h-24 resize-none text-sm"
            placeholder="Optional notes about this transaction..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {submitError && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{submitError}</div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Link href={`/finance/balance-register/${register.id}`} className="btn-secondary text-sm">Cancel</Link>
          <button type="submit" disabled={submitting || amountNum <= 0}
            className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2">
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                Recording…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">add</span>
                Record Transaction
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-neutral-400 text-center">
          This transaction will be queued for checker verification before it is confirmed.
        </p>
      </form>
    </div>
  );
}
