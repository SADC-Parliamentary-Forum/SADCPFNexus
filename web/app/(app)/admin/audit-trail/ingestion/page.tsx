"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi } from "@/lib/api";

export default function AuditTrailIngestionPage() {
  const [health, setHealth] = useState<Record<string, number | null> | null>(null);
  const [deadLetters, setDeadLetters] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    platformAuditApi.ingestionHealth().then((r) => setHealth(r.data.data)).catch(() => setHealth(null));
    platformAuditApi.deadLetters({ per_page: 50 })
      .then((r: any) => setDeadLetters(r.data?.data ?? r.data ?? []))
      .catch(() => setDeadLetters([]));
  };

  useEffect(() => { load(); }, []);

  const replay = async (id: number) => {
    try {
      await platformAuditApi.replayDeadLetter(id);
      setToast(`Replayed dead letter #${id}`);
      load();
    } catch {
      setToast("Replay failed");
    }
  };

  const migrate = async () => {
    try {
      const r = await platformAuditApi.migrateLegacy(5000);
      setToast(`Migration: ${JSON.stringify(r.data.data)}`);
      load();
    } catch {
      setToast("Migration failed");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <ModulePageHeader
        title="Ingestion health"
        subtitle="Outbox, dead-letters, and legacy AuditLog migration."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Ingestion health" }]} />}
      />
        <Link href="/admin/audit-trail" className="text-sm text-primary underline">Back</Link>
      </div>

      {toast && <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">{toast}</div>}

      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(health).map(([k, v]) => (
            <div key={k} className="card p-3">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">{k.replace(/_/g, " ")}</p>
              <p className="text-lg font-semibold">{v ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      <button className="btn-secondary text-sm" onClick={migrate}>Migrate legacy AuditLog rows</button>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 font-medium text-sm">Dead letters</div>
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Event</th>
              <th className="px-4 py-2 text-left">Error</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {deadLetters.map((d) => (
              <tr key={d.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">{d.id}</td>
                <td className="px-4 py-2 text-xs">{d.event_key}</td>
                <td className="px-4 py-2 text-xs max-w-xs truncate">{d.error_message}</td>
                <td className="px-4 py-2 text-xs">{d.status}</td>
                <td className="px-4 py-2">
                  {d.status === "open" && (
                    <button className="btn-secondary text-xs" onClick={() => replay(d.id)}>Replay</button>
                  )}
                </td>
              </tr>
            ))}
            {deadLetters.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">No dead letters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
