"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  platformAuditApi,
  type AuditTrailGovernanceDecision,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  decided: "Decided",
  not_applicable: "Not Applicable",
};

export default function AuditTrailGovernancePage() {
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
      .catch(() => error("Could not load governance checklist"))
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
      success("Decision saved");
      setEditing(null);
      load();
    } catch {
      error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Audit Trail governance checklist"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Audit Trail governance checklist" }]} />}
      />
        <Link href="/admin/audit-trail" className="text-sm text-primary underline">
          Back to Audit Trail
        </Link>
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm space-y-1">
        <div><span className="font-medium">SIEM:</span> {phase2.siem ?? "Governance Configuration Pending"}</div>
        <div><span className="font-medium">Forensic workspace:</span> {phase2.forensic_workspace ?? "Governance Configuration Pending"}</div>
        <div><span className="font-medium">Anomaly AI:</span> {phase2.anomaly_ai ?? "Governance Configuration Pending"}</div>
      </div>
{loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
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
                <span className="badge badge-muted">{STATUS_LABELS[row.status] ?? row.status}</span>
              </div>
              {editing === row.id ? (
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <select className="form-input text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="decided">Decided</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                  <textarea
                    className="form-input text-sm min-h-[80px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Institutional decision notes (optional)"
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" disabled={saving} onClick={() => save(row.id)}>Save</button>
                    <button className="btn-secondary text-xs" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-neutral-600">{row.decision_notes || "No notes yet."}</p>
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setEditing(row.id);
                      setStatus(row.status);
                      setNotes(row.decision_notes ?? "");
                    }}
                  >
                    Update
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
