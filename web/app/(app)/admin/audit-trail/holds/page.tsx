"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformAuditApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function AuditTrailHoldsPage() {
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
      success("Hold placed — disposal blocked for matching scope");
      setForm((f) => ({ ...f, reason: "" }));
      load();
    } catch {
      error("Could not place hold");
    }
  };

  const release = async (id: number) => {
    try {
      await platformAuditApi.releaseHold(id);
      success("Hold released");
      load();
    } catch {
      error("Release failed");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <ModulePageHeader
        title="Event holds"
        subtitle="Legal / audit / investigation holds block disposal."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Event holds" }]} />}
      />
        <Link href="/admin/audit-trail" className="text-sm text-primary underline">Back</Link>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-2">
        <select className="form-input text-sm" value={form.hold_type} onChange={(e) => setForm({ ...form, hold_type: e.target.value })}>
          <option value="legal">Legal</option>
          <option value="audit">Audit</option>
          <option value="investigation">Investigation</option>
        </select>
        <select className="form-input text-sm" value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })}>
          <option value="event">Event</option>
          <option value="subject">Subject</option>
          <option value="category">Category</option>
          <option value="tenant">Tenant</option>
        </select>
        <input className="form-input text-sm" placeholder="Scope value" value={form.scope_value} onChange={(e) => setForm({ ...form, scope_value: e.target.value })} />
        <input className="form-input text-sm" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button className="btn-primary text-sm sm:col-span-2" disabled={!form.reason} onClick={place}>Place hold</button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Scope</th>
              <th className="px-4 py-2 text-left">Reason</th>
              <th className="px-4 py-2 text-left">Status</th>
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
                    <button className="btn-secondary text-xs" onClick={() => release(h.id)}>Release</button>
                  )}
                </td>
              </tr>
            ))}
            {holds.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">No holds.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
