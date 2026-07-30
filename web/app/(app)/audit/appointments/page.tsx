"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditAppointmentsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "appointments"],
    queryFn: async () => (await auditApi.listAppointments({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];
  const [firm, setFirm] = useState("");
  const [plenary, setPlenary] = useState("");

  const create = useMutation({
    mutationFn: () =>
      auditApi.createAppointment({
        firm_name: firm,
        plenary_resolution_ref: plenary || undefined,
        independence_docs_on_file: true,
        notes: "Procurement owns tender; Audit stores appointment result.",
      }),
    onSuccess: () => {
      setFirm("");
      setPlenary("");
      qc.invalidateQueries({ queryKey: ["audit", "appointments"] });
    },
  });

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">External audit appointments</h1>
      <p className="text-sm text-neutral-600">
        Plenary appointment tracking (firm, term, independence docs, renewals). Procurement owns the tender.
      </p>

      <div className="border rounded p-4 bg-white space-y-3 text-sm">
        <label className="block">
          Firm name
          <input className="mt-1 border rounded px-2 py-1 w-full" value={firm} onChange={(e) => setFirm(e.target.value)} />
        </label>
        <label className="block">
          Plenary resolution ref
          <input className="mt-1 border rounded px-2 py-1 w-full" value={plenary} onChange={(e) => setPlenary(e.target.value)} />
        </label>
        <button
          type="button"
          className="px-3 py-1.5 bg-neutral-900 text-white rounded disabled:opacity-50"
          disabled={!firm || create.isPending}
          onClick={() => create.mutate()}
        >
          Record appointment
        </button>
      </div>

      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Firm</th>
              <th className="p-2">Plenary</th>
              <th className="p-2">Status</th>
              <th className="p-2">Independence docs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="p-2">{String(r.firm_name)}</td>
                <td className="p-2">{String(r.plenary_resolution_ref ?? "—")}</td>
                <td className="p-2">{String(r.status)}</td>
                <td className="p-2">{r.independence_docs_on_file ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
