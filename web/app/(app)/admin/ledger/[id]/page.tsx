"use client";

import { useState, useEffect, useCallback, use } from "react";
import { ledgerVerificationsApi, auditLogsApi, type LedgerVerification, type AuditLogEntry } from "@/lib/api";
import { cn, formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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

function exportCSV(verification: LedgerVerification, logs: AuditLogEntry[], t: (key: string) => string) {
  const headers = [
    t("admin.common.id"),
    t("admin.governance.colTimestamp"),
    t("admin.common.user"),
    t("admin.common.email"),
    t("admin.common.module"),
    t("admin.governance.colAction"),
    t("admin.common.description"),
    t("admin.ledger.csv.recordId"),
    t("admin.ledger.csv.ip"),
  ];
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
  const { t } = useI18n();
  const { success } = useToast();
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


  useEffect(() => {
    ledgerVerificationsApi.get(numId)
      .then((res) => setVerification(res.data))
      .catch(() => setError(t("admin.ledger.detail.loadFailed")))
      .finally(() => setLoading(false));
  }, [numId]);

  const loadLogs = useCallback((p: number) => {
    setLogsLoading(true);
    auditLogsApi.list({ page: p, per_page: 50 })
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
      success(t("admin.ledger.detail.reverifyDone", { result: res.data.data.status === "pass" ? t("admin.ledger.passed") : t("admin.ledger.failed") }));
    } catch {
      success(t("admin.ledger.detail.reverifyFailed"), "error");
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
          {error ?? t("admin.ledger.detail.notFound")}
        </div>
      </div>
    );
  }

  const isPassed = verification.status === "pass";

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Toast */}
      <ModulePageHeader
        title={t("admin.ledger.detail.title")}
        subtitle={t(verification.type === "manual" ? "admin.ledger.detail.subtitleManual" : "admin.ledger.detail.subtitleScheduled", { at: formatTs(verification.verified_at) })}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.ledger.crumb"), href: "/admin/ledger" },
              { label: t("admin.ledger.detail.crumb", { id: verification.id }) },
            ]}
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportCSV(verification, logs, t)}
              className="btn-secondary flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t("admin.ledger.exportCsv")}
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
              {reverifying ? t("admin.ledger.verifying") : t("admin.ledger.detail.reverify")}
            </button>
          </div>
        }
      />

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
              {t("admin.ledger.detail.integrityCheck")} <span className={isPassed ? "text-green-700" : "text-red-700"}>{isPassed ? t("admin.ledger.passed") : t("admin.ledger.failed")}</span>
            </div>
            <div className="text-xs text-neutral-500">{t("admin.ledger.detail.entriesVerified", { count: verification.entries_checked.toLocaleString() })}</div>
          </div>
          <span className={cn("ml-auto badge", isPassed ? "badge-success" : "badge-danger")}>
            {isPassed ? t("admin.ledger.pass") : t("admin.ledger.fail")}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-neutral-100">
          <div className="px-5 py-4">
            <p className="text-xs text-neutral-500 mb-0.5">{t("admin.common.type")}</p>
            <p className="text-sm font-medium text-neutral-800 capitalize">{verification.type}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-neutral-500 mb-0.5">{t("admin.ledger.entriesChecked")}</p>
            <p className="text-sm font-medium text-neutral-800">{verification.entries_checked.toLocaleString()}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-neutral-500 mb-0.5">{t("admin.ledger.initiatedBy")}</p>
            <p className="text-sm font-medium text-neutral-800">{verification.initiator?.name ?? t("admin.payslipConfig.system")}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-neutral-500 mb-0.5">{t("admin.ledger.verifiedAt")}</p>
            <p className="text-sm font-medium text-neutral-800">{formatTs(verification.verified_at)}</p>
          </div>
        </div>
        {verification.manifest_hash && (
          <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-0.5">{t("admin.ledger.manifestHash")}</p>
            <p className="text-xs font-mono text-neutral-700 break-all">{verification.manifest_hash}</p>
          </div>
        )}
        {verification.notes && (
          <div className="px-5 py-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-0.5">{t("admin.common.notes")}</p>
            <p className="text-sm text-neutral-700">{verification.notes}</p>
          </div>
        )}
      </div>

      {/* Audit entries */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-neutral-800">{t("admin.ledger.detail.entriesTitle")}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{t("admin.ledger.detail.totalEntries", { count: total.toLocaleString() })}</p>
          </div>
          {logsLoading && (
            <span className="text-xs text-neutral-400 animate-pulse">{t("common.loading")}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("admin.governance.colTimestamp")}</th>
                <th>{t("admin.common.user")}</th>
                <th>{t("admin.common.module")}</th>
                <th>{t("admin.governance.colAction")}</th>
                <th>{t("admin.common.description")}</th>
                <th>{t("admin.governance.colRecord")}</th>
                <th>{t("admin.ledger.colIp")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !logsLoading ? (
                <TableEmpty colSpan={7} title={t("admin.ledger.noEntries")} />
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
              {t("common.pageOf", { page, total: lastPage })} · {t("admin.ledger.entriesN", { count: total.toLocaleString() })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadLogs(page - 1)}
                disabled={page <= 1 || logsLoading}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                {t("common.previous")}
              </button>
              <button
                type="button"
                onClick={() => loadLogs(page + 1)}
                disabled={page >= lastPage || logsLoading}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
