"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { ledgerVerificationsApi, auditApi, type LedgerVerification, type AuditLogEntry } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  created:   "badge-success",
  updated:   "badge-primary",
  deleted:   "badge-danger",
  approved:  "badge-success",
  rejected:  "badge-danger",
  submitted: "badge-warning",
  login:     "badge-muted",
  logout:    "badge-muted",
};

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function exportCSV(verification: LedgerVerification, logs: AuditLogEntry[]) {
  const headers = ["ID", "Timestamp", "User", "Email", "Module", "Action", "Description", "Record ID", "IP Address"];
  const rows = logs.map((e) => [
    e.id,
    e.created_at,
    e.user_name ?? "",
    e.user_email ?? "",
    e.module ?? "",
    e.action,
    e.description ?? "",
    e.record_id ?? "",
    e.ip_address ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-verification-${verification.id}-${formatDateShort(verification.verified_at)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function LedgerVerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numId = Number(id);

  const [verification, setVerification] = useState<LedgerVerification | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reverifying, setReverifying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    ledgerVerificationsApi.get(numId)
      .then((res) => setVerification(res.data))
      .catch(() => setError("Failed to load verification record."))
      .finally(() => setLoading(false));
  }, [numId]);

  const loadLogs = useCallback((p: number) => {
    setLogsLoading(true);
    auditApi.list({ page: p, per_page: 50 })
      .then((res) => {
        setLogs(res.data.data);
        setPage(res.data.current_page);
        setLastPage(res.data.last_page);
        setTotal(res.data.total);
      })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, []);

  useEffect(() => { loadLogs(1); }, [loadLogs]);

  const handleReverify = async () => {
    if (!verification) return;
    setReverifying(true);
    try {
      const res = await ledgerVerificationsApi.verify("Manual re-verification from admin dashboard");
      setVerification(res.data.data);
      showToast("Re-verification complete — " + (res.data.data.status === "pass" ? "PASSED" : "FAILED"));
    } catch {
      showToast("Re-verification failed.", "error");
    } finally {
      setReverifying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-6 bg-neutral-200 rounded w-48" />
        <div className="h-40 bg-neutral-200 rounded-xl" />
        <div className="h-64 bg-neutral-200 rounded-xl" />
      </div>
    );
  }

  if (error || !verification) {
    return (
      <div className="p-8">
        <div className="card p-6 text-center text-neutral-500">
          <span className="material-symbols-outlined text-4xl mb-2 block">error_outline</span>
          {error ?? "Verification record not found."}
        </div>
      </div>
    );
  }

  const isPassed = verification.status === "pass";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl",
          toast.type === "success" ? "bg-green-600" : "bg-red-600"
        )}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error_outline"}
          </span>
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/admin/ledger" className="hover:text-primary">Audit Ledger</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">Verification #{verification.id}</span>
      </div>

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="page-title">Ledger Verification Report</h1>
          <p className="page-subtitle">
            {verification.type === "manual" ? "Manual" : "Scheduled"} verification — {formatTs(verification.verified_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCSV(verification, logs)}
            className="btn-secondary flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleReverify}
            disabled={reverifying}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">
              {reverifying ? "hourglass_top" : "verified_user"}
            </span>
            {reverifying ? "Verifying…" : "Re-verify"}
          </button>
        </div>
      </div>

      {/* Verification metadata card */}
      <div className="card p-0 overflow-hidden">
        <div className={cn(
          "px-6 py-4 flex items-center gap-3 border-b border-neutral-100",
          isPassed ? "bg-green-50" : "bg-red-50"
        )}>
          <span className={cn(
            "material-symbols-outlined text-[28px]",
            isPassed ? "text-green-600" : "text-red-600"
          )}>
            {isPassed ? "verified_user" : "gpp_bad"}
          </span>
          <div>
            <div className="font-semibold text-neutral-800">
              Integrity Check: <span className={isPassed ? "text-green-700" : "text-red-700"}>{isPassed ? "PASSED" : "FAILED"}</span>
            </div>
            <div className="text-xs text-neutral-500">{verification.entries_checked.toLocaleString()} entries verified</div>
          </div>
          <span className={cn("ml-auto badge", isPassed ? "badge-success" : "badge-danger")}>
            {isPassed ? "Pass" : "Fail"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-neutral-100">
          <div className="px-5 py-4">
            <p className="text-xs text-neutral-500 mb-0.5">Type</p>
            <p className="text-sm font-medium text-neutral-800 capitalize">{verification.type}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-neutral-500 mb-0.5">Entries Checked</p>
            <p className="text-sm font-medium text-neutral-800">{verification.entries_checked.toLocaleString()}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-neutral-500 mb-0.5">Initiated By</p>
            <p className="text-sm font-medium text-neutral-800">{verification.initiator?.name ?? "System"}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-neutral-500 mb-0.5">Verified At</p>
            <p className="text-sm font-medium text-neutral-800">{formatTs(verification.verified_at)}</p>
          </div>
        </div>
        {verification.manifest_hash && (
          <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-0.5">Manifest Hash</p>
            <p className="text-xs font-mono text-neutral-700 break-all">{verification.manifest_hash}</p>
          </div>
        )}
        {verification.notes && (
          <div className="px-5 py-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-0.5">Notes</p>
            <p className="text-sm text-neutral-700">{verification.notes}</p>
          </div>
        )}
      </div>

      {/* Audit entries */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-neutral-800">Audit Log Entries</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{total.toLocaleString()} total entries in the system</p>
          </div>
          {logsLoading && (
            <span className="text-xs text-neutral-400 animate-pulse">Loading…</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Description</th>
                <th>Record</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !logsLoading ? (
                <tr>
                  <td colSpan={7} className="text-center text-neutral-400 py-8">No entries found.</td>
                </tr>
              ) : logs.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-xs text-neutral-500">{formatTs(entry.created_at)}</td>
                  <td>
                    <div className="text-sm font-medium text-neutral-800">{entry.user_name ?? "—"}</div>
                    {entry.user_email && <div className="text-xs text-neutral-400">{entry.user_email}</div>}
                  </td>
                  <td className="text-sm capitalize text-neutral-600">{entry.module ?? "—"}</td>
                  <td>
                    <span className={cn("badge", ACTION_COLORS[entry.action] ?? "badge-muted")}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="text-sm text-neutral-700 max-w-xs truncate">{entry.description ?? "—"}</td>
                  <td className="text-xs text-neutral-500 font-mono">{entry.record_id ?? "—"}</td>
                  <td className="text-xs text-neutral-400 font-mono">{entry.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Page {page} of {lastPage} · {total.toLocaleString()} entries
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadLogs(page - 1)}
                disabled={page <= 1 || logsLoading}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => loadLogs(page + 1)}
                disabled={page >= lastPage || logsLoading}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
