"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Decision = { id: number; topic: string; status: string; decision_notes?: string };

export default function GovernanceChecklistPage() {
  const [rows, setRows] = useState<Decision[]>([]);

  useEffect(() => {
    api.get<{ data: Decision[] }>("/admin/access/governance").then((r) => r.data).then((r) => setRows(r.data ?? []));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Governance checklist</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Institutional decisions (MFA policy, review cadence, break-glass) — marked Pending until owners decide.
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="border rounded px-3 py-2 flex justify-between gap-4">
            <span>{r.topic}</span>
            <span className="text-sm uppercase tracking-wide text-[var(--muted-foreground)]">{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
