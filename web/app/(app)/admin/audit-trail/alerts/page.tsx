"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AuditTrailAlertsPage() {
  const { t } = useI18n();
  const { success, error, info } = useToast();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  const load = () => {
    platformAuditApi.alerts({ per_page: 50 })
      .then((r: any) => setAlerts(r.data?.data ?? r.data ?? []))
      .catch(() => setAlerts([]));
    platformAuditApi.monitoringRules()
      .then((r: any) => setRules(r.data?.data ?? r.data ?? []))
      .catch(() => setRules([]));
  };

  useEffect(() => { load(); }, []);

  const transition = async (id: number, workflow_status: string) => {
    try {
      await platformAuditApi.transitionAlert(id, {
        workflow_status,
        classification: workflow_status === "classified" ? "indicator_reviewed" : undefined,
      });
      success(t("admin.auditTrail.alerts.moved", { status: workflow_status }));
      load();
    } catch {
      error(t("admin.auditTrail.alerts.transitionFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title={t("admin.auditTrail.alerts.title")}
        subtitle={t("admin.auditTrail.alerts.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.auditTrail.alerts.title") }]} />}
      />
        <Link href="/admin/audit-trail" className="btn-secondary text-sm">{t("common.back")}</Link>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-2">{t("admin.auditTrail.alerts.rulesTitle")}</h2>
        {rules.length === 0 ? (
          <EmptyState icon="rule" title={t("admin.auditTrail.alerts.noRules")} className="py-6 min-h-0" />
        ) : (
          <ul className="text-sm space-y-1 text-neutral-700">
            {rules.map((r) => (
              <li key={r.id}><span className="font-mono text-xs">{r.rule_key}</span> — {r.name} ({r.severity})</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left">{t("admin.auditTrail.alerts.colRef")}</th>
              <th className="px-4 py-2 text-left">{t("admin.common.severity")}</th>
              <th className="px-4 py-2 text-left">{t("admin.auditTrail.alerts.colWorkflow")}</th>
              <th className="px-4 py-2 text-left">{t("admin.common.notes")}</th>
              <th className="px-4 py-2 text-left">{t("admin.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{a.reference}</td>
                <td className="px-4 py-2">{a.severity}</td>
                <td className="px-4 py-2">{a.workflow_status ?? a.status}</td>
                <td className="px-4 py-2 text-xs max-w-xs truncate">{a.notes}</td>
                <td className="px-4 py-2 space-x-1">
                  {a.workflow_status !== "under_review" && a.workflow_status !== "closed" && (
                    <button className="btn-secondary text-xs" onClick={() => transition(a.id, "under_review")}>{t("admin.auditTrail.alerts.review")}</button>
                  )}
                  {a.workflow_status === "under_review" && (
                    <button className="btn-secondary text-xs" onClick={() => transition(a.id, "classified")}>{t("admin.auditTrail.alerts.classify")}</button>
                  )}
                  {a.workflow_status !== "closed" && (
                    <button className="btn-primary text-xs" onClick={() => transition(a.id, "closed")}>{t("common.close")}</button>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <TableEmpty colSpan={5} title={t("admin.auditTrail.alerts.empty")} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
