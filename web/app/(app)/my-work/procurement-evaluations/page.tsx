"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";

type EvalRow = { id: number; reference_number: string; title: string; status: string };

export default function MyWorkProcurementEvaluationsPage() {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [featureOnly, setFeatureOnly] = useState(false);

  useEffect(() => {
    api.get<{ data: EvalRow[]; meta?: { feature_only?: boolean } }>("/procurement/committee-evaluations").then((r) => r.data)
      .then((res) => {
        setRows(res.data ?? []);
        setFeatureOnly(Boolean(res.meta?.feature_only));
      })
      .catch((e) => setError(e?.message ?? "You do not have access"));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/my-work">My Work</Link>
          {" / "}
          Procurement Evaluations
        </p>
        <h1 className="text-2xl font-semibold mt-1">Procurement Evaluations</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Assigned evaluations only.
          {featureOnly ? " Procurement module landing and sibling pages remain hidden." : ""}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="border rounded px-3 py-2">
            <div className="font-medium">{r.reference_number}</div>
            <div className="text-sm">{r.title}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{r.status}</div>
          </li>
        ))}
        {!error && rows.length === 0 && <li className="text-sm text-[var(--muted-foreground)]">No assigned evaluations.</li>}
      </ul>
    </div>
  );
}
