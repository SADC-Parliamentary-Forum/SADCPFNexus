"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { platformAuditApi, type PlatformAuditEvent } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AuditTrailEventTypesPage() {
  const { t } = useI18n();
  const params = useSearchParams();
  const eventId = params.get("id");
  const [types, setTypes] = useState<Array<Record<string, unknown>>>([]);
  const [detail, setDetail] = useState<PlatformAuditEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platformAuditApi.eventTypes()
      .then((r) => setTypes(r.data.data ?? []))
      .catch(() => setError(t("admin.auditTrail.events.loadFailed")));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    platformAuditApi.get(eventId)
      .then((r) => setDetail(r.data.data))
      .catch(() => setDetail(null));
  }, [eventId]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <ModulePageHeader
        title={t("admin.auditTrail.events.title")}
        subtitle={t("admin.auditTrail.events.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.auditTrail.events.title") }]} />}
      />
        <Link href="/admin/audit-trail" className="btn-secondary text-sm">{t("common.back")}</Link>
      </div>

      {error && <div className="text-sm text-amber-700">{error}</div>}

      {detail && (
        <div className="card p-4 space-y-2">
          <h2 className="font-semibold">{detail.event_key}</h2>
          <p className="text-xs text-neutral-500">
            {detail.occurred_at ? formatDateShort(detail.occurred_at) : "—"} · {detail.outcome} · {t("admin.auditTrail.events.seq", { seq: detail.sequence_number ?? "" })}
          </p>
          <p className="text-xs break-all text-neutral-600">{t("admin.auditTrail.events.hash", { hash: detail.event_hash ?? "" })}</p>
          {detail.changes && detail.changes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-1 pr-3">{t("admin.auditTrail.events.field")}</th>
                    <th className="py-1 pr-3">{t("admin.auditTrail.events.old")}</th>
                    <th className="py-1 pr-3">{t("admin.auditTrail.events.new")}</th>
                    <th className="py-1">{t("admin.auditTrail.events.redaction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.changes.map((c: any, i: number) => (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="py-1 pr-3">{c.field_name}</td>
                      <td className="py-1 pr-3">{c.old_value ?? "—"}</td>
                      <td className="py-1 pr-3">{c.new_value ?? "—"}</td>
                      <td className="py-1">{c.redaction_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">{t("admin.auditTrail.events.key")}</th>
              <th className="px-4 py-3 text-left">{t("admin.common.name")}</th>
              <th className="px-4 py-3 text-left">{t("admin.common.category")}</th>
              <th className="px-4 py-3 text-left">{t("admin.common.severity")}</th>
              <th className="px-4 py-3 text-left">{t("admin.common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {types.map((et: any) => (
              <tr key={et.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{et.event_key}</td>
                <td className="px-4 py-2">{et.name}</td>
                <td className="px-4 py-2 text-xs">{et.category}</td>
                <td className="px-4 py-2 text-xs">{et.severity}</td>
                <td className="px-4 py-2 text-xs">{et.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
