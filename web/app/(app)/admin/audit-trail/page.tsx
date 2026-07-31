"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { platformAuditApi, type PlatformAuditEvent } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { RegisterShell } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 25;

export default function PlatformAuditTrailAdminPage() {
  const [events, setEvents] = useState<PlatformAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [health, setHealth] = useState<Record<string, number | null> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    platformAuditApi
      .list({
        ...(q ? { q } : {}),
        ...(category ? { category } : {}),
        ...(outcome ? { outcome } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        page,
        per_page: PAGE_SIZE,
      })
      .then((res) => {
        setEvents(res.data.data);
        setLastPage(res.data.last_page);
        setTotal(res.data.total);
      })
      .catch(() => setError("Could not load platform audit events. Check audit-trail.search permission."))
      .finally(() => setLoading(false));
  }, [q, category, outcome, dateFrom, dateTo, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    platformAuditApi.ingestionHealth().then((r) => setHealth(r.data.data)).catch(() => setHealth(null));
  }, []);

  return (
    <RegisterShell
      title="Platform Audit Trail"
      subtitle="Append-only institutional evidence register — separate from Internal Audit engagements."
      breadcrumbs={<PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Platform Audit Trail" }]} />}
      page={page}
      pageCount={lastPage}
      total={total}
      onPageChange={setPage}
      loading={loading}
      empty={
        !error && events.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="policy"
              title="No events found"
              description="Adjust filters or wait for new platform audit events to be ingested."
            />
          </div>
        ) : undefined
      }
      actions={
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/audit-trail/integrity" className="btn-secondary text-xs">Integrity</Link>
          <Link href="/admin/audit-trail/ingestion" className="btn-secondary text-xs">Ingestion</Link>
          <Link href="/admin/audit-trail/holds" className="btn-secondary text-xs">Holds</Link>
          <Link href="/admin/audit-trail/events" className="btn-secondary text-xs">Event types</Link>
          <Link href="/admin/audit-trail/governance" className="btn-primary text-xs">Governance</Link>
          <Link href="/admin/audit" className="self-center text-xs text-neutral-500 underline">Legacy explorer</Link>
        </div>
      }
      stats={
        <>
          {health ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Events", health.events_total],
                ["Pending outbox", health.pending_outbox],
                ["Failed outbox", health.failed_outbox],
                ["Open dead letters", health.open_dead_letters],
              ].map(([label, value]) => (
                <div key={String(label)} className="card p-3">
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
                  <p className="text-lg font-semibold text-neutral-900">{value ?? "—"}</p>
                </div>
              ))}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
          ) : null}
        </>
      }
      filters={
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600" htmlFor="audit-q">Search</label>
            <input id="audit-q" className="form-input text-xs" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Event key / action…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600" htmlFor="audit-cat">Category</label>
            <input id="audit-cat" className="form-input text-xs" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder="e.g. PIF" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600" htmlFor="audit-outcome">Outcome</label>
            <select id="audit-outcome" className="form-input text-xs" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="denied">Denied</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600" htmlFor="audit-from">From</label>
            <input id="audit-from" type="date" className="form-input text-xs" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600" htmlFor="audit-to">To</label>
            <input id="audit-to" type="date" className="form-input text-xs" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
        </div>
      }
    >
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Subject</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.uuid}>
                  <td className="whitespace-nowrap text-xs text-neutral-600">
                    {e.occurred_at ? formatDateShort(e.occurred_at) : "—"}
                  </td>
                  <td>
                    <Link href={`/admin/audit-trail/events?id=${e.uuid}`} className="font-medium text-primary hover:underline">
                      {e.event_key}
                    </Link>
                    <div className="text-[11px] text-neutral-400">{e.category}</div>
                  </td>
                  <td className="text-xs text-neutral-700">
                    {e.actor_snapshot?.display_name ?? e.actor_type}
                  </td>
                  <td className="text-xs text-neutral-600">
                    {e.subject_type ? `${String(e.subject_type).split("\\").pop()}#${e.subject_id}` : "—"}
                  </td>
                  <td>
                    <span className={`badge text-xs capitalize ${
                      e.outcome === "success" ? "badge-success" : e.outcome === "denied" || e.outcome === "failed" ? "badge-danger" : "badge-muted"
                    }`}>
                      {e.outcome ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RegisterShell>
  );
}
