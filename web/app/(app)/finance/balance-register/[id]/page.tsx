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

const MODULE_LABELS: Record<string, string> = {
  salary_advance: "Salary Advance",
  imprest:        "Imprest",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  active:   { label: "Active",   badge: "badge-success", icon: "check_circle" },
  closed:   { label: "Closed",   badge: "badge-muted",   icon: "lock" },
  disputed: { label: "Disputed", badge: "badge-danger",  icon: "warning" },
  locked:   { label: "Locked",   badge: "badge-warning", icon: "lock" },
};

const TXN_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  disbursement: { label: "Disbursement", color: "text-red-600",   icon: "arrow_outward" },
  recovery:     { label: "Recovery",     color: "text-green-600", icon: "arrow_downward" },
  adjustment:   { label: "Adjustment",   color: "text-blue-600",  icon: "edit" },
  write_off:    { label: "Write-off",    color: "text-orange-600", icon: "do_not_disturb" },
};

const VERIFY_STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  pending:  { badge: "badge-warning", label: "Pending" },
  approved: { badge: "badge-success", label: "Approved" },
  rejected: { badge: "badge-danger",  label: "Rejected" },
};

const ACK_STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  pending:   { badge: "badge-warning", label: "Pending confirmation" },
  confirmed: { badge: "badge-success", label: "Confirmed" },
  disputed:  { badge: "badge-danger",  label: "Disputed" },
};

type Tab = "summary" | "transactions" | "adjustments" | "documents" | "approvals" | "audit";

function fmt2(n: number | string) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RegisterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

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
      .catch(() => setError("Failed to load register."))
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
      alert(e?.response?.data?.message ?? "Failed to lock register.");
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
      alert(e?.response?.data?.message ?? "Failed to unlock register.");
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
      setAckError(e?.response?.data?.message ?? "Failed to confirm.");
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
      setAckError(e?.response?.data?.message ?? "Failed to submit dispute.");
    } finally {
      setAckLoading(false);
    }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "summary",      label: "Summary",      icon: "info" },
    { key: "transactions", label: "Transactions",  icon: "receipt_long" },
    { key: "adjustments",  label: "Adjustments",   icon: "tune" },
    { key: "documents",    label: "Documents",     icon: "attach_file" },
    { key: "approvals",    label: "Approvals",     icon: "verified" },
    { key: "audit",        label: "Audit Trail",   icon: "history" },
  ];

  const txns: BalanceTransaction[] = (register?.transactions ?? []);
  const adjustmentTxns = txns.filter(t => t.type === "adjustment" || t.type === "write_off");
  const docTxns        = txns.filter(t => t.supporting_document_path);
  const verifications: BalanceVerification[] = txns
    .filter(t => t.verification)
    .map(t => t.verification!)
    .filter(Boolean);

  const latestAck: BalanceAcknowledgement | undefined = (register?.acknowledgements ?? [])[0];
  const hasDisputedStatus = register?.status === "disputed";

  const recoveryPct = register
    ? Math.min(100, Math.round(((Number(register.total_processed)) / Number(register.approved_amount)) * 100))
    : 0;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
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
      <div className="p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error ?? "Register not found."}</div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[register.status] ?? { label: register.status, badge: "badge-muted", icon: "circle" };

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
        <Link href="/finance" className="hover:text-primary">Finance</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href="/finance/balance-register" className="hover:text-primary">Balance Register</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href="/finance/balance-register/registers" className="hover:text-primary">All Registers</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">{register.reference_number}</span>
      </nav>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{register.reference_number}</h1>
            <span className={`${statusCfg.badge} flex items-center gap-1 text-xs px-2 py-1 rounded-full`}>
              <span className="material-symbols-outlined text-xs">{statusCfg.icon}</span>
              {statusCfg.label}
            </span>
          </div>
          <p className="page-subtitle">{MODULE_LABELS[register.module_type] ?? register.module_type} — Balance Register</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {register.isLocked !== undefined ? null : null}
          {register.status === "active" && (
            <button onClick={handleLock} disabled={lockLoading}
              className="btn-secondary text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-base">lock</span>
              Lock Period
            </button>
          )}
          {register.status === "locked" && (
            <button onClick={handleUnlock} disabled={lockLoading}
              className="btn-secondary text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-base">lock_open</span>
              Unlock
            </button>
          )}
          {register.status !== "locked" && (
            <Link href={`/finance/balance-register/${register.id}/update`}
              className="btn-primary text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-base">add</span>
              Add Transaction
            </Link>
          )}
        </div>
      </div>

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
              ? "Employee has confirmed this balance."
              : `Employee disputed: "${latestAck.dispute_reason}"`}
          </span>
        </div>
      )}
      {latestAck?.status === "pending" && (
        <div className="rounded-lg px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">pending</span>
            <span>Balance confirmation pending from employee.</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={ackLoading}
              className="btn-primary text-xs py-1 px-3">Confirm Balance</button>
            <button onClick={() => setShowDisputeModal(true)}
              className="btn-secondary text-xs py-1 px-3 border-red-300 text-red-600">Dispute</button>
          </div>
        </div>
      )}

      {ackError && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{ackError}</div>
      )}

      {/* Amount summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Approved Amount</p>
          <p className="text-xl font-bold text-neutral-800">NAD {fmt2(register.approved_amount)}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Total Processed</p>
          <p className="text-xl font-bold text-primary">NAD {fmt2(register.total_processed)}</p>
          <div className="mt-2 w-full bg-neutral-100 rounded-full h-1.5">
            <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${recoveryPct}%` }} />
          </div>
          <p className="text-xs text-neutral-400 mt-1">{recoveryPct}% of approved</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-neutral-900">NAD {fmt2(register.balance)}</p>
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
              Employee
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-base">badge</span>
                <span className="text-neutral-500 w-32">Name</span>
                <span className="font-medium">{register.employee?.name ?? `#${register.employee_id}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-base">mail</span>
                <span className="text-neutral-500 w-32">Email</span>
                <span>{register.employee?.email ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-base">category</span>
                <span className="text-neutral-500 w-32">Module</span>
                <span>{MODULE_LABELS[register.module_type] ?? register.module_type}</span>
              </div>
            </div>
          </div>
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base p-1 bg-primary/10 rounded-lg">schedule</span>
              Recovery Schedule
            </h3>
            <div className="space-y-2 text-sm">
              {register.installment_amount && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-base">payments</span>
                  <span className="text-neutral-500 w-40">Monthly Installment</span>
                  <span className="font-medium">NAD {fmt2(register.installment_amount)}</span>
                </div>
              )}
              {register.recovery_start_date && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-base">calendar_today</span>
                  <span className="text-neutral-500 w-40">Recovery Start</span>
                  <span>{formatDate(register.recovery_start_date)}</span>
                </div>
              )}
              {register.estimated_payoff_date && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-base">event_available</span>
                  <span className="text-neutral-500 w-40">Estimated Payoff</span>
                  <span>{formatDate(register.estimated_payoff_date)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-base">person_add</span>
                <span className="text-neutral-500 w-40">Created By</span>
                <span>{register.creator?.name ?? `#${register.created_by}`}</span>
              </div>
              {register.period_locked_at && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-base">lock</span>
                  <span className="text-neutral-500 w-40">Locked At</span>
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
            <h3 className="font-semibold text-sm text-neutral-700">All Transactions</h3>
            {register.status !== "locked" && (
              <Link href={`/finance/balance-register/${register.id}/update`}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">add</span> Add Transaction
              </Link>
            )}
          </div>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Previous</th>
                <th className="text-right">New Balance</th>
                <th>Reference</th>
                <th>Maker</th>
                <th>Verification</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-sm text-neutral-400">No transactions yet.</td></tr>
              ) : txns.map(t => {
                const tc = TXN_TYPE_CONFIG[t.type] ?? { label: t.type, color: "", icon: "circle" };
                const vc = VERIFY_STATUS_CONFIG[t.verification_status] ?? { badge: "badge-muted", label: t.verification_status };
                return (
                  <tr key={t.id} className="hover:bg-neutral-50">
                    <td>
                      <span className={`flex items-center gap-1 text-sm ${tc.color}`}>
                        <span className="material-symbols-outlined text-base">{tc.icon}</span>
                        {tc.label}
                      </span>
                    </td>
                    <td className={`text-right text-sm font-semibold ${tc.color}`}>
                      {fmt2(t.amount)}
                    </td>
                    <td className="text-right text-sm text-neutral-500">{fmt2(t.previous_balance)}</td>
                    <td className="text-right text-sm font-medium">{fmt2(t.new_balance)}</td>
                    <td className="text-sm text-neutral-500">{t.reference_doc ?? "—"}</td>
                    <td className="text-sm">{t.createdBy?.name ?? `#${t.created_by}`}</td>
                    <td>
                      <span className={`text-xs ${vc.badge}`}>{vc.label}</span>
                    </td>
                    <td className="text-sm text-neutral-500">{formatDate(t.created_at)}</td>
                    <td>
                      {t.verification_status === "pending" && (
                        <Link href={`/finance/balance-register/${register.id}/verify?txn=${t.id}`}
                          className="text-xs text-primary hover:underline font-medium">
                          Verify
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
            <h3 className="font-semibold text-sm text-neutral-700">Adjustments & Write-offs</h3>
          </div>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th>Notes</th>
                <th>Maker</th>
                <th>Verification</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {adjustmentTxns.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-sm text-neutral-400">No adjustments or write-offs.</td></tr>
              ) : adjustmentTxns.map(t => {
                const tc = TXN_TYPE_CONFIG[t.type];
                const vc = VERIFY_STATUS_CONFIG[t.verification_status];
                return (
                  <tr key={t.id}>
                    <td><span className={`text-sm ${tc?.color ?? ""}`}>{tc?.label ?? t.type}</span></td>
                    <td className={`text-right text-sm font-semibold ${tc?.color ?? ""}`}>{fmt2(t.amount)}</td>
                    <td className="text-sm text-neutral-500 max-w-xs truncate">{t.notes ?? "—"}</td>
                    <td className="text-sm">{t.createdBy?.name ?? `#${t.created_by}`}</td>
                    <td><span className={`text-xs ${vc?.badge ?? "badge-muted"}`}>{vc?.label ?? t.verification_status}</span></td>
                    <td className="text-sm text-neutral-500">{formatDate(t.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="card p-5">
          <h3 className="font-semibold text-sm text-neutral-700 mb-4">Supporting Documents</h3>
          {docTxns.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">No supporting documents attached.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {docTxns.map(t => (
                <a key={t.id} href={t.supporting_document_path!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors">
                  <span className="material-symbols-outlined text-neutral-400 text-xl">description</span>
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-neutral-700 truncate">
                      {TXN_TYPE_CONFIG[t.type]?.label ?? t.type} — {formatDate(t.created_at)}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">{t.reference_doc ?? "Document"}</p>
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
            <h3 className="font-semibold text-sm text-neutral-700">Verification Records</h3>
          </div>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Checker</th>
                <th>Status</th>
                <th>Comments</th>
                <th>Verified At</th>
              </tr>
            </thead>
            <tbody>
              {verifications.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-sm text-neutral-400">No verification records.</td></tr>
              ) : verifications.map(v => (
                <tr key={v.id}>
                  <td className="text-sm text-neutral-500">#{v.transaction_id}</td>
                  <td className="text-sm">{v.verifier?.name ?? `#${v.verified_by}`}</td>
                  <td>
                    <span className={`text-xs ${VERIFY_STATUS_CONFIG[v.status]?.badge ?? "badge-muted"}`}>
                      {v.status}
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
            Full audit trail available in{" "}
            <Link href={`/analytics/ledger?auditable_type=App\\Models\\BalanceRegister&auditable_id=${register.id}`}
              className="text-primary hover:underline">Analytics → Audit Integrity Ledger</Link>.
          </p>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-neutral-800">Dispute Balance</h3>
            <p className="text-sm text-neutral-500">Explain why you are disputing this balance. Finance will be notified to investigate.</p>
            <textarea
              className="form-input w-full h-32 text-sm resize-none"
              placeholder="Enter dispute reason..."
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
            />
            {ackError && <p className="text-sm text-red-600">{ackError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDisputeModal(false); setDisputeReason(""); }}
                className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleDispute} disabled={ackLoading || !disputeReason.trim()}
                className="btn-primary text-sm bg-red-600 hover:bg-red-700 border-red-600 disabled:opacity-50">
                {ackLoading ? "Submitting…" : "Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
