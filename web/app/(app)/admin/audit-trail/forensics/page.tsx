"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi } from "@/lib/api";

export default function AuditTrailForensicsPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [linkCaseId, setLinkCaseId] = useState<number | "">("");
  const [eventId, setEventId] = useState("");

  const load = () => {
    platformAuditApi.forensicCases({ per_page: 50 })
      .then((r: any) => setCases(r.data?.data ?? r.data ?? []))
      .catch(() => setCases([]));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await platformAuditApi.createForensicCase({ title });
      setTitle("");
      setToast("Forensic case opened");
      load();
    } catch {
      setToast("Could not create case");
    }
  };

  const link = async () => {
    if (!linkCaseId || !eventId) return;
    try {
      await platformAuditApi.linkForensicEvent(Number(linkCaseId), { audit_event_id: Number(eventId) });
      setToast("Event linked");
      setEventId("");
      load();
    } catch {
      setToast("Link failed");
    }
  };

  const hold = async (id: number) => {
    try {
      await platformAuditApi.forensicApplyHold(id, { hold_type: "investigation", reason: `Hold for forensic case ${id}` });
      setToast("Investigation hold placed");
    } catch {
      setToast("Hold failed");
    }
  };

  const seal = async (id: number) => {
    try {
      const r = await platformAuditApi.sealEvidencePackage(id);
      const pkg = (r as any).data?.data ?? (r as any).data;
      setToast(`Evidence sealed: ${pkg?.reference ?? "ok"} hash ${String(pkg?.manifest_hash ?? "").slice(0, 12)}…`);
    } catch {
      setToast("Seal failed — link events first");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Forensic cases</h1>
          <p className="page-subtitle">MVP case workspace — link events, apply holds, seal hashed evidence packages.</p>
        </div>
        <Link href="/admin/audit-trail" className="text-sm text-primary underline">Back</Link>
      </div>

      {toast && <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">{toast}</div>}

      <div className="card p-4 grid gap-3 sm:grid-cols-2">
        <input className="form-input text-sm sm:col-span-2" placeholder="Case title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-primary text-sm sm:col-span-2" disabled={!title} onClick={create}>Open forensic case</button>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-3">
        <select className="form-input text-sm" value={linkCaseId} onChange={(e) => setLinkCaseId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Select case</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.reference} — {c.title}</option>)}
        </select>
        <input className="form-input text-sm" placeholder="Audit event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} />
        <button className="btn-secondary text-sm" onClick={link}>Link event</button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left">Ref</th>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Custody</th>
              <th className="px-4 py-2 text-left">Actions</th>
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
                  <button className="btn-secondary text-xs" onClick={() => hold(c.id)}>Hold</button>
                  <button className="btn-primary text-xs" onClick={() => seal(c.id)}>Seal package</button>
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">No forensic cases yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
