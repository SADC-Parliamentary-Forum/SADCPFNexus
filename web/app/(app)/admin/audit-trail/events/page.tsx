"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { platformAuditApi, type PlatformAuditEvent } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export default function AuditTrailEventTypesPage() {
  const params = useSearchParams();
  const eventId = params.get("id");
  const [types, setTypes] = useState<Array<Record<string, unknown>>>([]);
  const [detail, setDetail] = useState<PlatformAuditEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platformAuditApi.eventTypes()
      .then((r) => setTypes(r.data.data ?? []))
      .catch(() => setError("Could not load event type registry"));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    platformAuditApi.get(eventId)
      .then((r) => setDetail(r.data.data))
      .catch(() => setDetail(null));
  }, [eventId]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ModulePageHeader
        title="Event type registry & detail"
        subtitle="Read-heavy controlled taxonomy (PRD §11–§13)."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Event type registry & detail" }]} />}
      />
        <Link href="/admin/audit-trail" className="text-sm text-primary underline">Back</Link>
      </div>

      {error && <div className="text-sm text-amber-700">{error}</div>}

      {detail && (
        <div className="card p-4 space-y-2">
          <h2 className="font-semibold">{detail.event_key}</h2>
          <p className="text-xs text-neutral-500">
            {detail.occurred_at ? formatDateShort(detail.occurred_at) : "—"} · {detail.outcome} · seq {detail.sequence_number}
          </p>
          <p className="text-xs break-all text-neutral-600">Hash: {detail.event_hash}</p>
          {detail.changes && detail.changes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-1 pr-3">Field</th>
                    <th className="py-1 pr-3">Old</th>
                    <th className="py-1 pr-3">New</th>
                    <th className="py-1">Redaction</th>
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
              <th className="px-4 py-3 text-left">Key</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t: any) => (
              <tr key={t.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{t.event_key}</td>
                <td className="px-4 py-2">{t.name}</td>
                <td className="px-4 py-2 text-xs">{t.category}</td>
                <td className="px-4 py-2 text-xs">{t.severity}</td>
                <td className="px-4 py-2 text-xs">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
