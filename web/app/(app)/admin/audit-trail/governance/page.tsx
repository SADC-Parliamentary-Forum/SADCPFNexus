"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  platformAuditApi,
  type AuditTrailGovernanceDecision,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_LABELS: Record<string, string> = {
  pending: "admin.auditTrail.governance.statusPending",
  decided: "admin.auditTrail.governance.statusDecided",
  not_applicable: "admin.auditTrail.governance.statusNotApplicable",
};

export default function AuditTrailGovernancePage() {
  const { t } = useI18n();
  const { success, error, info } = useToast();
  const [rows, setRows] = useState<AuditTrailGovernanceDecision[]>([]);
  const [phase2, setPhase2] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("pending");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    platformAuditApi
      .governanceList()
      .then((r: any) => {
        setRows(r.data?.data ?? r.data ?? []);
        setPhase2(r.data?.meta?.phase2_stubs ?? r.meta?.phase2_stubs ?? {});
      })
      .catch(() => error(t("admin.auditTrail.governance.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id: number) => {
    setSaving(true);
    try {
      await platformAuditApi.governanceUpdate(id, {
        status,
        decision_notes: notes || null,
      });
      success(t("admin.auditTrail.governance.saved"));
      setEditing(null);
      load();
    } catch {
      error(t("admin.auditTrail.governance.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("admin.auditTrail.governance.title")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.auditTrail.governance.title") }]} />}
      />
        <Link href="/admin/audit-trail" className="btn-secondary text-sm">
          {t("admin.auditTrail.backToAuditTrail")}
        </Link>
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm space-y-1">
        <div><span className="font-medium">{t("admin.auditTrail.governance.siem")}</span> {phase2.siem ?? t("admin.auditTrail.governance.configPending")}</div>
        <div><span className="font-medium">{t("admin.auditTrail.governance.forensic")}</span> {phase2.forensic_workspace ?? t("admin.auditTrail.governance.configPending")}</div>
        <div><span className="font-medium">{t("admin.auditTrail.governance.anomalyAi")}</span> {phase2.anomaly_ai ?? t("admin.auditTrail.governance.configPending")}</div>
      </div>
{loading ? (
        <p className="text-sm text-neutral-500">{t("common.loading")}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-neutral-900">{row.title}</h3>
                  <p className="text-xs text-neutral-500 mt-1">{row.description}</p>
                  <p className="text-[11px] text-neutral-400 mt-1">{row.decision_key}</p>
                </div>
                <span className="badge badge-muted">{STATUS_LABELS[row.status] ? t(STATUS_LABELS[row.status]) : row.status}</span>
              </div>
              {editing === row.id ? (
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <select className="form-input text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="pending">{t("admin.auditTrail.governance.statusPending")}</option>
                    <option value="decided">{t("admin.auditTrail.governance.statusDecided")}</option>
                    <option value="not_applicable">{t("admin.auditTrail.governance.statusNotApplicable")}</option>
                  </select>
                  <textarea
                    className="form-input text-sm min-h-[80px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("admin.auditTrail.governance.notesPlaceholder")}
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" disabled={saving} onClick={() => save(row.id)}>{t("common.save")}</button>
                    <button className="btn-secondary text-xs" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-neutral-600">{row.decision_notes || t("admin.auditTrail.governance.noNotes")}</p>
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setEditing(row.id);
                      setStatus(row.status);
                      setNotes(row.decision_notes ?? "");
                    }}
                  >
                    {t("admin.auditTrail.governance.update")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
