"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditCampaignsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "campaigns"],
    queryFn: async () => (await auditApi.listCampaigns({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];
  const [title, setTitle] = useState("");

  const create = useMutation({
    mutationFn: () =>
      auditApi.createCampaign({
        title,
        items: [{ control_title: "Sample control under test", control_ref: "CTL-1" }],
      }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["audit", "campaigns"] });
    },
  });

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Control-testing campaigns</h1>
      <p className="text-sm text-neutral-600">
        Audit-side campaign schedule. Optionally link a Risk control-testing campaign id when present.
      </p>
      <div className="border rounded p-4 bg-white space-y-3 text-sm">
        <input className="border rounded px-2 py-1 w-full" placeholder="Campaign title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="px-3 py-1.5 bg-neutral-900 text-white rounded disabled:opacity-50" disabled={!title || create.isPending} onClick={() => create.mutate()}>
          Create campaign
        </button>
      </div>
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Title</th>
              <th className="p-2">Status</th>
              <th className="p-2">Risk link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="p-2">{String(r.title)}</td>
                <td className="p-2">{String(r.status)}</td>
                <td className="p-2">{String(r.risk_campaign_id ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
