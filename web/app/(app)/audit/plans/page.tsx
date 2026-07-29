"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { RegisterShell } from "@/components/registers/RegisterShell";

export default function AuditPlansPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "plans"],
    queryFn: async () => (await auditApi.listPlans({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const create = useMutation({
    mutationFn: () => auditApi.createPlan({ title, fiscal_year: new Date().getFullYear() }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["audit", "plans"] });
    },
  });

  return (
    <RegisterShell
      title="Annual Audit Plans"
      subtitle="Versioned plans with amend history and configurable approval."
      density="comfortable"
      actions={
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate();
          }}
        >
          <input className="border rounded px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Plan title" />
          <button type="submit" className="text-sm px-3 py-1.5 bg-neutral-900 text-white rounded">Create draft</button>
        </form>
      }
    >
      {isLoading ? <p className="p-4 text-sm text-neutral-500">Loading…</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Title</th>
              <th className="p-2">Year</th>
              <th className="p-2">Version</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="p-2">{String(r.title)}</td>
                <td className="p-2">{String(r.fiscal_year)}</td>
                <td className="p-2">v{String(r.version)}</td>
                <td className="p-2">{String(r.status)}</td>
                <td className="p-2 space-x-2">
                  {r.status === "draft" || r.status === "amended" ? (
                    <button type="button" className="underline" onClick={() => auditApi.submitPlan(Number(r.id)).then(() => qc.invalidateQueries({ queryKey: ["audit", "plans"] }))}>Submit</button>
                  ) : null}
                  {r.status === "pending_approval" ? (
                    <button type="button" className="underline" onClick={() => auditApi.approvePlan(Number(r.id)).then(() => qc.invalidateQueries({ queryKey: ["audit", "plans"] }))}>Approve</button>
                  ) : null}
                  {r.status === "approved" ? (
                    <button type="button" className="underline" onClick={() => auditApi.amendPlan(Number(r.id), { amendment_reason: "Scope change" }).then(() => qc.invalidateQueries({ queryKey: ["audit", "plans"] }))}>Amend</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RegisterShell>
  );
}
