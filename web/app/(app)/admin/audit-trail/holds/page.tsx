"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AuditTrailHoldsPage() {
  const { t } = useI18n();
  const { success, error, info } = useToast();
  const [holds, setHolds] = useState<any[]>([]);
  const [form, setForm] = useState({
    hold_type: "legal",
    scope_type: "category",
    scope_value: "PIF",
    reason: "",
  });

  const load = () => {
    platformAuditApi.holds()
      .then((r: any) => setHolds(r.data?.data ?? r.data ?? []))
      .catch(() => setHolds([]));
  };

  useEffect(() => { load(); }, []);

  const place = async () => {
    try {
      await platformAuditApi.placeHold(form);
      success(t("admin.auditTrail.holds.placed"));
      setForm((f) => ({ ...f, reason: "" }));
      load();
    } catch {
      error(t("admin.auditTrail.holds.placeFailed"));
    }
  };

  const release = async (id: number) => {
    try {
      await platformAuditApi.releaseHold(id);
      success(t("admin.auditTrail.holds.released"));
      load();
    } catch {
      error(t("admin.auditTrail.holds.releaseFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title={t("admin.auditTrail.holds.title")}
        subtitle={t("admin.auditTrail.holds.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.auditTrail.holds.title") }]} />}
      />
        <Link href="/admin/audit-trail" className="btn-secondary text-sm">{t("common.back")}</Link>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-2">
        <select className="form-input text-sm" value={form.hold_type} onChange={(e) => setForm({ ...form, hold_type: e.target.value })}>
          <option value="legal">{t("admin.auditTrail.holds.typeLegal")}</option>
          <option value="audit">{t("admin.auditTrail.holds.typeAudit")}</option>
          <option value="investigation">{t("admin.auditTrail.holds.typeInvestigation")}</option>
        </select>
        <select className="form-input text-sm" value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })}>
          <option value="event">{t("admin.auditTrail.holds.scopeEvent")}</option>
          <option value="subject">{t("admin.auditTrail.holds.scopeSubject")}</option>
          <option value="category">{t("admin.common.category")}</option>
          <option value="tenant">{t("admin.auditTrail.holds.scopeTenant")}</option>
        </select>
        <input className="form-input text-sm" placeholder={t("admin.auditTrail.holds.scopeValue")} value={form.scope_value} onChange={(e) => setForm({ ...form, scope_value: e.target.value })} />
        <input className="form-input text-sm" placeholder={t("admin.common.reason")} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button className="btn-primary text-sm sm:col-span-2" disabled={!form.reason} onClick={place}>{t("admin.auditTrail.holds.place")}</button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left">{t("admin.common.type")}</th>
              <th className="px-4 py-2 text-left">{t("admin.auditTrail.holds.scope")}</th>
              <th className="px-4 py-2 text-left">{t("admin.common.reason")}</th>
              <th className="px-4 py-2 text-left">{t("admin.common.status")}</th>
              <th className="px-4 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {holds.map((h) => (
              <tr key={h.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">{h.hold_type}</td>
                <td className="px-4 py-2 text-xs">{h.scope_type}:{h.scope_value ?? h.audit_event_id}</td>
                <td className="px-4 py-2 text-xs">{h.reason}</td>
                <td className="px-4 py-2">{h.status}</td>
                <td className="px-4 py-2">
                  {h.status === "active" && (
                    <button className="btn-secondary text-xs" onClick={() => release(h.id)}>{t("admin.auditTrail.holds.release")}</button>
                  )}
                </td>
              </tr>
            ))}
            {holds.length === 0 && (
              <TableEmpty colSpan={5} title={t("admin.auditTrail.holds.empty")} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
