"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { riskApi } from "@/lib/api";

export default function RiskIncidentsPage() {
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    riskApi.listIncidents()
      .then((r) => setData((r.data as any).data ?? r.data ?? []))
      .catch((e) => setError(e?.response?.data?.message ?? "Failed to load incidents"));
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="text-sm text-muted-foreground">
        <Link href="/risk" className="hover:text-primary">Risk Register</Link>
        <span className="mx-2">/</span>
        <span>Incidents</span>
      </div>
      <h1 className="page-title">Incidents</h1>
      <p className="page-subtitle">Incidents are distinct from risks. Materialising a risk does not auto-close it.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Severity</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Linked risk</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-muted-foreground">No incidents yet.</td></tr>
            )}
            {data.map((row: any) => (
              <tr key={row.id} className="border-t">
                <td className="p-3 font-mono text-xs">{row.incident_code}</td>
                <td className="p-3">{row.title}</td>
                <td className="p-3">{row.severity}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">{row.risk_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
