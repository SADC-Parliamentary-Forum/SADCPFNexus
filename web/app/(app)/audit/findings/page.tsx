"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditFindingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "findings"],
    queryFn: async () => (await auditApi.listFindings({ per_page: 100 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Findings</h1>
      <p className="text-sm text-neutral-600">
        Issued findings are immutable for Management. Responses and corrective actions are separate.
      </p>
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Reference</th>
              <th className="p-2">Title</th>
              <th className="p-2">Rating</th>
              <th className="p-2">Status</th>
              <th className="p-2">Confidentiality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="p-2">{String(r.reference_number ?? "—")}</td>
                <td className="p-2">{String(r.title)}</td>
                <td className="p-2">{String(r.rating ?? "—")}</td>
                <td className="p-2">{String(r.status)}</td>
                <td className="p-2">{String(r.confidentiality_level)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
