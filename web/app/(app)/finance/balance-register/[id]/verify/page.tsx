"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { bcreApi, type BalanceRegister, type BalanceTransaction } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function fmt2(n: number | string) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TXN_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  disbursement: { label: "finance.bcre.txnType.disbursement", color: "text-red-600",    icon: "arrow_outward" },
  recovery:     { label: "finance.bcre.txnType.recovery",     color: "text-green-600",  icon: "arrow_downward" },
  adjustment:   { label: "finance.bcre.txnType.adjustment",   color: "text-blue-600",   icon: "edit" },
  write_off:    { label: "finance.bcre.txnType.write_off",    color: "text-orange-600", icon: "do_not_disturb" },
};

const VERIFICATION_STATUSES = ["approved", "rejected", "correction_requested", "pending"];

function VerifyTransactionPageContent() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const searchParams  = useSearchParams();
  const txnId         = Number(searchParams.get("txn") ?? "0");
  const router        = useRouter();

  const [register, setRegister]   = useState<BalanceRegister | null>(null);
  const [txn, setTxn]             = useState<BalanceTransaction | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [verifyStatus, setVerifyStatus] = useState<"approved" | "rejected" | "correction_requested" | "">("");
  const [comments, setComments]         = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    // Get current user from localStorage
    try {
      const raw = localStorage.getItem("sadcpf_user");
      if (raw) {
        const u = JSON.parse(raw);
        setCurrentUserId(u.id);
      }
    } catch {}

    if (!txnId) {
      setError(t("finance.bcre.verify.noTxnId"));
      setLoading(false);
      return;
    }

    Promise.all([
      bcreApi.get(Number(id)),
      bcreApi.getVerification(Number(id), txnId),
    ])
      .then(([regRes, txnRes]) => {
        setRegister((regRes.data as any).data ?? regRes.data);
        setTxn((txnRes.data as any).data ?? txnRes.data);
      })
      .catch(() => setError(t("finance.bcre.verify.loadFailed")))
      .finally(() => setLoading(false));
  }, [id, txnId, t]);

  const isSelfVerification = currentUserId !== null && txn !== null && txn.created_by === currentUserId;
  const alreadyVerified    = txn && txn.verification_status !== "pending";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyStatus || !register || !txn) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await bcreApi.verify(register.id, txn.id, { status: verifyStatus, comments: comments.trim() || undefined });
      router.push(`/finance/balance-register/${register.id}`);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message ?? t("finance.bcre.verify.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-5 bg-neutral-200 rounded w-48" />
        <div className="card p-6 h-64 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error || !register || !txn) {
    return (
    <div className="space-y-5">
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error ?? t("finance.bcre.verify.notFound")}
        </div>
      </div>
    );
  }

  const tcKnown = TXN_TYPE_CONFIG[txn.type];
  const tc = tcKnown ? { ...tcKnown, label: t(tcKnown.label) } : { label: txn.type, color: "", icon: "circle" };
  const balanceIncreased = Number(txn.new_balance) > Number(txn.previous_balance);

  return (
    <div className="w-full min-w-0 p-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
        <Link href="/finance/balance-register" className="hover:text-primary">{t("finance.bcre.balanceRegister")}</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href={`/finance/balance-register/${register.id}`} className="hover:text-primary">{register.reference_number}</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">{t("finance.bcre.verify.crumb")}</span>
      </nav>

      <ModulePageHeader
        title="finance.bcre.verify.title"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "finance.bcre.verify.title" }]} />}
      />

      {/* Self-verification guard */}
      {isSelfVerification && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">warning</span>
          <div>
            <p className="font-medium">{t("finance.bcre.verify.selfTitle")}</p>
            <p className="text-sm mt-0.5">{t("finance.bcre.verify.selfHint")}</p>
          </div>
        </div>
      )}

      {/* Already verified */}
      {alreadyVerified && (
        <div className="rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-600 px-4 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined">check_circle</span>
          <p>{t("finance.bcre.verify.alreadyVerified", { status: VERIFICATION_STATUSES.includes(txn.verification_status) ? t(`finance.bcre.verification.${txn.verification_status}`) : txn.verification_status })} <Link href={`/finance/balance-register/${register.id}`} className="btn-secondary text-xs py-1 px-2">{t("finance.bcre.verify.returnToRegister")}</Link>.</p>
        </div>
      )}

      {/* Balance diff card */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4">{t("finance.bcre.verify.balanceChange")}</h3>
        <div className="grid grid-cols-3 items-center gap-3">
          <div className="text-center p-4 bg-neutral-50 rounded-xl">
            <p className="text-xs text-neutral-400 mb-1">{t("finance.bcre.verify.previous")}</p>
            <p className="text-xl font-bold text-neutral-600">{"NAD"} {fmt2(txn.previous_balance)}</p>
          </div>
          <div className="text-center">
            <div className={`inline-flex flex-col items-center gap-1 px-4 py-3 rounded-xl ${
              balanceIncreased ? "bg-red-50" : "bg-green-50"
            }`}>
              <span className={`material-symbols-outlined text-xl ${tc.color}`}>{tc.icon}</span>
              <p className={`text-sm font-bold ${tc.color}`}>{tc.label}</p>
              <p className={`text-lg font-bold ${tc.color}`}>{"NAD"} {fmt2(txn.amount)}</p>
            </div>
          </div>
          <div className="text-center p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-xs text-primary/70 mb-1">{t("finance.bcre.verify.new")}</p>
            <p className="text-xl font-bold text-primary">{"NAD"} {fmt2(txn.new_balance)}</p>
          </div>
        </div>
      </div>

      {/* Maker details */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700">{t("finance.bcre.verify.details")}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-neutral-400">{t("finance.bcre.verify.submittedBy")}</p>
            <p className="font-medium">{txn.createdBy?.name ?? `#${txn.created_by}`}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">{t("finance.bcre.verify.dateSubmitted")}</p>
            <p className="font-medium">{formatDate(txn.created_at)}</p>
          </div>
          {txn.reference_doc && (
            <div>
              <p className="text-xs text-neutral-400">{t("finance.bcre.verify.referenceDoc")}</p>
              <p className="font-medium">{txn.reference_doc}</p>
            </div>
          )}
          {txn.notes && (
            <div className="col-span-2">
              <p className="text-xs text-neutral-400">{t("finance.bcre.update.notes")}</p>
              <p className="text-sm">{txn.notes}</p>
            </div>
          )}
          {txn.supporting_document_path && (
            <div className="col-span-2">
              <p className="text-xs text-neutral-400">{t("finance.bcre.verify.supportingDoc")}</p>
              <Link href={txn.supporting_document_path} target="_blank" rel="noopener noreferrer"
                className="btn-secondary text-sm py-1 px-2 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-base">description</span>
                {t("finance.bcre.verify.viewDocument")}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Verification form */}
      {!isSelfVerification && !alreadyVerified && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-700">{t("finance.bcre.verify.decision")}</h3>

          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "approved", label: "common.approve", icon: "check_circle", bg: "bg-green-50 border-green-300 text-green-700" },
              { value: "rejected", label: "common.reject", icon: "cancel", bg: "bg-red-50 border-red-300 text-red-700" },
              { value: "correction_requested", label: "finance.bcre.verify.requestCorrection", icon: "edit_note", bg: "bg-amber-50 border-amber-300 text-amber-700" },
            ].map(opt => (
              <button key={opt.value} type="button"
                onClick={() => setVerifyStatus(opt.value as typeof verifyStatus)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all font-medium text-sm ${
                  verifyStatus === opt.value
                    ? opt.bg + " ring-2 ring-offset-1 " + (
                        opt.value === "approved" ? "ring-green-400" :
                        opt.value === "rejected" ? "ring-red-400" : "ring-amber-400"
                      )
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
                }`}>
                <span className={`material-symbols-outlined text-2xl ${verifyStatus === opt.value ? "" : "text-neutral-300"}`}>
                  {opt.icon}
                </span>
                {t(opt.label)}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="balance-register-detail-verify-comments" className="block text-sm font-medium text-neutral-700 mb-2">
              {t("finance.bcre.verify.comments")} {verifyStatus === "rejected" ? <span className="text-red-500">*</span> : t("finance.bcre.verify.optional")}
            </label>
            <textarea id="balance-register-detail-verify-comments"
              className="form-input w-full h-24 resize-none text-sm"
              placeholder={t("finance.bcre.verify.commentPlaceholder")}
              value={comments}
              onChange={e => setComments(e.target.value)}
              required={verifyStatus === "rejected"}
            />
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{submitError}</div>
          )}

          <div className="flex gap-3 justify-end">
            <Link href={`/finance/balance-register/${register.id}`} className="btn-secondary text-sm">{t("common.cancel")}</Link>
            <button type="submit"
              disabled={submitting || !verifyStatus || (verifyStatus === "rejected" && !comments.trim())}
              className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2">
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  {t("finance.bcre.verify.submitting")}
                </>
              ) : t("finance.bcre.verify.submit")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function VerifyTransactionPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">{t("common.loading")}</div>}>
      <VerifyTransactionPageContent />
    </Suspense>
  );
}
