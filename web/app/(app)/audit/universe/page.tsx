"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { RegisterShell } from "@/components/registers/RegisterShell";

export default function AuditUniversePage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "universe"],
    queryFn: async () => (await auditApi.listUniverse({ per_page: 100 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const create = useMutation({
    mutationFn: () => auditApi.createUniverse({ name, entity_type: "process" }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["audit", "universe"] });
    },
  });

  return (
    <RegisterShell
      title="Audit Universe"
      subtitle="Auditable entities independent of operational process ownership."
      density="comfortable"
      actions={
        <form
          className="flex gap-2 items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="New entity name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="text-sm px-3 py-1.5 bg-neutral-900 text-white rounded">Add</button>
        </form>
      }
    >
      {isLoading ? (
        <p className="text-sm text-neutral-500 p-4">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Type</th>
              <th className="p-2">Risk</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-neutral-100">
                <td className="p-2">{String(r.name)}</td>
                <td className="p-2">{String(r.entity_type)}</td>
                <td className="p-2">{String(r.risk_profile ?? "—")}</td>
                <td className="p-2">{String(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RegisterShell>
  );
}
