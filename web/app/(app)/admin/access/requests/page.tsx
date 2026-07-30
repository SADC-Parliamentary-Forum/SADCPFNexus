"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type AccessRequest = {
  id: number;
  permission_key?: string;
  business_reason: string;
  status: string;
  scope_type?: string;
};

export default function AccessRequestsPage() {
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [permission, setPermission] = useState("procurement.evaluation.read.assigned");
  const [reason, setReason] = useState("");

  const load = () =>
    api.get<{ data: AccessRequest[] }>("/admin/access/requests").then((r) => r.data).then((r) => setRows(r.data ?? []));

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    await api.post("/access/requests", { permission_key: permission, business_reason: reason, scope_type: "assigned" });
    setReason("");
    load();
  };

  const decide = async (id: number, decision: "approve" | "reject", stage: "supervisor" | "approver") => {
    await api.post(`/admin/access/requests/${id}/decide`, { decision, stage });
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Access requests</h1>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          Permission
          <input className="block border rounded px-2 py-1 mt-1 min-w-[280px]" value={permission} onChange={(e) => setPermission(e.target.value)} />
        </label>
        <label className="text-sm grow">
          Business reason
          <input className="block border rounded px-2 py-1 mt-1 w-full" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="button" className="rounded bg-[var(--primary)] text-white px-3 py-2 text-sm" onClick={submit} disabled={!reason}>
          Request access
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">ID</th>
            <th>Permission</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{r.id}</td>
              <td>{r.permission_key}</td>
              <td>{r.status}</td>
              <td className="space-x-2">
                <button type="button" className="underline" onClick={() => decide(r.id, "approve", "supervisor")}>Supervisor OK</button>
                <button type="button" className="underline" onClick={() => decide(r.id, "approve", "approver")}>Approve</button>
                <button type="button" className="underline" onClick={() => decide(r.id, "reject", "approver")}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
