"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function AuditTrailIntegrityPage() {
  const { success, error, info } = useToast();
  const [checkpoints, setCheckpoints] = useState<Array<Record<string, unknown>>>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    platformAuditApi.checkpoints()
      .then((r) => setCheckpoints(r.data.data ?? []))
      .catch(() => error("Could not load checkpoints"));
  };

  useEffect(() => { load(); }, []);

  const verify = async () => {
    setBusy(true);
    try {
      const r = await platformAuditApi.verifyIntegrity();
      setResult(r.data.data as any);
      error(r.data.data.valid ? "Chain valid" : "Chain failure detected");
    } catch {
      error("Verify failed");
    } finally {
      setBusy(false);
    }
  };

  const checkpoint = async () => {
    setBusy(true);
    try {
      await platformAuditApi.createCheckpoint();
      success("Checkpoint created");
      load();
    } catch {
      error("Checkpoint failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title="Integrity report"
        subtitle="Hash-chain verification and periodic checkpoints."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Integrity report" }]} />}
      />
        <Link href="/admin/audit-trail" className="text-sm text-primary underline">Back</Link>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary text-sm" disabled={busy} onClick={verify}>Verify chain</button>
        <button className="btn-secondary text-sm" disabled={busy} onClick={checkpoint}>Create checkpoint</button>
      </div>

      {result && (
        <div className="card p-4 text-sm space-y-1">
          <div><span className="font-medium">Valid:</span> {String(result.valid)}</div>
          <div><span className="font-medium">Checked:</span> {String(result.checked)}</div>
          <div><span className="font-medium">Message:</span> {String(result.message)}</div>
          {result.first_failure_sequence != null && (
            <div><span className="font-medium">First failure seq:</span> {String(result.first_failure_sequence)}</div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Range</th>
              <th className="px-4 py-3 text-left">Count</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {checkpoints.map((c: any) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">{c.id}</td>
                <td className="px-4 py-2 text-xs">{c.from_sequence} → {c.to_sequence}</td>
                <td className="px-4 py-2">{c.event_count}</td>
                <td className="px-4 py-2">{c.status}</td>
              </tr>
            ))}
            {checkpoints.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-500">No checkpoints yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
