"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { bcreApi, type BalanceRegister } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function fmt2(n: number | string) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_OPTIONS = [
  { value: "recovery",     label: "finance.bcre.txnOption.recovery" },
  { value: "disbursement", label: "finance.bcre.txnOption.disbursement" },
  { value: "adjustment",   label: "finance.bcre.txnOption.adjustment" },
  { value: "write_off",    label: "finance.bcre.txnOption.write_off" },
];

export default function UpdateBalancePage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const toast = useToast();

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
      .catch(() => setRegError(t("finance.bcre.loadFailed")))
      .finally(() => setLoadingReg(false));
  }, [id, t]);

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
      toast.success(t("finance.bcre.update.success"));
      router.push(`/finance/balance-register/${register.id}`);
    } catch (e: unknown) {
      const message = apiErrorMessage(e, t("finance.bcre.updateFailed"));
      setSubmitError(message);
      toast.error(t("finance.bcre.update.failed"), message);
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
    <div className="space-y-5">
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{regError ?? t("finance.bcre.registerNotFound")}</div>
      </div>
    );
  }

  if (register.status === "locked") {
    return (
    <div className="space-y-4">
        <nav className="text-sm text-neutral-500 flex items-center gap-1">
          <Link href="/finance/balance-register" className="hover:text-primary">{t("finance.bcre.balanceRegister")}</Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <Link href={`/finance/balance-register/${register.id}`} className="hover:text-primary">{register.reference_number}</Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-neutral-800 font-medium">{t("finance.bcre.update.crumb")}</span>
        </nav>
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined">lock</span>
          <div>
            <p className="font-medium">{t("finance.bcre.update.locked")}</p>
            <p className="text-sm mt-0.5">{t("finance.bcre.update.lockedHint")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 p-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
        <Link href="/finance/balance-register" className="hover:text-primary">{t("finance.bcre.balanceRegister")}</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href={`/finance/balance-register/${register.id}`} className="hover:text-primary">{register.reference_number}</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">{t("finance.bcre.update.crumb")}</span>
      </nav>

      <ModulePageHeader
        title="finance.bcre.update.title"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "finance.bcre.update.title" }]} />}
      />

      {/* Current balance card */}
      <div className="card p-5 bg-blue-50 border-blue-200">
        <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">{t("finance.bcre.currentBalance")}</p>
        <p className="text-2xl font-bold text-blue-800">{"NAD"} {fmt2(register.balance)}</p>
        <p className="text-xs text-blue-400 mt-1">{t("finance.bcre.update.approvedProcessed", { approved: fmt2(register.approved_amount), processed: fmt2(register.total_processed) })}</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Transaction type */}
        <div>
          <label htmlFor="bcre-txn-type" className="block text-sm font-medium text-neutral-700 mb-2">{t("finance.bcre.update.type")} <span className="text-red-500">*</span></label>
          <select
            id="bcre-txn-type"
            className="form-input w-full"
            value={txnType}
            onChange={e => setTxnType(e.target.value)}
            required
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(opt.label)}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="bcre-amount" className="block text-sm font-medium text-neutral-700 mb-2">{t("finance.bcre.update.amount")} <span className="text-red-500">*</span></label>
          <input
            id="bcre-amount"
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
              {t("finance.bcre.update.installment", { amount: fmt2(register.installment_amount) })}
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
              {t("finance.bcre.update.newBalance")} <strong>{"NAD"} {fmt2(previewBalance)}</strong>
              {previewBalance < 0 && t("finance.bcre.update.exceeds")}
            </span>
          </div>
        )}

        {/* Reference document */}
        <div>
          <label htmlFor="bcre-reference" className="block text-sm font-medium text-neutral-700 mb-2">{t("finance.bcre.update.referenceDoc")}</label>
          <input
            id="bcre-reference"
            type="text"
            className="form-input w-full"
            placeholder={t("finance.bcre.update.referencePlaceholder")}
            value={referenceDoc}
            onChange={e => setRefDoc(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="bcre-notes" className="block text-sm font-medium text-neutral-700 mb-2">{t("finance.bcre.update.notes")}</label>
          <textarea
            id="bcre-notes"
            className="form-input w-full h-24 resize-none text-sm"
            placeholder={t("finance.bcre.update.notesPlaceholder")}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {submitError && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{submitError}</div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Link href={`/finance/balance-register/${register.id}`} className="btn-secondary text-sm">{t("common.cancel")}</Link>
          <button type="submit" disabled={submitting || amountNum <= 0}
            className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2">
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                {t("finance.bcre.update.recording")}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">add</span>
                {t("finance.bcre.update.record")}
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-neutral-400 text-center">
          {t("finance.bcre.update.queuedHint")}
        </p>
      </form>
    </div>
  );
}
