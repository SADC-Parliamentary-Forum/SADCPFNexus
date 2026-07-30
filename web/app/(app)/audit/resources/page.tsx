"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditResourcePage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit", "capacity"],
    queryFn: async () => (await auditApi.capacity()).data.data,
  });
  const [hours, setHours] = useState("40");
  const [label, setLabel] = useState("Fieldwork budget");

  const createBudget = useMutation({
    mutationFn: () => auditApi.createEffortBudget({ budget_hours: Number(hours), label }),
    onSuccess: () => refetch(),
  });

  const auditors = ((data as { auditors?: Array<Record<string, unknown>> })?.auditors) ?? [];

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Audit resource planning</h1>
      <p className="text-sm text-neutral-600">Effort budget vs actual and auditor capacity.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border rounded p-4 bg-white">
          <div className="text-xs uppercase text-neutral-500">Total budget hours</div>
          <div className="text-2xl font-semibold mt-1">{String((data as { total_budget_hours?: number })?.total_budget_hours ?? 0)}</div>
        </div>
        <div className="border rounded p-4 bg-white">
          <div className="text-xs uppercase text-neutral-500">Total actual hours</div>
          <div className="text-2xl font-semibold mt-1">{String((data as { total_actual_hours?: number })?.total_actual_hours ?? 0)}</div>
        </div>
      </div>

      <div className="border rounded p-4 bg-white space-y-3 text-sm">
        <label className="block">
          Budget hours
          <input className="mt-1 border rounded px-2 py-1 w-full" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="block">
          Label
          <input className="mt-1 border rounded px-2 py-1 w-full" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <button type="button" className="px-3 py-1.5 bg-neutral-900 text-white rounded" onClick={() => createBudget.mutate()} disabled={createBudget.isPending}>
          Add effort budget
        </button>
      </div>

      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Auditor</th>
              <th className="p-2">Budget</th>
              <th className="p-2">Actual</th>
            </tr>
          </thead>
          <tbody>
            {auditors.map((a, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">{String(a.auditor_user_id ?? "unassigned")}</td>
                <td className="p-2">{String(a.budget_hours)}</td>
                <td className="p-2">{String(a.actual_hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
