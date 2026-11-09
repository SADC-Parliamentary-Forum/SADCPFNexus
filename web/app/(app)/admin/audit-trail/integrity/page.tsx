"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AuditTrailIntegrityPage() {
  const { t } = useI18n();
  const { success, error, info } = useToast();
  const [checkpoints, setCheckpoints] = useState<Array<Record<string, unknown>>>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    platformAuditApi.checkpoints()
      .then((r) => setCheckpoints(r.data.data ?? []))
      .catch(() => error(t("admin.auditTrail.integrity.loadFailed")));
  };

  useEffect(() => { load(); }, []);

  const verify = async () => {
    setBusy(true);
    try {
      const r = await platformAuditApi.verifyIntegrity();
      setResult(r.data.data as any);
      error(r.data.data.valid ? t("admin.auditTrail.integrity.chainValid") : t("admin.auditTrail.integrity.chainFailure"));
    } catch {
      error(t("admin.auditTrail.integrity.verifyFailed"));
    } finally {
      setBusy(false);
    }
  };

  const checkpoint = async () => {
    setBusy(true);
    try {
      await platformAuditApi.createCheckpoint();
      success(t("admin.auditTrail.integrity.checkpointCreated"));
      load();
    } catch {
      error(t("admin.auditTrail.integrity.checkpointFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title={t("admin.auditTrail.integrity.title")}
        subtitle={t("admin.auditTrail.integrity.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.auditTrail.integrity.title") }]} />}
      />
        <Link href="/admin/audit-trail" className="btn-secondary text-sm">{t("common.back")}</Link>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary text-sm" disabled={busy} onClick={verify}>{t("admin.auditTrail.integrity.verify")}</button>
        <button className="btn-secondary text-sm" disabled={busy} onClick={checkpoint}>{t("admin.auditTrail.integrity.create")}</button>
      </div>

      {result && (
        <div className="card p-4 text-sm space-y-1">
          <div><span className="font-medium">{t("admin.auditTrail.integrity.valid")}</span> {String(result.valid)}</div>
          <div><span className="font-medium">{t("admin.auditTrail.integrity.checked")}</span> {String(result.checked)}</div>
          <div><span className="font-medium">{t("admin.auditTrail.integrity.message")}</span> {String(result.message)}</div>
          {result.first_failure_sequence != null && (
            <div><span className="font-medium">{t("admin.auditTrail.integrity.firstFailure")}</span> {String(result.first_failure_sequence)}</div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">{t("admin.common.id")}</th>
              <th className="px-4 py-3 text-left">{t("admin.auditTrail.integrity.range")}</th>
              <th className="px-4 py-3 text-left">{t("admin.auditTrail.integrity.count")}</th>
              <th className="px-4 py-3 text-left">{t("admin.common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {checkpoints.map((c: any) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">{c.id}</td>
                <td className="px-4 py-2 text-xs">{c.from_sequence} → {c.to_sequence}</td>
                <td className="px-4 py-2">{c.event_count}</td>
                <td className="px-4 py-2">{c.status}</td>
              </tr>
            ))}
            {checkpoints.length === 0 && (
              <TableEmpty colSpan={4} title={t("admin.auditTrail.integrity.empty")} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
