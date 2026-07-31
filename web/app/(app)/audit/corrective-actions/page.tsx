"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditCorrectiveActionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "findings", "ca"],
    queryFn: async () => (await auditApi.listFindings({ per_page: 100, status: "corrective_in_progress,due_for_verification,reopened" })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Corrective Actions</h1>
      <p className="text-sm text-neutral-600">
        Corrective actions create Assignments. Assignment completion moves items to Due for Audit Verification — it does not close the finding.
      </p>
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <div className="space-y-2 text-sm">
          {rows.length === 0 ? <p className="text-neutral-500">No open corrective-action findings.</p> : null}
          {rows.map((r) => (
            <div key={String(r.id)} className="border rounded p-3 bg-white">
              <div className="font-medium">{String(r.reference_number)} — {String(r.title)}</div>
              <div className="text-neutral-600">Status: {String(r.status)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
