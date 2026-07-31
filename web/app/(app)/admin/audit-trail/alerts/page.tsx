"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function AuditTrailAlertsPage() {
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
      success(`Alert moved to ${workflow_status}`);
      load();
    } catch {
      error("Transition failed");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <ModulePageHeader
        title="Security alerts"
        subtitle="Monitoring-rule indicators — New → review → classify → close. Not proof of wrongdoing."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Security alerts" }]} />}
      />
        <Link href="/admin/audit-trail" className="text-sm text-primary underline">Back</Link>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-2">Active monitoring rules</h2>
        <ul className="text-sm space-y-1 text-neutral-700">
          {rules.map((r) => (
            <li key={r.id}><span className="font-mono text-xs">{r.rule_key}</span> — {r.name} ({r.severity})</li>
          ))}
          {rules.length === 0 && <li className="text-neutral-500">No rules seeded yet.</li>}
        </ul>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left">Ref</th>
              <th className="px-4 py-2 text-left">Severity</th>
              <th className="px-4 py-2 text-left">Workflow</th>
              <th className="px-4 py-2 text-left">Notes</th>
              <th className="px-4 py-2 text-left">Actions</th>
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
                    <button className="btn-secondary text-xs" onClick={() => transition(a.id, "under_review")}>Review</button>
                  )}
                  {a.workflow_status === "under_review" && (
                    <button className="btn-secondary text-xs" onClick={() => transition(a.id, "classified")}>Classify</button>
                  )}
                  {a.workflow_status !== "closed" && (
                    <button className="btn-primary text-xs" onClick={() => transition(a.id, "closed")}>Close</button>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">No alerts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
