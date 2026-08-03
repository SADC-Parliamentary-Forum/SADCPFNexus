"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { platformAuditApi } from "@/lib/api";

type IngestionHealth = Record<string, number | null>;
type DeadLetter = {
  id: number;
  event_key?: string | null;
  error_message?: string | null;
  status?: string | null;
};

export default function AuditTrailIngestionPage() {
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
        `Processed ${stats.processed}; committed ${stats.committed}; failed ${stats.failed}; dead-lettered ${stats.dead_lettered}.`,
      );
      await load();
    } catch {
      setProcessResult("Outbox processing failed. Check audit-trail.manage-ingestion permission and server logs.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ModulePageHeader
        title="Ingestion Health"
        subtitle="Outbox and dead-letter visibility for the platform audit trail."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Audit Trail", href: "/admin/audit-trail" },
              { label: "Ingestion" },
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
              {processing ? "Processing..." : "Process outbox"}
            </button>
            <Link href="/admin/audit-trail" className="btn-secondary text-sm">
              Back to audit trail
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Operational migration and replay actions are restricted to the controlled audit runbook.
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
              <p className="text-lg font-semibold text-neutral-900">{value ?? "None"}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
          Ingestion health is not available.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-100 px-4 py-3 text-sm font-medium">Dead letters</div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Audit ingestion dead letters</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Event</th>
                <th scope="col">Error</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {deadLetters.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td className="text-xs">{item.event_key ?? "Unknown"}</td>
                  <td className="max-w-xs truncate text-xs">{item.error_message ?? "No error message"}</td>
                  <td className="text-xs">{item.status ?? "Unknown"}</td>
                </tr>
              ))}
              {deadLetters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-500">
                    No dead letters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
