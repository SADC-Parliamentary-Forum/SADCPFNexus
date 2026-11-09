"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  bcreApi,
  type BalanceRegister,
  type BalanceTransaction,
  type BalanceVerification,
  type BalanceAcknowledgement,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const MODULE_LABELS: Record<string, string> = {
  salary_advance: "finance.bcre.module.salary_advance",
  imprest:        "finance.bcre.module.imprest",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  active:   { label: "finance.bcre.status.active",   badge: "badge-success", icon: "check_circle" },
  closed:   { label: "finance.bcre.status.closed",   badge: "badge-muted",   icon: "lock" },
  disputed: { label: "finance.bcre.status.disputed", badge: "badge-danger",  icon: "warning" },
  locked:   { label: "finance.bcre.status.locked",   badge: "badge-warning", icon: "lock" },
};

const TXN_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  disbursement: { label: "finance.bcre.txnType.disbursement", color: "text-red-600",   icon: "arrow_outward" },
  recovery:     { label: "finance.bcre.txnType.recovery",     color: "text-green-600", icon: "arrow_downward" },
  adjustment:   { label: "finance.bcre.txnType.adjustment",   color: "text-blue-600",  icon: "edit" },
  write_off:    { label: "finance.bcre.txnType.write_off",    color: "text-orange-600", icon: "do_not_disturb" },
};

const VERIFY_STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  pending:  { badge: "badge-warning", label: "finance.hub.status.pending" },
  approved: { badge: "badge-success", label: "status.approved" },
  rejected: { badge: "badge-danger",  label: "status.rejected" },
};

const ACK_STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  pending:   { badge: "badge-warning", label: "finance.bcre.detail.ack.pending" },
  confirmed: { badge: "badge-success", label: "finance.bcre.detail.ack.confirmed" },
  disputed:  { badge: "badge-danger",  label: "finance.bcre.status.disputed" },
};

type Tab = "summary" | "transactions" | "adjustments" | "documents" | "approvals" | "audit";

function fmt2(n: number | string) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RegisterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { error: toastError } = useToast();
  const { t } = useI18n();

  const [register, setRegister] = useState<BalanceRegister | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("summary");

  // Acknowledge state
  const [ackLoading, setAckLoading]     = useState(false);
  const [ackError, setAckError]         = useState<string | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason]       = useState("");

  // Lock state
  const [lockLoading, setLockLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    bcreApi.get(Number(id))
      .then(res => {
        const d = (res.data as any).data ?? res.data;
        setRegister(d);
      })
      .catch(() => setError(t("finance.bcre.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleLock = async () => {
    if (!register) return;
    setLockLoading(true);
    try {
      await bcreApi.lock(register.id);
      load();
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? t("finance.bcre.detail.lockFailed"));
    } finally {
      setLockLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!register) return;
    setLockLoading(true);
    try {
      await bcreApi.unlock(register.id);
      load();
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? t("finance.bcre.detail.unlockFailed"));
    } finally {
      setLockLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!register) return;
    setAckLoading(true);
    setAckError(null);
    try {
      await bcreApi.acknowledge(register.id, { status: "confirmed" });
      load();
    } catch (e: any) {
      setAckError(e?.response?.data?.message ?? t("finance.bcre.detail.confirmFailed"));
    } finally {
      setAckLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!register || !disputeReason.trim()) return;
    setAckLoading(true);
    setAckError(null);
    try {
      await bcreApi.acknowledge(register.id, { status: "disputed", dispute_reason: disputeReason });
      setShowDisputeModal(false);
      setDisputeReason("");
      load();
    } catch (e: any) {
      setAckError(e?.response?.data?.message ?? t("finance.bcre.detail.disputeFailed"));
    } finally {
      setAckLoading(false);
    }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "summary",      label: t("finance.bcre.detail.tab.summary"),      icon: "info" },
    { key: "transactions", label: t("finance.bcre.detail.tab.transactions"),  icon: "receipt_long" },
    { key: "adjustments",  label: t("finance.bcre.detail.tab.adjustments"),   icon: "tune" },
    { key: "documents",    label: t("finance.bcre.detail.tab.documents"),     icon: "attach_file" },
    { key: "approvals",    label: t("finance.bcre.detail.tab.approvals"),     icon: "verified" },
    { key: "audit",        label: t("finance.bcre.detail.tab.audit"),   icon: "history" },
  ];

  const txns: BalanceTransaction[] = (register?.transactions ?? []);
  const adjustmentTxns = txns.filter(tx => tx.type === "adjustment" || tx.type === "write_off");
  const docTxns        = txns.filter(tx => tx.supporting_document_path);
  const verifications: BalanceVerification[] = txns
    .filter(tx => tx.verification)
    .map(tx => tx.verification!)
    .filter(Boolean);

  const latestAck: BalanceAcknowledgement | undefined = (register?.acknowledgements ?? [])[0];
  const hasDisputedStatus = register?.status === "disputed";

  const recoveryPct = register
    ? Math.min(100, Math.round(((Number(register.total_processed)) / Number(register.approved_amount)) * 100))
    : 0;

  if (loading) {
    return (
    <div className="space-y-4">
        <div className="h-6 bg-neutral-200 rounded animate-pulse w-48" />
        <div className="card p-6 animate-pulse space-y-3">
          <div className="h-4 bg-neutral-200 rounded w-1/3" />
          <div className="h-10 bg-neutral-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !register) {
    return (
    <div className="space-y-5">
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error ?? t("finance.bcre.registerNotFound")}</div>
      </div>
    );
  }

  const statusKnown = STATUS_CONFIG[register.status];
  const statusCfg = statusKnown ? { ...statusKnown, label: t(statusKnown.label) } : { label: register.status, badge: "badge-muted", icon: "circle" };

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title={register.reference_number}
        subtitle={t("finance.bcre.detail.subtitle", { module: MODULE_LABELS[register.module_type] ? t(MODULE_LABELS[register.module_type]) : register.module_type })}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.finance", href: "/finance" },
              { label: "finance.bcre.balanceRegister", href: "/finance/balance-register" },
              { label: "finance.bcre.allRegisters", href: "/finance/balance-register/registers" },
              { label: register.reference_number },
            ]}
          />
        }
        meta={
          <span className={`${statusCfg.badge} flex items-center gap-1 text-xs px-2 py-1 rounded-full`}>
            <span className="material-symbols-outlined text-xs">{statusCfg.icon}</span>
            {statusCfg.label}
          </span>
        }
        actions={
          <div className="flex gap-2 flex-wrap">
          {register.status === "active" && (
            <button onClick={handleLock} disabled={lockLoading}
              className="btn-secondary text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-base">lock</span>
              {t("finance.bcre.detail.lockPeriod")}
            </button>
          )}
          {register.status === "locked" && (
            <button onClick={handleUnlock} disabled={lockLoading}
              className="btn-secondary text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-base">lock_open</span>
              {t("finance.bcre.detail.unlock")}
            </button>
          )}
          {register.status !== "locked" && (
            <Link href={`/finance/balance-register/${register.id}/update`}
              className="btn-primary text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-base">add</span>
              {t("finance.bcre.update.crumb")}
            </Link>
          )}
        </div>
        }
      />

      {/* Acknowledgement Banner */}
      {latestAck && latestAck.status !== "pending" && (
        <div className={`rounded-lg px-4 py-3 flex items-center gap-3 text-sm ${
          latestAck.status === "confirmed"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          <span className="material-symbols-outlined text-base">
            {latestAck.status === "confirmed" ? "check_circle" : "warning"}
          </span>
          <span>
            {latestAck.status === "confirmed"
              ? t("finance.bcre.detail.ackConfirmed")
              : t("finance.bcre.detail.ackDisputed", { reason: latestAck.dispute_reason ?? "" })}
          </span>
        </div>
      )}
      {latestAck?.status === "pending" && (
        <div className="rounded-lg px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">pending</span>
            <span>{t("finance.bcre.detail.ackPending")}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={ackLoading}
              className="btn-primary text-xs py-1 px-3">{t("finance.bcre.detail.confirmBalance")}</button>
            <button onClick={() => setShowDisputeModal(true)}
              className="btn-secondary text-xs py-1 px-3 border-red-300 text-red-600">{t("finance.bcre.detail.dispute")}</button>
          </div>
        </div>
      )}

      {ackError && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{ackError}</div>
      )}

      {/* Amount summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t("finance.bcre.detail.approvedAmount")}</p>
          <p className="text-xl font-bold text-neutral-800">{"NAD"} {fmt2(register.approved_amount)}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t("finance.bcre.detail.totalProcessed")}</p>
          <p className="text-xl font-bold text-primary">{"NAD"} {fmt2(register.total_processed)}</p>
          <div className="mt-2 w-full bg-neutral-100 rounded-full h-1.5">
            <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${recoveryPct}%` }} />
          </div>
          <p className="text-xs text-neutral-400 mt-1">{t("finance.bcre.detail.pctOfApproved", { pct: recoveryPct })}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t("finance.bcre.dashboard.outstanding")}</p>
          <p className="text-2xl font-bold text-neutral-900">{"NAD"} {fmt2(register.balance)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}>
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base p-1 bg-primary/10 rounded-lg">person</span>
              {t("finance.payrollImports.col.employee")}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-base">badge</span>
                <span className="text-neutral-500 w-32">{t("finance.budget.col.name")}</span>
                <span className="font-medium">{register.employee?.name ?? `#${register.employee_id}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-base">mail</span>
                <span className="text-neutral-500 w-32">{t("finance.bcre.detail.email")}</span>
                <span>{register.employee?.email ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-base">category</span>
                <span className="text-neutral-500 w-32">{t("finance.bcre.col.module")}</span>
                <span>{MODULE_LABELS[register.module_type] ? t(MODULE_LABELS[register.module_type]) : register.module_type}</span>
              </div>
            </div>
          </div>
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base p-1 bg-primary/10 rounded-lg">schedule</span>
              {t("finance.bcre.detail.recoverySchedule")}
            </h3>
            <div className="space-y-2 text-sm">
              {register.installment_amount && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-base">payments</span>
                  <span className="text-neutral-500 w-40">{t("finance.bcre.detail.monthlyInstallment")}</span>
                  <span className="font-medium">{"NAD"} {fmt2(register.installment_amount)}</span>
                </div>
              )}
              {register.recovery_start_date && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-base">calendar_today</span>
                  <span className="text-neutral-500 w-40">{t("finance.bcre.detail.recoveryStart")}</span>
                  <span>{formatDate(register.recovery_start_date)}</span>
                </div>
              )}
              {register.estimated_payoff_date && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-base">event_available</span>
                  <span className="text-neutral-500 w-40">{t("finance.bcre.detail.estimatedPayoff")}</span>
                  <span>{formatDate(register.estimated_payoff_date)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-base">person_add</span>
                <span className="text-neutral-500 w-40">{t("finance.bcre.detail.createdBy")}</span>
                <span>{register.creator?.name ?? `#${register.created_by}`}</span>
              </div>
              {register.period_locked_at && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-base">lock</span>
                  <span className="text-neutral-500 w-40">{t("finance.bcre.detail.lockedAt")}</span>
                  <span>{formatDate(register.period_locked_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center">
            <h3 className="font-semibold text-sm text-neutral-700">{t("finance.bcre.detail.allTransactions")}</h3>
            {register.status !== "locked" && (
              <Link href={`/finance/balance-register/${register.id}/update`}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">add</span> {t("finance.bcre.update.crumb")}
              </Link>
            )}
          </div>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t("finance.budget.col.type")}</th>
                <th className="text-right">{t("finance.budget.upload.amount")}</th>
                <th className="text-right">{t("finance.bcre.detail.col.previous")}</th>
                <th className="text-right">{t("finance.bcre.verify.new")}</th>
                <th>{t("decisions.col.reference")}</th>
                <th>{t("finance.bcre.detail.col.maker")}</th>
                <th>{t("finance.bcre.detail.col.verification")}</th>
                <th>{t("finance.bcre.detail.col.date")}</th>
                <th><span className="sr-only">{t("finance.budget.col.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <TableEmpty colSpan={9} title="finance.bcre.detail.noTransactions" />
              ) : txns.map(tx => {
                const tcKnown = TXN_TYPE_CONFIG[tx.type];
                const tc = tcKnown ? { ...tcKnown, label: t(tcKnown.label) } : { label: tx.type, color: "", icon: "circle" };
                const vcKnown = VERIFY_STATUS_CONFIG[tx.verification_status];
                const vc = vcKnown ? { ...vcKnown, label: t(vcKnown.label) } : { badge: "badge-muted", label: tx.verification_status };
                return (
                  <tr key={tx.id} className="hover:bg-neutral-50">
                    <td>
                      <span className={`flex items-center gap-1 text-sm ${tc.color}`}>
                        <span className="material-symbols-outlined text-base">{tc.icon}</span>
                        {tc.label}
                      </span>
                    </td>
                    <td className={`text-right text-sm font-semibold ${tc.color}`}>
                      {fmt2(tx.amount)}
                    </td>
                    <td className="text-right text-sm text-neutral-500">{fmt2(tx.previous_balance)}</td>
                    <td className="text-right text-sm font-medium">{fmt2(tx.new_balance)}</td>
                    <td className="text-sm text-neutral-500">{tx.reference_doc ?? "—"}</td>
                    <td className="text-sm">{tx.createdBy?.name ?? `#${tx.created_by}`}</td>
                    <td>
                      <span className={`text-xs ${vc.badge}`}>{vc.label}</span>
                    </td>
                    <td className="text-sm text-neutral-500">{formatDate(tx.created_at)}</td>
                    <td>
                      {tx.verification_status === "pending" && (
                        <Link href={`/finance/balance-register/${register.id}/verify?txn=${tx.id}`}
                          className="btn-secondary text-xs py-1 px-2">
                          {t("finance.bcre.detail.verify")}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "adjustments" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-sm text-neutral-700">{t("finance.bcre.detail.adjustmentsTitle")}</h3>
          </div>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t("finance.budget.col.type")}</th>
                <th className="text-right">{t("finance.budget.upload.amount")}</th>
                <th>{t("finance.bcre.update.notes")}</th>
                <th>{t("finance.bcre.detail.col.maker")}</th>
                <th>{t("finance.bcre.detail.col.verification")}</th>
                <th>{t("finance.bcre.detail.col.date")}</th>
              </tr>
            </thead>
            <tbody>
              {adjustmentTxns.length === 0 ? (
                <TableEmpty colSpan={6} title="finance.bcre.detail.noAdjustments" />
              ) : adjustmentTxns.map(tx => {
                const tc = TXN_TYPE_CONFIG[tx.type];
                const vc = VERIFY_STATUS_CONFIG[tx.verification_status];
                return (
                  <tr key={tx.id}>
                    <td><span className={`text-sm ${tc?.color ?? ""}`}>{tc ? t(tc.label) : tx.type}</span></td>
                    <td className={`text-right text-sm font-semibold ${tc?.color ?? ""}`}>{fmt2(tx.amount)}</td>
                    <td className="text-sm text-neutral-500 max-w-xs truncate">{tx.notes ?? "—"}</td>
                    <td className="text-sm">{tx.createdBy?.name ?? `#${tx.created_by}`}</td>
                    <td><span className={`text-xs ${vc?.badge ?? "badge-muted"}`}>{vc ? t(vc.label) : tx.verification_status}</span></td>
                    <td className="text-sm text-neutral-500">{formatDate(tx.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="card p-5">
          <h3 className="font-semibold text-sm text-neutral-700 mb-4">{t("finance.bcre.detail.supportingDocs")}</h3>
          {docTxns.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">{t("finance.bcre.detail.noDocs")}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {docTxns.map(tx => (
                <a key={tx.id} href={tx.supporting_document_path!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors">
                  <span className="material-symbols-outlined text-neutral-400 text-xl">description</span>
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-neutral-700 truncate">
                      {TXN_TYPE_CONFIG[tx.type] ? t(TXN_TYPE_CONFIG[tx.type].label) : tx.type} — {formatDate(tx.created_at)}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">{tx.reference_doc ?? t("ui.documents.document")}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "approvals" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-sm text-neutral-700">{t("finance.bcre.detail.verificationRecords")}</h3>
          </div>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t("finance.bcre.detail.col.transaction")}</th>
                <th>{t("finance.bcre.detail.col.checker")}</th>
                <th>{t("finance.budget.col.status")}</th>
                <th>{t("finance.bcre.verify.comments")}</th>
                <th>{t("finance.bcre.detail.col.verifiedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {verifications.length === 0 ? (
                <TableEmpty colSpan={5} title="finance.bcre.detail.noVerifications" />
              ) : verifications.map(v => (
                <tr key={v.id}>
                  <td className="text-sm text-neutral-500">#{v.transaction_id}</td>
                  <td className="text-sm">{v.verifier?.name ?? `#${v.verified_by}`}</td>
                  <td>
                    <span className={`text-xs ${VERIFY_STATUS_CONFIG[v.status]?.badge ?? "badge-muted"}`}>
                      {VERIFY_STATUS_CONFIG[v.status] ? t(VERIFY_STATUS_CONFIG[v.status].label) : v.status}
                    </span>
                  </td>
                  <td className="text-sm text-neutral-500 max-w-xs truncate">{v.comments ?? "—"}</td>
                  <td className="text-sm text-neutral-500">{formatDate(v.verified_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="card p-5">
          <p className="text-sm text-neutral-500 text-center py-8">
            {t("finance.bcre.detail.auditIn")}{" "}
            <Link href={`/analytics/ledger?auditable_type=App\\Models\\BalanceRegister&auditable_id=${register.id}`}
              className="btn-secondary text-xs py-1 px-2">{t("finance.bcre.detail.auditLink")}</Link>.
          </p>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-neutral-800">{t("finance.bcre.detail.disputeTitle")}</h3>
            <p className="text-sm text-neutral-500">{t("finance.bcre.detail.disputeHint")}</p>
            <textarea
              className="form-input w-full h-32 text-sm resize-none"
              placeholder={t("finance.bcre.detail.disputePlaceholder")}
              aria-label={t("finance.bcre.detail.disputePlaceholder")}
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
            />
            {ackError && <p className="text-sm text-red-600">{ackError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDisputeModal(false); setDisputeReason(""); }}
                className="btn-secondary text-sm">{t("common.cancel")}</button>
              <button onClick={handleDispute} disabled={ackLoading || !disputeReason.trim()}
                className="btn-primary text-sm bg-red-600 hover:bg-red-700 border-red-600 disabled:opacity-50">
                {ackLoading ? t("finance.bcre.verify.submitting") : t("finance.bcre.detail.submitDispute")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
