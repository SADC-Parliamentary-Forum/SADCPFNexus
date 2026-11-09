"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { platformAuditApi, type PlatformAuditEvent } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { RegisterShell } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const PAGE_SIZE = 25;

export default function PlatformAuditTrailAdminPage() {
  const { t } = useI18n();
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
      .catch(() => setError(t("admin.auditTrail.loadFailed")))
      .finally(() => setLoading(false));
  }, [q, category, outcome, dateFrom, dateTo, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    platformAuditApi.ingestionHealth().then((r) => setHealth(r.data.data)).catch(() => setHealth(null));
  }, []);

  return (
    <RegisterShell
      title={t("admin.auditTrail.title")}
      subtitle={t("admin.auditTrail.subtitle")}
      breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.homeLabel"), href: "/admin" }, { label: t("admin.auditTrail.title") }]} />}
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
              title={t("admin.auditTrail.empty")}
              description={t("admin.auditTrail.emptyDesc")}
            />
          </div>
        ) : undefined
      }
      actions={
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/audit-trail/integrity" className="btn-secondary text-xs">{t("admin.auditTrail.nav.integrity")}</Link>
          <Link href="/admin/audit-trail/ingestion" className="btn-secondary text-xs">{t("admin.auditTrail.ingestion.crumb")}</Link>
          <Link href="/admin/audit-trail/holds" className="btn-secondary text-xs">{t("admin.auditTrail.nav.holds")}</Link>
          <Link href="/admin/audit-trail/alerts" className="btn-secondary text-xs">{t("admin.auditTrail.nav.alerts")}</Link>
          <Link href="/admin/audit-trail/forensics" className="btn-secondary text-xs">{t("admin.auditTrail.nav.forensics")}</Link>
          <Link href="/admin/audit-trail/events" className="btn-secondary text-xs">{t("admin.auditTrail.nav.eventTypes")}</Link>
          <Link href="/admin/audit-trail/governance" className="btn-primary text-xs">{t("admin.access.governance.crumb")}</Link>
        </div>
      }
      stats={
        <>
          {health ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t("admin.auditTrail.stat.events"), health.events_total],
                [t("admin.auditTrail.stat.pendingOutbox"), health.pending_outbox],
                [t("admin.auditTrail.stat.failedOutbox"), health.failed_outbox],
                [t("admin.auditTrail.stat.openDeadLetters"), health.open_dead_letters],
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
            <label htmlFor="audit-q" className="mb-1 block text-xs font-semibold text-neutral-600">{t("common.search")}</label>
            <input id="audit-q" className="form-input text-xs" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("admin.auditTrail.searchPlaceholder")} />
          </div>
          <div>
            <label htmlFor="audit-cat" className="mb-1 block text-xs font-semibold text-neutral-600">{t("admin.common.category")}</label>
            <input id="audit-cat" className="form-input text-xs" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder={t("admin.auditTrail.categoryPlaceholder")} />
          </div>
          <div>
            <label htmlFor="audit-outcome" className="mb-1 block text-xs font-semibold text-neutral-600">{t("admin.auditTrail.outcome")}</label>
            <select id="audit-outcome" className="form-input text-xs" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}>
              <option value="">{t("admin.common.all")}</option>
              <option value="success">{t("admin.auditTrail.outcomeSuccess")}</option>
              <option value="failed">{t("admin.auditTrail.outcomeFailed")}</option>
              <option value="denied">{t("admin.auditTrail.outcomeDenied")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="audit-from" className="mb-1 block text-xs font-semibold text-neutral-600">{t("admin.common.from")}</label>
            <input id="audit-from" type="date" className="form-input text-xs" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label htmlFor="audit-to" className="mb-1 block text-xs font-semibold text-neutral-600">{t("admin.common.to")}</label>
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
                <th>{t("admin.auditTrail.colWhen")}</th>
                <th>{t("admin.auditTrail.holds.scopeEvent")}</th>
                <th>{t("admin.auditTrail.colActor")}</th>
                <th>{t("admin.auditTrail.holds.scopeSubject")}</th>
                <th>{t("admin.auditTrail.outcome")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.uuid}>
                  <td className="whitespace-nowrap text-xs text-neutral-600">
                    {e.occurred_at ? formatDateShort(e.occurred_at) : "—"}
                  </td>
                  <td>
                    <Link href={`/admin/audit-trail/events?id=${e.uuid}`} className="font-medium text-primary">
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
