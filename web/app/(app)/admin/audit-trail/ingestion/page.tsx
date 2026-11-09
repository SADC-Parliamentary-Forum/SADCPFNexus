"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { platformAuditApi } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type IngestionHealth = Record<string, number | null>;
type DeadLetter = {
  id: number;
  event_key?: string | null;
  error_message?: string | null;
  status?: string | null;
};

export default function AuditTrailIngestionPage() {
  const { t } = useI18n();
  const [health, setHealth] = useState<IngestionHealth | null>(null);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    return Promise.all([
      platformAuditApi.ingestionHealth().then((r) => setHealth(r.data.data)).catch(() => setHealth(null)),
      platformAuditApi
        .deadLetters({ per_page: 50 })
        .then((r: any) => setDeadLetters(r.data?.data ?? r.data ?? []))
        .catch(() => setDeadLetters([])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const processOutbox = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const response = await platformAuditApi.processOutbox(100);
      const stats = response.data.data;
      setProcessResult(
        t("admin.auditTrail.ingestion.processed", {
          processed: stats.processed,
          committed: stats.committed,
          failed: stats.failed,
          dead: stats.dead_lettered,
        }),
      );
      await load();
    } catch {
      setProcessResult(t("admin.auditTrail.ingestion.processFailed"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("admin.auditTrail.ingestion.title")}
        subtitle={t("admin.auditTrail.ingestion.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.crumb.auditTrail"), href: "/admin/audit-trail" },
              { label: t("admin.auditTrail.ingestion.crumb") },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={processOutbox}
              disabled={processing}
              className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? t("admin.auditTrail.ingestion.processing") : t("admin.auditTrail.ingestion.process")}
            </button>
            <Link href="/admin/audit-trail" className="btn-secondary text-sm">
              {t("admin.auditTrail.ingestion.back")}
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t("admin.auditTrail.ingestion.runbookNotice")}
      </div>

      {processResult ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {processResult}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : health ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(health).map(([key, value]) => (
            <div key={key} className="card p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {key.replace(/_/g, " ")}
              </p>
              <p className="text-lg font-semibold text-neutral-900">{value ?? t("admin.auditTrail.ingestion.none")}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
          {t("admin.auditTrail.ingestion.unavailable")}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-100 px-4 py-3 text-sm font-medium">{t("admin.auditTrail.ingestion.deadLetters")}</div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">{t("admin.auditTrail.ingestion.caption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("admin.common.id")}</th>
                <th scope="col">{t("admin.auditTrail.holds.scopeEvent")}</th>
                <th scope="col">{t("admin.auditTrail.ingestion.error")}</th>
                <th scope="col">{t("admin.common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {deadLetters.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td className="text-xs">{item.event_key ?? t("admin.common.unknown")}</td>
                  <td className="max-w-xs truncate text-xs">{item.error_message ?? t("admin.auditTrail.ingestion.noError")}</td>
                  <td className="text-xs">{item.status ?? t("admin.common.unknown")}</td>
                </tr>
              ))}
              {deadLetters.length === 0 ? (
                <TableEmpty colSpan={4} title={t("admin.auditTrail.ingestion.empty")} />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
