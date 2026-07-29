"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import api from "@/lib/api";

type HoldRow = {
  id: number;
  reference_number?: string;
  registry_reference?: string;
  title: string;
  retention_policy?: string;
  retain_until?: string;
  legal_hold: boolean;
  legal_hold_reason?: string;
};

export default function CorrespondenceRetentionPage() {
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [letterId, setLetterId] = useState("");
  const [form, setForm] = useState({
    retention_policy: "general_3y",
    retain_until: "",
    legal_hold: true,
    legal_hold_reason: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadHolds() {
    const r = await api.get<{ data: HoldRow[] }>("/correspondence/legal-holds");
    const body = r.data as { data?: HoldRow[] };
    setHolds(Array.isArray(body.data) ? body.data : []);
  }

  useEffect(() => {
    loadHolds().catch(() => setHolds([]));
  }, []);

  async function saveRetention(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.put(`/correspondence/letters/${letterId}/retention`, {
        retention_policy: form.retention_policy,
        retain_until: form.retain_until || null,
        legal_hold: form.legal_hold,
        legal_hold_reason: form.legal_hold_reason || null,
      });
      setMsg("Retention / legal hold updated.");
      await loadHolds();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Failed to update retention.");
    }
  }

  async function release(id: number) {
    await api.post(`/correspondence/letters/${id}/release-hold`);
    setMsg("Legal hold released.");
    await loadHolds();
  }

  return (
    <div className="page-container space-y-4">
      <div className="page-header">
        <h1 className="page-title">Retention & Legal Holds</h1>
        <p className="page-subtitle">
          Set retention schedules and legal holds. Purge is blocked while a hold is active.
        </p>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <form onSubmit={saveRetention} className="card space-y-3 p-4">
        <h2 className="text-lg font-semibold">Set retention / hold</h2>
        <label className="block text-sm">
          Letter ID
          <input className="form-input mt-1 w-full" required value={letterId} onChange={(e) => setLetterId(e.target.value)} placeholder="Correspondence id" />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            Retention policy
            <select className="form-input mt-1 w-full" value={form.retention_policy} onChange={(e) => setForm({ ...form, retention_policy: e.target.value })}>
              <option value="general_3y">General 3 years</option>
              <option value="financial_7y">Financial 7 years</option>
              <option value="hr_permanent">HR permanent</option>
              <option value="legal_hold_only">Legal hold only</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="block text-sm">
            Retain until
            <input type="date" className="form-input mt-1 w-full" value={form.retain_until} onChange={(e) => setForm({ ...form, retain_until: e.target.value })} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.legal_hold} onChange={(e) => setForm({ ...form, legal_hold: e.target.checked })} />
          Place legal hold
        </label>
        <label className="block text-sm">
          Hold reason
          <textarea className="form-input mt-1 w-full" rows={2} value={form.legal_hold_reason} onChange={(e) => setForm({ ...form, legal_hold_reason: e.target.value })} />
        </label>
        <button type="submit" className="btn btn-primary btn-sm">Save</button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Title</th>
              <th>Policy</th>
              <th>Retain until</th>
              <th>Reason</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holds.map((h) => (
              <tr key={h.id}>
                <td>
                  <Link href={`/correspondence/${h.id}`} className="text-primary hover:underline">
                    {h.registry_reference || h.reference_number || h.id}
                  </Link>
                </td>
                <td>{h.title}</td>
                <td>{h.retention_policy ?? "—"}</td>
                <td>{h.retain_until ?? "—"}</td>
                <td className="max-w-xs truncate">{h.legal_hold_reason ?? "—"}</td>
                <td>
                  <button type="button" className="btn btn-sm" onClick={() => void release(h.id)}>Release hold</button>
                </td>
              </tr>
            ))}
            {holds.length === 0 && <tr><td colSpan={6}>No active legal holds.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
