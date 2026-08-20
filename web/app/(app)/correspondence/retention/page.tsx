"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import api from "@/lib/api";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { exportToCsv } from "@/lib/csvExport";

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
  const [saving, setSaving] = useState(false);
  const [releasingId, setReleasingId] = useState<number | null>(null);
  const { confirm } = useConfirm();

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
    const targetLetterId = letterId.trim();
    if (!targetLetterId || saving) return;

    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await api.put(`/correspondence/letters/${targetLetterId}/retention`, {
        retention_policy: form.retention_policy,
        retain_until: form.retain_until || null,
        legal_hold: form.legal_hold,
        legal_hold_reason: form.legal_hold_reason || null,
      });
      setMsg("Retention / legal hold updated.");
      await loadHolds();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Failed to update retention.");
    } finally {
      setSaving(false);
    }
  }

  async function release(id: number) {
    if (releasingId) return;
    const ok = await confirm({
      title: "Release legal hold",
      message: "This will lift the legal hold and allow the item to be purged per its retention policy. This action cannot be undone.",
      confirmText: "Release hold",
      variant: "danger",
    });
    if (!ok) return;

    setErr(null);
    setReleasingId(id);
    try {
      await api.post(`/correspondence/letters/${id}/release-hold`);
      setMsg("Legal hold released.");
      await loadHolds();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Failed to release hold.");
    } finally {
      setReleasingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Retention & Legal Holds"
        subtitle="Set retention schedules and legal holds. Purge is blocked while a hold is active."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Correspondence", href: "/correspondence" },
              { label: "Retention" },
            ]}
          />
        }
        actions={
          <>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() =>
                exportToCsv(
                  "correspondence-legal-holds.csv",
                  holds.map((h) => ({
                    ref: h.registry_reference || h.reference_number || h.id,
                    title: h.title,
                    policy: h.retention_policy ?? "",
                    retain_until: h.retain_until ?? "",
                    reason: h.legal_hold_reason ?? "",
                  })),
                  [
                    { key: "ref", header: "Ref" },
                    { key: "title", header: "Title" },
                    { key: "policy", header: "Policy" },
                    { key: "retain_until", header: "Retain until" },
                    { key: "reason", header: "Reason" },
                  ],
                )
              }
              disabled={holds.length === 0}
            >
              Export CSV
            </button>
            <Link href="/correspondence/master-register" className="btn-secondary btn-sm">
              Master register
            </Link>
          </>
        }
      />
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <form onSubmit={saveRetention} className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Set retention / hold</h2>
        <label className="block text-sm">
          Letter ID
          <input
            className="form-input mt-1 w-full disabled:opacity-60"
            required
            value={letterId}
            onChange={(e) => setLetterId(e.target.value)}
            placeholder="Correspondence id"
            disabled={saving}
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            Retention policy
            <select
              className="form-input mt-1 w-full disabled:opacity-60"
              value={form.retention_policy}
              onChange={(e) => setForm({ ...form, retention_policy: e.target.value })}
              disabled={saving}
            >
              <option value="general_3y">General 3 years</option>
              <option value="financial_7y">Financial 7 years</option>
              <option value="hr_permanent">HR permanent</option>
              <option value="legal_hold_only">Legal hold only</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="block text-sm">
            Retain until
            <input
              type="date"
              className="form-input mt-1 w-full disabled:opacity-60"
              value={form.retain_until}
              onChange={(e) => setForm({ ...form, retain_until: e.target.value })}
              disabled={saving}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.legal_hold}
            onChange={(e) => setForm({ ...form, legal_hold: e.target.checked })}
            disabled={saving}
          />
          Place legal hold
        </label>
        <label className="block text-sm">
          Hold reason
          <textarea
            className="form-input mt-1 w-full disabled:opacity-60"
            rows={2}
            value={form.legal_hold_reason}
            onChange={(e) => setForm({ ...form, legal_hold_reason: e.target.value })}
            disabled={saving}
          />
        </label>
        <button type="submit" className="btn-primary btn-sm disabled:opacity-60 disabled:cursor-not-allowed" disabled={saving || !letterId.trim()}>
          {saving ? "Saving…" : "Save"}
        </button>
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
                  <button
                    type="button"
                    className="btn-secondary text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => void release(h.id)}
                    disabled={releasingId === h.id}
                  >
                    {releasingId === h.id ? "Releasing…" : "Release hold"}
                  </button>
                </td>
              </tr>
            ))}
            {holds.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-neutral-500">
                  No active legal holds.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
