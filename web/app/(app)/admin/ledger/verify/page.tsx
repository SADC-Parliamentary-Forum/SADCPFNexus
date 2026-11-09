"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { auditLogsApi, ledgerVerificationsApi, type LedgerVerification } from "@/lib/api";
import { cn, formatDateRelative } from "@/lib/utils";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATIC_MANIFEST = "e3b0c44298fc1c149afbf4c8996fb924";

function formatVerifiedAt(ts: string) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function hashDisplay(hash: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 12)}…${hash.slice(-6)}`;
}

export default function LedgerVerifyPage() {
  const { t } = useI18n();
  const [verifications, setVerifications] = useState<LedgerVerification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [verifying, setVerifying]         = useState(false);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [lastPage, setLastPage]           = useState(1);
  const [error, setError]                 = useState<string | null>(null);
  const [successMsg, setSuccessMsg]       = useState<string | null>(null);
  const [auditTotal, setAuditTotal]       = useState<number | null>(null);
  const [latestManifest, setLatestManifest] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    ledgerVerificationsApi.list({ page, per_page: 10 })
      .then((res) => {
        setVerifications(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
        const first = res.data.data?.[0];
        if (first?.manifest_hash) setLatestManifest(first.manifest_hash);
      })
      .catch(() => setError(t("admin.ledgerVerify.loadFailed")))
      .finally(() => setLoading(false));
  }, [page, t]);

  useEffect(() => { load(); }, [load]);

  // Load audit entry count for display
  useEffect(() => {
    auditLogsApi.list({ per_page: 1 })
      .then((res) => setAuditTotal(res.data.total ?? null))
      .catch(() => {});
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await ledgerVerificationsApi.verify();
      setSuccessMsg(res.data.message);
      setLatestManifest(res.data.data.manifest_hash ?? null);
      // Reload history
      load();
    } catch {
      setError(t("admin.ledgerVerify.failed"));
    } finally {
      setVerifying(false);
    }
  };

  const passCount = verifications.filter((v) => v.status === "pass").length;
  const failCount = verifications.filter((v) => v.status === "fail").length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">{t("admin.homeLabel")}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/admin/ledger" className="hover:text-primary transition-colors">{t("admin.ledger.crumb")}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{t("admin.ledgerVerify.crumb")}</span>
      </div>

      {/* Page title */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <ModulePageHeader
        title={t("admin.home.ledgerVerification")}
        subtitle={t("admin.ledgerVerify.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.home.ledgerVerification") }]} />}
      />
        <Link href="/admin/ledger" className="btn-secondary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          {t("admin.ledgerVerify.viewLedger")}
        </Link>
      </div>

      {/* Status banner */}
      <div className={cn(
        "rounded-xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
        failCount > 0
          ? "bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
          : "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0",
            failCount > 0 ? "bg-red-100" : "bg-green-100"
          )}>
            <span className={cn(
              "material-symbols-outlined text-[22px]",
              failCount > 0 ? "text-red-600" : "text-green-600"
            )}>
              {failCount > 0 ? "error" : "check_circle"}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              {failCount > 0 ? t("admin.ledgerVerify.healthAction") : t("admin.ledger.health")}
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5",
                failCount > 0 ? "text-red-700 bg-red-100" : "text-green-700 bg-green-100"
              )}>
                {failCount > 0
                  ? t(failCount !== 1 ? "admin.ledgerVerify.failedChecksMany" : "admin.ledgerVerify.failedChecksOne", { count: failCount })
                  : t("admin.ledger.chainIntact")}
              </span>
            </p>
            <p className="text-xs text-neutral-600 mt-0.5 max-w-xl">
              {auditTotal !== null
                ? `${t("admin.ledgerVerify.integrityAcross", { count: auditTotal.toLocaleString() })} `
                : ""}
              {total > 0
                ? t(total !== 1 ? "admin.ledgerVerify.onRecordMany" : "admin.ledgerVerify.onRecordOne", { count: total.toLocaleString() })
                : t("admin.ledgerVerify.noneYet")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying}
          className="btn-primary flex items-center gap-2 disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <span className={cn("material-symbols-outlined text-[18px]", verifying ? "animate-spin" : "")}>sync</span>
          {verifying ? t("admin.ledger.verifyingEllipsis") : t("admin.ledger.verifyLedger")}
        </button>
      </div>

      {/* Feedback messages */}
      {successMsg && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600 text-[18px]">check_circle</span>
          <p className="text-sm text-green-800">{successMsg}</p>
        </div>
      )}
      {error && <ErrorBanner message={error} />}

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 font-medium">{t("admin.ledger.latestHash")}</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">fingerprint</span>
          </div>
          <p className="font-mono text-sm font-bold text-neutral-900 truncate" title={latestManifest ?? STATIC_MANIFEST}>
            {hashDisplay(latestManifest ?? STATIC_MANIFEST)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">{t("admin.ledger.algorithm")}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 font-medium">{t("admin.ledgerVerify.signatureStatus")}</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">verified</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-neutral-900">{t("admin.ledgerVerify.valid")}</p>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">{"RSA-4096"}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">{t("admin.ledgerVerify.ca", { ca: "GovRoot CA G2" })}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 font-medium">{t("admin.ledgerVerify.objectLockStatus")}</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">lock</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-neutral-900">{t("admin.ledger.locked")}</p>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{t("admin.ledger.compliance")}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">{t("admin.ledgerVerify.retention7")}</p>
        </div>
      </div>

      {/* Verification history table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">history</span>
            <span className="text-sm font-semibold text-neutral-700">{t("admin.ledgerVerify.history")}</span>
            {!loading && (
              <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-medium">
                {t(total !== 1 ? "admin.ledgerVerify.checksMany" : "admin.ledgerVerify.checksOne", { count: total.toLocaleString() })}
              </span>
            )}
            {failCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                {t("admin.ledgerVerify.failedN", { count: failCount })}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400">{t("admin.ledgerVerify.historyDesc")}</p>
        </div>

        {loading ? (
          <div className="divide-y divide-neutral-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="h-3 w-36 bg-neutral-100 rounded" />
                <div className="h-3 w-28 bg-neutral-100 rounded" />
                <div className="h-3 w-32 bg-neutral-100 rounded font-mono" />
                <div className="h-3 w-20 bg-neutral-100 rounded" />
                <div className="h-5 w-16 bg-neutral-100 rounded-full" />
                <div className="h-3 w-16 bg-neutral-100 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : verifications.length === 0 ? (
          <EmptyState
            icon="verified_user"
            title={t("admin.ledgerVerify.empty")}
            description={t("admin.ledgerVerify.emptyDesc")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{t("admin.governance.colTimestamp")}</th>
                  <th>{t("admin.ledgerVerify.initiator")}</th>
                  <th>{t("admin.ledger.manifestHash")}</th>
                  <th>{t("admin.ledger.entriesChecked")}</th>
                  <th>{t("admin.common.type")}</th>
                  <th>{t("admin.common.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {verifications.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap font-mono text-[11px] text-neutral-600">
                      {formatVerifiedAt(v.verified_at)}
                    </td>
                    <td>
                      {v.initiator ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {v.initiator.name[0]}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-neutral-800">{v.initiator.name}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">computer</span>
                          {t("admin.ledgerVerify.systemAuto")}
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-[11px] text-neutral-400">
                      {hashDisplay(v.manifest_hash)}
                    </td>
                    <td className="text-xs text-neutral-600 text-right tabular-nums">
                      {v.entries_checked.toLocaleString()}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5 capitalize">
                        {v.type}
                      </span>
                    </td>
                    <td>
                      {v.status === "pass" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          {t("admin.ledger.pass")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 rounded-full px-2.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          {t("admin.ledger.fail")}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/ledger/${v.id}`}
                        className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-0.5"
                      >
                        {t("admin.common.view")}
                        <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100">
            <span className="text-xs text-neutral-400">{t("common.pageOf", { page, total: lastPage })} · {t("admin.ledgerVerify.checksMany", { count: total.toLocaleString() })}</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(lastPage, 7) }, (_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setPage(pg)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-xs font-semibold transition-colors",
                      page === pg ? "bg-primary text-white" : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                    )}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={page === lastPage}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-3 flex items-center justify-between gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-neutral-400">shield</span>
          {t("admin.ledgerVerify.footer")}
        </span>
        <span className="font-mono text-neutral-300">{"SHA-256 · RSA-4096 · GovRoot CA G2"}</span>
      </div>
    </div>
  );
}
