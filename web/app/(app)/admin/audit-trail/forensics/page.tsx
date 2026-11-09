"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi, type PlatformAuditEvent } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AuditTrailForensicsPage() {
  const { t } = useI18n();
  const { success, error, info } = useToast();
  const [cases, setCases] = useState<any[]>([]);
  const [events, setEvents] = useState<PlatformAuditEvent[]>([]);
  const [title, setTitle] = useState("");
  const [linkCaseId, setLinkCaseId] = useState<number | "">("");
  const [eventId, setEventId] = useState("");

  const load = () => {
    platformAuditApi.forensicCases({ per_page: 50 })
      .then((r: any) => setCases(r.data?.data ?? r.data ?? []))
      .catch(() => setCases([]));
    platformAuditApi.list({ per_page: 100 })
      .then((r) => setEvents(r.data?.data ?? []))
      .catch(() => setEvents([]));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await platformAuditApi.createForensicCase({ title });
      setTitle("");
      success(t("admin.auditForensics.opened"));
      load();
    } catch {
      error(t("admin.auditForensics.createFailed"));
    }
  };

  const link = async () => {
    if (!linkCaseId || !eventId) return;
    try {
      await platformAuditApi.linkForensicEvent(Number(linkCaseId), { audit_event_id: Number(eventId) });
      success(t("admin.auditForensics.linked"));
      setEventId("");
      load();
    } catch {
      error(t("admin.auditForensics.linkFailed"));
    }
  };

  const hold = async (id: number) => {
    try {
      await platformAuditApi.forensicApplyHold(id, { hold_type: "investigation", reason: `Hold for forensic case ${id}` });
      success(t("admin.auditForensics.holdPlaced"));
    } catch {
      error(t("admin.auditForensics.holdFailed"));
    }
  };

  const seal = async (id: number) => {
    try {
      const r = await platformAuditApi.sealEvidencePackage(id);
      const pkg = (r as any).data?.data ?? (r as any).data;
      success(t("admin.auditForensics.sealed", { reference: pkg?.reference ?? "ok", hash: String(pkg?.manifest_hash ?? "").slice(0, 12) }));
    } catch {
      error(t("admin.auditForensics.sealFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title="admin.auditForensics.title"
        subtitle="admin.auditForensics.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "admin.auditForensics.title" }]} />}
      />
        <Link href="/admin/audit-trail" className="btn-secondary text-sm">{t("common.back")}</Link>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-2">
        <input className="form-input text-sm sm:col-span-2" placeholder={t("admin.auditForensics.caseTitle")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-primary text-sm sm:col-span-2" disabled={!title} onClick={create}>{t("admin.auditForensics.open")}</button>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-3">
        <select className="form-input text-sm" value={linkCaseId} onChange={(e) => setLinkCaseId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">{t("admin.auditForensics.selectCase")}</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.reference} — {c.title}</option>)}
        </select>
        <select
          className="form-input text-sm"
          value={eventId}
          data-testid="forensics-event-select"
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="">{t("audit.forensics.event")}</option>
          {events.map((ev) => (
            <option key={ev.id} value={String(ev.id)}>
              #{ev.sequence_number ?? ev.id} — {ev.event_key}
              {ev.actor_snapshot?.display_name ? ` (${ev.actor_snapshot.display_name})` : ""}
            </option>
          ))}
        </select>
        <button className="btn-secondary text-sm" onClick={link}>{t("admin.auditForensics.linkEvent")}</button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left">{t("admin.auditTrail.alerts.colRef")}</th>
              <th className="px-4 py-2 text-left">{t("audit.col.title")}</th>
              <th className="px-4 py-2 text-left">{t("audit.col.status")}</th>
              <th className="px-4 py-2 text-left">{t("assets.mine.colCustody")}</th>
              <th className="px-4 py-2 text-left">{t("audit.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{c.reference}</td>
                <td className="px-4 py-2">{c.title}</td>
                <td className="px-4 py-2">{c.status}</td>
                <td className="px-4 py-2 text-xs">{c.custody_holder_id ?? "—"}</td>
                <td className="px-4 py-2 space-x-1">
                  <button className="btn-secondary text-xs" onClick={() => hold(c.id)}>{t("admin.auditForensics.hold")}</button>
                  <button className="btn-primary text-xs" onClick={() => seal(c.id)}>{t("admin.auditForensics.seal")}</button>
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <TableEmpty colSpan={5} title="admin.auditForensics.empty" />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
