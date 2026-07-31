"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditExternalPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "external"],
    queryFn: async () => (await auditApi.listExternal({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const create = useMutation({
    mutationFn: () => auditApi.createExternal({
      title,
      access_starts_at: new Date().toISOString().slice(0, 10),
      access_ends_at: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["audit", "external"] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">External Audit Coordination</h1>
      <p className="text-sm text-neutral-600">
        External auditor access is restricted, time-limited, and logged.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <input className="border rounded px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="External engagement title" />
        <button type="submit" className="text-sm px-3 py-1.5 bg-neutral-900 text-white rounded">Create</button>
      </form>
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Title</th>
              <th className="p-2">Firm</th>
              <th className="p-2">Access</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="p-2">{String(r.title)}</td>
                <td className="p-2">{String(r.auditor_firm ?? "—")}</td>
                <td className="p-2">{r.access_active ? "Active" : "Closed"}</td>
                <td className="p-2 space-x-2">
                  <button type="button" className="underline" onClick={() => auditApi.activateExternal(Number(r.id)).then(() => qc.invalidateQueries({ queryKey: ["audit", "external"] }))}>Activate</button>
                  <button type="button" className="underline" onClick={() => auditApi.revokeExternal(Number(r.id)).then(() => qc.invalidateQueries({ queryKey: ["audit", "external"] }))}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
