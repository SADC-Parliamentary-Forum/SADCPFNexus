"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { platformAuditApi, type PlatformAuditEvent } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

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
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Platform Audit Trail</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Platform Audit Trail</h1>
          <p className="page-subtitle">
            Append-only institutional evidence register — separate from Internal Audit engagements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/audit-trail/integrity" className="btn-secondary text-xs">Integrity</Link>
          <Link href="/admin/audit-trail/ingestion" className="btn-secondary text-xs">Ingestion</Link>
          <Link href="/admin/audit-trail/holds" className="btn-secondary text-xs">Holds</Link>
          <Link href="/admin/audit-trail/events" className="btn-secondary text-xs">Event types</Link>
          <Link href="/admin/audit-trail/governance" className="btn-primary text-xs">Governance</Link>
          <Link href="/admin/audit" className="text-xs text-neutral-500 underline self-center">Legacy explorer</Link>
        </div>
      </div>

      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      )}

      <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Search</label>
          <input className="form-input text-xs" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Event key / action…" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Category</label>
          <input className="form-input text-xs" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder="e.g. PIF" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Outcome</label>
          <select className="form-input text-xs" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="denied">Denied</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">From</label>
          <input type="date" className="form-input text-xs" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">To</label>
          <input type="date" className="form-input text-xs" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">When</th>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Loading…</td></tr>
            )}
            {!loading && events.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No events found.</td></tr>
            )}
            {events.map((e) => (
              <tr key={e.uuid} className="border-t border-neutral-100 hover:bg-neutral-50/80">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-neutral-600">
                  {e.occurred_at ? formatDateShort(e.occurred_at) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/audit-trail/events?id=${e.uuid}`} className="font-medium text-primary hover:underline">
                    {e.event_key}
                  </Link>
                  <div className="text-[11px] text-neutral-400">{e.category}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {e.actor_snapshot?.display_name ?? e.actor_type}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600">
                  {e.subject_type ? `${String(e.subject_type).split("\\").pop()}#${e.subject_id}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="badge badge-muted">{e.outcome}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
          <span>{total} events</span>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {page} / {lastPage}</span>
            <button className="btn-secondary text-xs" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
