"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditGovernancePacksPage() {
  const [title, setTitle] = useState("FSC meeting pack");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      (await auditApi.createGovernancePack({
        title,
        fiscal_year: Number(year),
        audience: "fsc",
      })).data.data as Record<string, unknown>,
    onSuccess: (row) => setPack(row),
  });

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Governance meeting packs</h1>
      <p className="text-sm text-neutral-600">
        Export structured pack of plan progress plus critical/high findings for FSC.
      </p>
      <div className="border rounded p-4 bg-white space-y-3 text-sm">
        <input className="border rounded px-2 py-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="border rounded px-2 py-1 w-full" value={year} onChange={(e) => setYear(e.target.value)} />
        <button type="button" className="px-3 py-1.5 bg-neutral-900 text-white rounded" onClick={() => create.mutate()} disabled={create.isPending}>
          Generate pack
        </button>
      </div>
      {pack && (
        <pre className="text-xs bg-neutral-50 border rounded p-3 overflow-auto max-h-[28rem]">
          {JSON.stringify(pack, null, 2)}
        </pre>
      )}
    </div>
  );
}
